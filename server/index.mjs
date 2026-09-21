import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const port = Number(process.env.PORT ?? 8787);
const databasePath = process.env.DATABASE_PATH ?? join(process.cwd(), 'naprock', 'bandflow.db');
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('worker', 'boss')) DEFAULT 'worker',
    status TEXT NOT NULL CHECK (status IN ('active', 'away', 'offline')) DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS work_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT NOT NULL CHECK (status IN ('In Progress', 'Review', 'Done')) DEFAULT 'In Progress',
    progress INTEGER NOT NULL DEFAULT 0,
    due TEXT NOT NULL DEFAULT 'Unscheduled',
    subtasks TEXT NOT NULL DEFAULT '[]',
    assigned_to TEXT NOT NULL REFERENCES users(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
if (!userColumns.includes('status')) {
  db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'away', 'offline'))");
}
const workColumns = db.prepare('PRAGMA table_info(work_items)').all().map((column) => column.name);
if (!workColumns.includes('subtasks')) {
  db.exec("ALTER TABLE work_items ADD COLUMN subtasks TEXT NOT NULL DEFAULT '[]'");
}

const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  response.end(JSON.stringify(body));
};
const readBody = async (request) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
};
const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
const verifyPassword = (password, stored) => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
};
const createSession = (userId) => {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + 1000 * 60 * 60 * 24 * 30);
  return token;
};
const getUser = (request) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return db.prepare(`SELECT users.id, users.email, users.full_name, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?`).get(token, Date.now()) ?? null;
};
const requireUser = (request, response) => {
  const user = getUser(request);
  if (!user) json(response, 401, { error: 'Sign in required.' });
  return user;
};

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true });

    if (request.method === 'POST' && url.pathname === '/auth/signup') {
      const { email, password, fullName } = await readBody(request);
      if (!email?.trim() || !password || !fullName?.trim()) return json(response, 400, { error: 'Full name, email, and password are required.' });
      const id = randomUUID();
      db.prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').run(id, email.trim().toLowerCase(), hashPassword(password), fullName.trim(), 'worker');
      return json(response, 201, { ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      const { email, password } = await readBody(request);
      const user = db.prepare('SELECT id, email, password_hash, full_name, role FROM users WHERE email = ?').get(email?.trim().toLowerCase());
      if (!user || !verifyPassword(password ?? '', user.password_hash)) return json(response, 401, { error: 'Invalid email or password.' });
      return json(response, 200, { token: createSession(user.id), user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
    }

    if (request.method === 'GET' && url.pathname === '/workers') {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can view worker details.' });
      const workers = db.prepare("SELECT id, full_name AS name, email, role, status, created_at FROM users WHERE role = 'worker' ORDER BY full_name").all();
      return json(response, 200, workers);
    }

    if (request.method === 'PATCH' && url.pathname.startsWith('/workers/')) {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can edit worker status.' });
      const workerId = url.pathname.slice('/workers/'.length);
      const { status } = await readBody(request);
      if (!['active', 'away', 'offline'].includes(status)) return json(response, 400, { error: 'Status must be active, away, or offline.' });
      const result = db.prepare("UPDATE users SET status = ? WHERE id = ? AND role = 'worker'").run(status, workerId);
      if (!result.changes) return json(response, 404, { error: 'Worker not found.' });
      return json(response, 200, { id: workerId, status });
    }

    if (request.method === 'GET' && url.pathname === '/work') {
      const user = requireUser(request, response);
      if (!user) return;
      const rows = user.role === 'boss'
        ? db.prepare(`SELECT work_items.id, work_items.title, work_items.priority, work_items.status, work_items.progress, work_items.due, work_items.subtasks, users.full_name AS assigned_to FROM work_items JOIN users ON users.id = work_items.assigned_to ORDER BY work_items.created_at DESC`).all()
        : db.prepare(`SELECT work_items.id, work_items.title, work_items.priority, work_items.status, work_items.progress, work_items.due, work_items.subtasks, users.full_name AS assigned_to FROM work_items JOIN users ON users.id = work_items.assigned_to WHERE work_items.assigned_to = ? ORDER BY work_items.created_at DESC`).all(user.id);
      return json(response, 200, rows);
    }

    if (request.method === 'PATCH' && url.pathname.startsWith('/work/')) {
      const user = requireUser(request, response);
      if (!user) return;
      const workId = url.pathname.slice('/work/'.length);
      const { status } = await readBody(request);
      if (!['In Progress', 'Review', 'Done'].includes(status)) return json(response, 400, { error: 'Invalid work status.' });
      const work = db.prepare('SELECT id, assigned_to FROM work_items WHERE id = ?').get(workId);
      if (!work) return json(response, 404, { error: 'Work item not found.' });
      if (user.role !== 'boss' && work.assigned_to !== user.id) return json(response, 403, { error: 'You can only update work assigned to you.' });
      db.prepare('UPDATE work_items SET status = ?, progress = CASE WHEN ? = \'Done\' THEN 100 ELSE progress END WHERE id = ?').run(status, status, workId);
      return json(response, 200, { id: workId, status });
    }

    if (request.method === 'POST' && url.pathname === '/work') {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can assign work.' });
      const { title, priority = 'Medium', due = 'Unscheduled', subtasks = [], assignedTo } = await readBody(request);
      const worker = db.prepare("SELECT id FROM users WHERE role = 'worker' AND (id = ? OR full_name = ?)").get(assignedTo, assignedTo);
      if (!title?.trim() || !worker || !Array.isArray(subtasks) || subtasks.some((item) => typeof item !== 'string')) return json(response, 400, { error: 'A title, valid worker, and valid subtasks are required.' });
      const id = randomUUID();
      const cleanSubtasks = subtasks.map((item) => item.trim()).filter(Boolean);
      db.prepare('INSERT INTO work_items (id, title, priority, due, subtasks, assigned_to, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, title.trim(), priority, due.trim() || 'Unscheduled', JSON.stringify(cleanSubtasks), worker.id, user.id);
      return json(response, 201, { id, title: title.trim(), priority, status: 'In Progress', progress: 0, due: due.trim() || 'Unscheduled', subtasks: cleanSubtasks, assignedTo: worker.id });
    }

    return json(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'An account with that email already exists.' : 'Server error.' });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`BandFlow SQLite API listening on http://0.0.0.0:${port}`));
