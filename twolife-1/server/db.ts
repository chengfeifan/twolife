import sqlite3 from 'better-sqlite3';
import path from 'path';

// Using a file-based SQLite database
const dbPath = path.resolve(process.cwd(), 'database.sqlite');
const db = new sqlite3(dbPath, { verbose: console.log });

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'partner',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATETIME NOT NULL,
    location TEXT,
    mood TEXT,
    tags TEXT,
    cover_image_url TEXT,
    is_pinned BOOLEAN DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER,
    title TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    taken_date DATETIME,
    location TEXT,
    is_favorite BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(album_id) REFERENCES albums(id)
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    content_markdown TEXT NOT NULL,
    cover_image_url TEXT,
    tags TEXT,
    status TEXT DEFAULT 'draft',
    author_id INTEGER NOT NULL,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS anniversaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date DATETIME NOT NULL,
    description TEXT,
    repeat_yearly BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theme_color TEXT DEFAULT 'pink',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const ensureSettingsColumn = (columnName: string, definition: string) => {
  const columns = db.prepare("PRAGMA table_info(settings)").all() as Array<{ name: string }>;
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE settings ADD COLUMN ${columnName} ${definition}`);
  }
};

ensureSettingsColumn('about_title', "TEXT DEFAULT 'TwoLife 双人宇宙'");
ensureSettingsColumn('about_subtitle', "TEXT DEFAULT '版本号 1.0.0'");
ensureSettingsColumn('about_description', "TEXT DEFAULT '一个私密的二人数字空间，用来珍藏关于时间、照片和文字的美好记忆。'");

export default db;
