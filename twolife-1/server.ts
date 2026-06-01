import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import crypto from 'crypto';
import db from './server/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_jwt_key_that_should_be_long';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 20);
  const maxUploadBytes = maxUploadMb * 1024 * 1024;

  app.use(express.json());

  // Setup upload directory
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  try {
    fs.chmodSync(uploadDir, 0o775);
  } catch (err) {
    console.warn(`Unable to chmod upload dir: ${uploadDir}`);
  }
  fs.accessSync(uploadDir, fs.constants.W_OK);
  const thumbnailDir = path.join(uploadDir, 'thumbnails');
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
  }
  
  // Serve uploads statically
  app.use('/uploads', express.static(uploadDir));

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });
  const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const safeImageExt = (filename: string, mimeType = '') => {
    const ext = path.extname(filename).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return ext;
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    if (mimeType === 'image/gif') return '.gif';
    return '.jpg';
  };
  const uniqueUploadName = (file: Express.Multer.File) => `${file.fieldname}-${Date.now()}-${crypto.randomUUID()}${safeImageExt(file.originalname, file.mimetype)}`;

  const upload = multer({
    storage,
    limits: { fileSize: maxUploadBytes },
  });

  const albumUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => cb(null, uniqueUploadName(file)),
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 100 },
  });

  const isAllowedImage = (file: Express.Multer.File) => allowedImageMimeTypes.has(file.mimetype);
  const fileUrl = (filePath: string) => `/uploads/${path.relative(uploadDir, filePath).split(path.sep).join('/')}`;
  const unlinkIfExists = (url?: string | null) => {
    if (!url || !url.startsWith('/uploads/')) return;
    const target = path.resolve(uploadDir, url.replace(/^\/uploads\//, ''));
    if (!target.startsWith(path.resolve(uploadDir))) return;
    if (fs.existsSync(target)) fs.unlinkSync(target);
  };
  const createThumbnailForFile = (file: Express.Multer.File, providedThumbnail?: Express.Multer.File) => {
    if (providedThumbnail && isAllowedImage(providedThumbnail)) {
      const thumbName = `thumb-${path.basename(file.filename, path.extname(file.filename))}${safeImageExt(providedThumbnail.originalname, providedThumbnail.mimetype)}`;
      const thumbPath = path.join(thumbnailDir, thumbName);
      fs.renameSync(providedThumbnail.path, thumbPath);
      return fileUrl(thumbPath);
    }

    // Fallback for environments without native image processing: keep a separate thumbnail asset
    // slot so lists never need to request the original URL. The frontend sends real compressed
    // thumbnails for album uploads, and legacy/generic uploads fall back to this copy.
    const thumbName = `thumb-${path.basename(file.filename)}`;
    const thumbPath = path.join(thumbnailDir, thumbName);
    fs.copyFileSync(file.path, thumbPath);
    return fileUrl(thumbPath);
  };

  // Middleware to authenticate JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // =============== API ROUTES =============== //

  // Users Management (Admin only)
  app.get('/api/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const users = db.prepare('SELECT id, username, email, nickname, role, created_at FROM users').all();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { username, email, password, nickname, role } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, email, password_hash, nickname, role) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(username, email || '', hashedPassword, nickname || username, role || 'user');
      const newUser = db.prepare('SELECT id, username, email, nickname, role FROM users WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(newUser);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/users/:id/password', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    try {
      let settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
      if (!settings) {
        db.prepare('INSERT INTO settings (theme_color) VALUES (?)').run('pink');
        settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
      }
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { theme_color, about_title, about_subtitle, about_description } = req.body;
    try {
      let settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
      if (!settings) {
        db.prepare('INSERT INTO settings (theme_color, about_title, about_subtitle, about_description) VALUES (?, ?, ?, ?)').run(
          theme_color || 'pink',
          about_title || 'TwoLife 双人宇宙',
          about_subtitle || '版本号 1.0.0',
          about_description || '一个私密的二人数字空间，用来珍藏关于时间、照片和文字的美好记忆。'
        );
      } else {
        db.prepare(
          `UPDATE settings
           SET theme_color = COALESCE(?, theme_color),
               about_title = COALESCE(?, about_title),
               about_subtitle = COALESCE(?, about_subtitle),
               about_description = COALESCE(?, about_description)
           WHERE id = ?`
        ).run(theme_color, about_title, about_subtitle, about_description, (settings as any).id);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auth: Register
  app.post('/api/auth/register', (req, res) => {
    const { username, email, password, nickname } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, email, password_hash, nickname) VALUES (?, ?, ?, ?)');
      const info = stmt.run(username, email, hashedPassword, nickname || username);
      res.status(201).json({ id: info.lastInsertRowid, username, email });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const validPassword = bcrypt.compareSync(password, user.password_hash);
      if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, avatar_url: user.avatar_url, role: user.role } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auth: Me
  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    try {
      const user = db.prepare('SELECT id, username, email, nickname, avatar_url, role FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Upload file
  app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ file_url: `/uploads/${req.file.filename}` });
  });

  app.post('/api/upload/multiple', authenticateToken, upload.array('files', 50), (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    res.json({ file_urls: files.map((file) => `/uploads/${file.filename}`) });
  });

  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `文件过大，请上传 ${maxUploadMb}MB 以内的图片` });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(500).json({ error: err.message || '服务器错误' });
    }
    next();
  });

  // Timeline
  app.get('/api/timeline', authenticateToken, (req, res) => {
    try {
      const events = db.prepare('SELECT * FROM timeline_events ORDER BY event_date DESC').all();
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/timeline', authenticateToken, (req, res) => {
    const { title, description, event_date, location, mood, tags, cover_image_url, is_pinned } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO timeline_events (title, description, event_date, location, mood, tags, cover_image_url, is_pinned, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(title, description, event_date, location, mood, JSON.stringify(tags || []), cover_image_url, is_pinned ? 1 : 0, (req as any).user.id);
      const event = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(event);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.put('/api/timeline/:id', authenticateToken, (req, res) => {
    const { title, description, event_date, location, mood, tags, cover_image_url, is_pinned } = req.body;
    try {
      db.prepare(`
        UPDATE timeline_events
        SET title = ?, description = ?, event_date = ?, location = ?, mood = ?, tags = ?, cover_image_url = ?, is_pinned = ?
        WHERE id = ?
      `).run(title, description, event_date, location, mood, JSON.stringify(tags || []), cover_image_url, is_pinned ? 1 : 0, req.params.id);
      const event = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.id);
      res.json(event);
    } catch(err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/timeline/:id', authenticateToken, (req, res) => {
    try {
       db.prepare('DELETE FROM timeline_events WHERE id = ?').run(req.params.id);
       res.json({ success: true });
    } catch(err: any) {
       res.status(500).json({ error: err.message });
    }
  });

  // Photos & Albums
  const normalizePage = (value: any, fallback: number, max = 100) => {
    const parsed = Number(value || fallback);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(max, Math.floor(parsed)));
  };
  const albumOwnerWhere = (req: any) => 'created_by IS NULL OR created_by = ' + Number(req.user.id);

  app.get('/api/albums', authenticateToken, (req: any, res) => {
    try {
      const page = normalizePage(req.query.page, 1, 9999);
      const pageSize = normalizePage(req.query.page_size, 24, 100);
      const offset = (page - 1) * pageSize;
      const where = albumOwnerWhere(req);
      const total = (db.prepare(`SELECT COUNT(*) AS count FROM albums WHERE ${where}`).get() as any).count;
      const albums = db.prepare(`
        SELECT albums.*,
               COUNT(photos.id) AS photo_count,
               COALESCE(MAX(photos.updated_at), albums.updated_at, albums.created_at) AS last_photo_updated_at,
               COALESCE(
                 albums.cover_image_url,
                 (SELECT p.thumbnail_url FROM photos p WHERE p.album_id = albums.id ORDER BY p.id ASC LIMIT 1),
                 (SELECT p.image_url FROM photos p WHERE p.album_id = albums.id ORDER BY p.id ASC LIMIT 1)
               ) AS cover_thumbnail_url
        FROM albums
        LEFT JOIN photos ON photos.album_id = albums.id
        WHERE ${where}
        GROUP BY albums.id
        ORDER BY datetime(COALESCE(albums.updated_at, albums.created_at)) DESC, albums.id DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset);
      res.json({ items: albums, total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/albums', authenticateToken, (req: any, res) => {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name) return res.status(400).json({ error: '相册名称不能为空' });
    if (name.length > 50) return res.status(400).json({ error: '相册名称不能超过 50 个字符' });
    try {
      const duplicate = db.prepare('SELECT id FROM albums WHERE created_by = ? AND lower(name) = lower(?)').get(req.user.id, name);
      if (duplicate) return res.status(409).json({ error: '同一用户下相册名称不建议重复，请换一个名称' });
      const info = db.prepare('INSERT INTO albums (name, description, created_by) VALUES (?, ?, ?)').run(name, description, req.user.id);
      const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(album);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/albums/:id', authenticateToken, (req: any, res) => {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    if (!name) return res.status(400).json({ error: '相册名称不能为空' });
    if (name.length > 50) return res.status(400).json({ error: '相册名称不能超过 50 个字符' });
    try {
      const album = db.prepare(`SELECT * FROM albums WHERE id = ? AND (${albumOwnerWhere(req)})`).get(req.params.id);
      if (!album) return res.status(404).json({ error: '相册不存在' });
      const duplicate = db.prepare('SELECT id FROM albums WHERE created_by = ? AND lower(name) = lower(?) AND id != ?').get(req.user.id, name, req.params.id);
      if (duplicate) return res.status(409).json({ error: '同一用户下相册名称不建议重复，请换一个名称' });
      db.prepare('UPDATE albums SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, description, req.params.id);
      res.json(db.prepare('SELECT * FROM albums WHERE id = ?').get(req.params.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/albums/:id', authenticateToken, (req: any, res) => {
    try {
      const album = db.prepare(`SELECT * FROM albums WHERE id = ? AND (${albumOwnerWhere(req)})`).get(req.params.id);
      if (!album) return res.status(404).json({ error: '相册不存在' });
      const photos = db.prepare('SELECT image_url, thumbnail_url FROM photos WHERE album_id = ?').all(req.params.id) as any[];
      const removeAlbum = db.transaction(() => {
        db.prepare('DELETE FROM photos WHERE album_id = ?').run(req.params.id);
        db.prepare('DELETE FROM albums WHERE id = ?').run(req.params.id);
      });
      removeAlbum();
      for (const photo of photos) {
        unlinkIfExists(photo.image_url);
        unlinkIfExists(photo.thumbnail_url);
      }
      res.json({ success: true, deleted_photos: photos.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/albums/:id/photos', authenticateToken, (req: any, res) => {
    try {
      const album = db.prepare(`SELECT * FROM albums WHERE id = ? AND (${albumOwnerWhere(req)})`).get(req.params.id);
      if (!album) return res.status(404).json({ error: '相册不存在' });
      const page = normalizePage(req.query.page, 1, 9999);
      const pageSize = normalizePage(req.query.page_size, 30, 100);
      const offset = (page - 1) * pageSize;
      const total = (db.prepare('SELECT COUNT(*) AS count FROM photos WHERE album_id = ?').get(req.params.id) as any).count;
      const photos = db.prepare(`
        SELECT id, album_id, title, description, thumbnail_url, image_url, taken_date, location, is_favorite,
               file_size, width, height, created_at, updated_at
        FROM photos
        WHERE album_id = ?
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(req.params.id, pageSize, offset);
      res.json({ album, items: photos, total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/photos', authenticateToken, (req: any, res) => {
    try {
      const page = normalizePage(req.query.page, 1, 9999);
      const pageSize = normalizePage(req.query.page_size, 30, 100);
      const offset = (page - 1) * pageSize;
      const total = (db.prepare('SELECT COUNT(*) AS count FROM photos').get() as any).count;
      const photos = db.prepare(`
        SELECT photos.id, photos.album_id, photos.title, photos.description, photos.thumbnail_url, photos.image_url,
               photos.taken_date, photos.location, photos.is_favorite, photos.file_size, photos.created_at, photos.updated_at,
               albums.name AS album_name, albums.cover_image_url AS album_cover_image_url, albums.created_at AS album_created_at
        FROM photos
        LEFT JOIN albums ON albums.id = photos.album_id
        ORDER BY photos.created_at DESC, photos.id DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset);
      res.json({ items: photos, total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/photos/:id', authenticateToken, (req, res) => {
    try {
      const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
      if (!photo) return res.status(404).json({ error: '照片不存在' });
      res.json(photo);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/albums/:id/photos', authenticateToken, albumUpload.fields([{ name: 'files', maxCount: 50 }, { name: 'thumbnails', maxCount: 50 }]), (req: any, res) => {
    try {
      const album = db.prepare(`SELECT * FROM albums WHERE id = ? AND (${albumOwnerWhere(req)})`).get(req.params.id);
      if (!album) return res.status(404).json({ error: '相册不存在' });
      const files = ((req.files?.files || []) as Express.Multer.File[]);
      const thumbnails = ((req.files?.thumbnails || []) as Express.Multer.File[]);
      if (files.length === 0) return res.status(400).json({ error: '请选择要上传的图片' });
      if (files.length > 50) return res.status(400).json({ error: '单次最多上传 50 张图片' });

      const successes: any[] = [];
      const failures: any[] = [];
      const insertPhoto = db.prepare(`
        INSERT INTO photos (album_id, title, image_url, thumbnail_url, original_filename, mime_type, file_size, taken_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!isAllowedImage(file)) {
          unlinkIfExists(fileUrl(file.path));
          failures.push({ name: file.originalname, error: '仅支持 jpg、jpeg、png、webp、gif 图片格式' });
          continue;
        }
        const thumbnailUrl = createThumbnailForFile(file, thumbnails[index]);
        const imageUrl = fileUrl(file.path);
        const info = insertPhoto.run(req.params.id, path.parse(file.originalname).name, imageUrl, thumbnailUrl, file.originalname, file.mimetype, file.size, req.body.taken_date || null);
        successes.push(db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid));
      }
      if (successes.length > 0) {
        const firstThumb = successes[0].thumbnail_url || successes[0].image_url;
        db.prepare('UPDATE albums SET cover_image_url = COALESCE(cover_image_url, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(firstThumb, req.params.id);
      }
      res.status(successes.length ? 201 : 400).json({ uploaded: successes, failures });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/photos', authenticateToken, (req: any, res) => {
    const { album_id, album_name, title, description, image_url, thumbnail_url, taken_date, location, is_favorite, photos } = req.body;
    try {
      const insertPhoto = db.prepare(`
        INSERT INTO photos (album_id, title, description, image_url, thumbnail_url, taken_date, location, is_favorite)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      if (Array.isArray(photos) && photos.length > 0) {
        const createAlbum = db.prepare('INSERT INTO albums (name, description, cover_image_url, created_by) VALUES (?, ?, ?, ?)');
        const albumInfo = createAlbum.run(album_name || title || '未命名相册', description, photos[0].thumbnail_url || photos[0].image_url, req.user.id);
        const createdAlbumId = Number(albumInfo.lastInsertRowid);

        const createPhotos = db.transaction(() => {
          for (const photo of photos) {
            insertPhoto.run(createdAlbumId, photo.title || title || '', photo.description || description, photo.image_url, photo.thumbnail_url || photo.image_url, photo.taken_date || taken_date, photo.location || location, photo.is_favorite ? 1 : 0);
          }
        });
        createPhotos();

        const createdPhotos = db.prepare('SELECT * FROM photos WHERE album_id = ? ORDER BY id ASC').all(createdAlbumId);
        const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(createdAlbumId);
        return res.status(201).json({ album, photos: createdPhotos });
      }

      let targetAlbumId = album_id;
      if (!targetAlbumId) {
        const albumInfo = db.prepare('INSERT INTO albums (name, description, cover_image_url, created_by) VALUES (?, ?, ?, ?)')
          .run(album_name || title || '未命名相册', description, thumbnail_url || image_url, req.user.id);
        targetAlbumId = Number(albumInfo.lastInsertRowid);
      }

      const info = insertPhoto.run(targetAlbumId, title, description, image_url, thumbnail_url || image_url, taken_date, location, is_favorite ? 1 : 0);
      db.prepare('UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetAlbumId);
      const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(photo);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/photos/:id', authenticateToken, (req, res) => {
    const { album_id, title, description, image_url, thumbnail_url, taken_date, location, is_favorite } = req.body;
    try {
      db.prepare(`
        UPDATE photos
        SET album_id = ?, title = ?, description = ?, image_url = ?, thumbnail_url = ?, taken_date = ?, location = ?, is_favorite = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(album_id, title, description, image_url, thumbnail_url || image_url, taken_date, location, is_favorite ? 1 : 0, req.params.id);
      const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
      res.json(photo);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/photos/:id', authenticateToken, (req, res) => {
    try {
      const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id) as any;
      if (!photo) return res.status(404).json({ error: '照片不存在' });
      db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
      db.prepare('UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(photo.album_id);
      unlinkIfExists(photo.image_url);
      unlinkIfExists(photo.thumbnail_url);
      res.json({ success: true });
    } catch(err: any) {
       res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/photos/bulk-delete', authenticateToken, (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    if (ids.length === 0) return res.status(400).json({ error: '请选择要删除的照片' });
    try {
      const placeholders = ids.map(() => '?').join(',');
      const photos = db.prepare(`SELECT * FROM photos WHERE id IN (${placeholders})`).all(...ids) as any[];
      const deletePhotos = db.transaction(() => {
        db.prepare(`DELETE FROM photos WHERE id IN (${placeholders})`).run(...ids);
      });
      deletePhotos();
      for (const photo of photos) {
        unlinkIfExists(photo.image_url);
        unlinkIfExists(photo.thumbnail_url);
      }
      res.json({ success: true, deleted: photos.length });
    } catch(err: any) {
       res.status(500).json({ error: err.message });
    }
  });

  // Blog Posts
  app.get('/api/posts', authenticateToken, (req, res) => {
    try {
      const posts = db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all();
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/posts/:id', authenticateToken, (req, res) => {
    try {
      const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(req.params.id);
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/posts', authenticateToken, (req, res) => {
    const { title, summary, content_markdown, cover_image_url, tags, status } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO blog_posts (title, summary, content_markdown, cover_image_url, tags, status, author_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(title, summary, content_markdown, cover_image_url, JSON.stringify(tags || []), status || 'draft', (req as any).user.id);
      const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(post);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/posts/:id', authenticateToken, (req, res) => {
    const { title, summary, content_markdown, cover_image_url, tags, status } = req.body;
    try {
      db.prepare(`
        UPDATE blog_posts
        SET title = ?, summary = ?, content_markdown = ?, cover_image_url = ?, tags = ?, status = ?
        WHERE id = ?
      `).run(title, summary, content_markdown, cover_image_url, JSON.stringify(tags || []), status || 'draft', req.params.id);
      const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(req.params.id);
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/posts/:id', authenticateToken, (req, res) => {
    try {
      db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // Comments
  const listComments = (req: any, res: any) => {
    const { target_type, target_id } = req.query;
    if (!target_type || !target_id) return res.status(400).json({ error: 'target_type and target_id are required' });
    try {
      const comments = db.prepare(`
        SELECT c.*, u.nickname as author_nickname, COALESCE(NULLIF(u.nickname, ''), u.username, '匿名') as author_display_name
        FROM comments c
        LEFT JOIN users u ON u.id = c.created_by
        WHERE c.target_type = ? AND c.target_id = ?
        ORDER BY c.created_at ASC
      `).all(target_type, target_id);
      res.json(comments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  const createComment = (req: any, res: any) => {
    const { target_type, target_id, parent_id, content } = req.body;
    const normalizedTargetId = Number(target_id);
    const normalizedParentId = parent_id ? Number(parent_id) : null;
    const normalizedContent = String(content || '').trim();
    if (!target_type || !Number.isInteger(normalizedTargetId) || !normalizedContent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      const stmt = db.prepare(`
        INSERT INTO comments (target_type, target_id, parent_id, content, created_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      const info = stmt.run(target_type, normalizedTargetId, normalizedParentId, normalizedContent, req.user.id);
      const comment = db.prepare(`
        SELECT c.*, u.nickname as author_nickname, COALESCE(NULLIF(u.nickname, ''), u.username, '匿名') as author_display_name
        FROM comments c
        LEFT JOIN users u ON u.id = c.created_by
        WHERE c.id = ?
      `).get(info.lastInsertRowid);
      res.status(201).json(comment);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  // Keep both /api/comments and /comments for compatibility across environments.
  app.get(['/api/comments', '/comments'], authenticateToken, listComments);
  app.post(['/api/comments', '/comments'], authenticateToken, createComment);

  // Anniversaries
  app.get('/api/anniversaries', authenticateToken, (req, res) => {
    try {
      const annivs = db.prepare('SELECT * FROM anniversaries ORDER BY date ASC').all();
      res.json(annivs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/anniversaries', authenticateToken, (req, res) => {
    const { title, date, description, repeat_yearly } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO anniversaries (title, date, description, repeat_yearly) VALUES (?, ?, ?, ?)');
      const info = stmt.run(title, date, description, repeat_yearly ? 1 : 0);
      const anniv = db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(anniv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/anniversaries/:id', authenticateToken, (req, res) => {
    const { title, date, description, repeat_yearly } = req.body;
    try {
      const stmt = db.prepare('UPDATE anniversaries SET title = ?, date = ?, description = ?, repeat_yearly = ? WHERE id = ?');
      stmt.run(title, date, description, repeat_yearly ? 1 : 0, req.params.id);
      const anniv = db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(req.params.id);
      res.json(anniv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/anniversaries/:id', authenticateToken, (req, res) => {
    try {
      db.prepare('DELETE FROM anniversaries WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create demo data if empty
  const usersCount = db.prepare("SELECT count(*) as c FROM users").get() as any;
  if (usersCount.c === 0) {
    console.log("Seeding initial data...");
    const hp = bcrypt.hashSync('123456', 10);
    db.prepare('INSERT INTO users (username, email, password_hash, nickname, role) VALUES (?, ?, ?, ?, ?)').run(
      'admin', 'admin@example.com', hp, 'Admin', 'owner'
    );
    const userId = db.prepare("SELECT id FROM users LIMIT 1").get() as any;
    const uid = userId.id;
    
  // Anniversaries
    db.prepare('INSERT INTO anniversaries (title, date, description) VALUES (?, ?, ?)')
      .run('First Meet', '2023-05-20', 'The day we met in Tokyo');
      
    // Timeline
    db.prepare('INSERT INTO timeline_events (title, event_date, location, mood, is_pinned, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run('Moved in together!', '2024-01-01', 'Our Apartment', 'Happy', 1, uid);
      
    // Blog 
    db.prepare('INSERT INTO blog_posts (title, summary, content_markdown, status, author_id) VALUES (?, ?, ?, ?, ?)')
      .run('Our First Trip', 'A wonderful time in Japan', '# Japan Trip\nWe visited so many beautiful places!', 'published', uid);
  }

  // Ensure default users chengfeifan and gaoyisai exist
  const ensureUser = (username: string, nickname: string, role: string = 'user') => {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      const hp = bcrypt.hashSync('saisai', 10);
      db.prepare('INSERT INTO users (username, email, password_hash, nickname, role) VALUES (?, ?, ?, ?, ?)').run(
        username, username + '@example.com', hp, nickname, role
      );
    } else {
      db.prepare('UPDATE users SET role = ? WHERE username = ?').run(role, username);
    }
  };
  ensureUser('chengfeifan', 'Cheng Feifan', 'admin');
  ensureUser('gaoyisai', 'Gao Yisai', 'admin');

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
