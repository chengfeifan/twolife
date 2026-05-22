import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
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
  const upload = multer({
    storage,
    limits: { fileSize: maxUploadBytes },
  });

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
  app.get('/api/albums', authenticateToken, (req, res) => {
    try {
      const albums = db.prepare('SELECT * FROM albums ORDER BY created_at DESC').all();
      res.json(albums);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/albums', authenticateToken, (req, res) => {
    const { name, description, cover_image_url } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO albums (name, description, cover_image_url) VALUES (?, ?, ?)');
      const info = stmt.run(name, description, cover_image_url);
      const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(album);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/photos', authenticateToken, (req, res) => {
    try {
      const photos = db.prepare('SELECT * FROM photos ORDER BY created_at DESC').all();
      res.json(photos);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/photos', authenticateToken, (req, res) => {
    const { album_id, title, description, image_url, taken_date, location, is_favorite } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO photos (album_id, title, description, image_url, taken_date, location, is_favorite)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(album_id, title, description, image_url, taken_date, location, is_favorite ? 1 : 0);
      const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(photo);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/photos/:id', authenticateToken, (req, res) => {
    const { album_id, title, description, image_url, taken_date, location, is_favorite } = req.body;
    try {
      db.prepare(`
        UPDATE photos
        SET album_id = ?, title = ?, description = ?, image_url = ?, taken_date = ?, location = ?, is_favorite = ?
        WHERE id = ?
      `).run(album_id, title, description, image_url, taken_date, location, is_favorite ? 1 : 0, req.params.id);
      const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
      res.json(photo);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/photos/:id', authenticateToken, (req, res) => {
    try {
       db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
       res.json({ success: true });
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
  app.get('/api/comments', authenticateToken, (req: any, res) => {
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
  });

  app.post('/api/comments', authenticateToken, (req: any, res) => {
    const { target_type, target_id, parent_id, content } = req.body;
    if (!target_type || !target_id || !content) return res.status(400).json({ error: 'Missing required fields' });
    try {
      const stmt = db.prepare(`
        INSERT INTO comments (target_type, target_id, parent_id, content, created_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      const info = stmt.run(target_type, target_id, parent_id || null, content, req.user.id);
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
  });

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
    
  
  // Comments
  app.get('/api/comments', authenticateToken, (req: any, res) => {
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
  });

  app.post('/api/comments', authenticateToken, (req: any, res) => {
    const { target_type, target_id, parent_id, content } = req.body;
    if (!target_type || !target_id || !content) return res.status(400).json({ error: 'Missing required fields' });
    try {
      const stmt = db.prepare(`
        INSERT INTO comments (target_type, target_id, parent_id, content, created_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      const info = stmt.run(target_type, target_id, parent_id || null, content, req.user.id);
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
  });

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
