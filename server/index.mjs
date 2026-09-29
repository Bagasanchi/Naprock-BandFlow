import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, minPasswordLength, verifyPassword } from './passwords.mjs';

const port = Number(process.env.PORT ?? 8787);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const databasePath = process.env.DATABASE_PATH ?? process.env.BAND_FLOW_DB_PATH ?? join(projectRoot, 'data', 'bandflow.sqlite');
const bleBridgeUrl = (process.env.BLE_BRIDGE_URL ?? 'http://127.0.0.1:5000/v1/dispatch').replace(/\/$/, '');
const bridgeApiVersion = 'v1';
const internalToken = process.env.BLE_INTERNAL_TOKEN ?? '';
const aiBreakdownUrl = (process.env.AI_BREAKDOWN_URL ?? '').replace(/\/$/, '');
const aiClassificationUrl = (process.env.AI_CLASSIFICATION_URL ?? '').replace(/\/$/, '');

mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const tableExists = (name) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
const tableColumns = (name) => tableExists(name) ? db.prepare(`PRAGMA table_info(${name})`).all().map((column) => column.name) : [];
const hasLegacyPythonTaskSchema = tableColumns('tasks').includes('description') && !tableColumns('tasks').includes('title');
if (hasLegacyPythonTaskSchema) {
  if (tableExists('subtasks') && !tableColumns('subtasks').includes('completed_at')) db.exec('ALTER TABLE subtasks RENAME TO legacy_python_subtasks');
  db.exec('ALTER TABLE tasks RENAME TO legacy_python_tasks');
}

const allowed = {
  priorities: ['Low', 'Medium', 'High'],
  workStatuses: ['In Progress', 'Review', 'Done'],
  eventTypes: ['task_received', 'task_started', 'subtask_started', 'task_completed', 'subtask_completed', 'voice_recorded'],
  eisenhower: ['do_first', 'schedule', 'delegate', 'eliminate'],
};

db.exec(`
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
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT NOT NULL CHECK (status IN ('In Progress', 'Review', 'Done')) DEFAULT 'In Progress',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    due TEXT NOT NULL DEFAULT 'Unscheduled',
    eisenhower_category TEXT CHECK (eisenhower_category IN ('do_first', 'schedule', 'delegate', 'eliminate')),
    assigned_to TEXT NOT NULL REFERENCES users(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'done')) DEFAULT 'pending',
    depends_on TEXT REFERENCES subtasks(id) ON DELETE SET NULL,
    order_index INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT,
    UNIQUE (task_id, order_index)
  );
  CREATE TABLE IF NOT EXISTS sync_events (
    event_id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    subtask_id TEXT REFERENCES subtasks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('task_received', 'task_started', 'subtask_started', 'task_completed', 'subtask_completed', 'voice_recorded')),
    created_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'received' CHECK (sync_status IN ('queued', 'received', 'acknowledged')),
    payload TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS voice_records (
    id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    file_id TEXT NOT NULL,
    file_path TEXT,
    processing_status TEXT NOT NULL DEFAULT 'queued' CHECK (processing_status IN ('queued', 'processing', 'complete', 'failed')),
    transcript TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT
  );
`);

const columnExists = (table, name) => Boolean(db.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === name));
const withTransaction = (operation) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

// Preserve existing accounts and work_items data while making tasks/subtasks the
// only application model used by the API from this point forward.
if (tableExists('users') && !columnExists('users', 'status')) {
  db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'away', 'offline'))");
}
// Profile fields edited from the app's Profile screen (avatar holds a small JPEG data URI), and
// the time a worker asked their boss for a password reset from the "Forgot password?" page.
for (const column of ['phone', 'job_title', 'avatar', 'password_reset_requested_at']) {
  if (!columnExists('users', column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
}
if (tableExists('work_items')) {
  const legacyRows = db.prepare('SELECT id, title, priority, status, progress, due, subtasks, assigned_to, created_by, created_at FROM work_items').all();
  const insertTask = db.prepare(`INSERT OR IGNORE INTO tasks (id, title, priority, status, progress, due, assigned_to, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertSubtask = db.prepare(`INSERT OR IGNORE INTO subtasks (id, task_id, description, status, order_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const migrateLegacy = () => {
    for (const row of legacyRows) {
      insertTask.run(row.id, row.title, allowed.priorities.includes(row.priority) ? row.priority : 'Medium', allowed.workStatuses.includes(row.status) ? row.status : 'In Progress', Math.max(0, Math.min(100, Number(row.progress) || 0)), row.due || 'Unscheduled', row.assigned_to, row.created_by, row.created_at ?? new Date().toISOString(), row.created_at ?? new Date().toISOString());
      if (db.prepare('SELECT 1 FROM subtasks WHERE task_id = ? LIMIT 1').get(row.id)) continue;
      let descriptions = [];
      try {
        const parsed = JSON.parse(row.subtasks ?? '[]');
        descriptions = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [];
      } catch {
        descriptions = [];
      }
      descriptions.forEach((description, index) => insertSubtask.run(randomUUID(), row.id, description, row.status === 'Done' ? 'done' : 'pending', index + 1, row.created_at ?? new Date().toISOString()));
    }
    // Import once only: renaming the table keeps the old rows for reference but stops them
    // from being copied back into tasks on the next start after someone deletes them.
    db.exec('ALTER TABLE work_items RENAME TO imported_work_items');
  };
  withTransaction(migrateLegacy);
}

// The original Flask database used integer tasks/subtasks without an owner.
// Import those records into the Node-owned schema when an application user is
// available, keeping stable legacy IDs and preserving dependency links.
if (tableExists('legacy_python_tasks')) {
  const legacyTasks = db.prepare('SELECT id, description, created_at FROM legacy_python_tasks ORDER BY id').all();
  const legacySubtasks = tableExists('legacy_python_subtasks')
    ? db.prepare('SELECT id, task_id, description, status, depends_on, order_index, created_at, started_at FROM legacy_python_subtasks ORDER BY task_id, order_index').all()
    : [];
  const owner = db.prepare("SELECT id FROM users ORDER BY CASE role WHEN 'boss' THEN 0 ELSE 1 END, created_at LIMIT 1").get();
  if (owner) {
    const insertTask = db.prepare(`INSERT OR IGNORE INTO tasks (id, title, priority, status, progress, due, assigned_to, created_by, created_at, updated_at)
      VALUES (?, ?, 'Medium', ?, ?, 'Unscheduled', ?, ?, ?, ?)`);
    const insertSubtask = db.prepare(`INSERT OR IGNORE INTO subtasks (id, task_id, description, status, depends_on, order_index, created_at, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const migratePython = () => {
      for (const task of legacyTasks) {
        const taskSubtasks = legacySubtasks.filter((subtask) => subtask.task_id === task.id);
        const doneCount = taskSubtasks.filter((subtask) => subtask.status === 'done').length;
        const progress = taskSubtasks.length ? Math.round((doneCount / taskSubtasks.length) * 100) : 0;
        const status = progress === 100 ? 'Done' : 'In Progress';
        const taskId = `legacy-python-task-${task.id}`;
        insertTask.run(taskId, task.description, status, progress, owner.id, owner.id, task.created_at ?? new Date().toISOString(), task.created_at ?? new Date().toISOString());
        for (const subtask of taskSubtasks) {
          const subtaskId = `legacy-python-subtask-${subtask.id}`;
          const dependsOn = subtask.depends_on == null ? null : `legacy-python-subtask-${subtask.depends_on}`;
          insertSubtask.run(subtaskId, taskId, subtask.description, ['pending', 'active', 'done'].includes(subtask.status) ? subtask.status : 'pending', dependsOn, subtask.order_index, subtask.created_at ?? task.created_at ?? new Date().toISOString(), subtask.started_at ?? null, subtask.status === 'done' ? subtask.created_at ?? null : null);
        }
      }
      // Import once only, for the same reason as work_items above.
      if (tableExists('legacy_python_subtasks')) db.exec('ALTER TABLE legacy_python_subtasks RENAME TO imported_python_subtasks');
      db.exec('ALTER TABLE legacy_python_tasks RENAME TO imported_python_tasks');
    };
    withTransaction(migratePython);
  }
}

const json = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-BandFlow-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  });
  response.end(JSON.stringify(body));
};

const readBody = async (request) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
};

const createSession = (userId) => {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + 1000 * 60 * 60 * 24 * 30);
  return token;
};

const getUser = (request) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return db.prepare(`SELECT users.id, users.email, users.full_name, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > ?`).get(token, Date.now()) ?? null;
};

const requireUser = (request, response) => {
  const user = getUser(request);
  if (!user) json(response, 401, { error: 'Sign in required.' });
  return user;
};

// node:sqlite reports every SQLite failure as ERR_SQLITE_ERROR; 2067 is SQLITE_CONSTRAINT_UNIQUE.
const isUniqueViolation = (error) => error?.errcode === 2067;

const maxAvatarLength = 2_000_000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s()-]{6,20}$/;

const readProfile = (userId) => {
  const row = db.prepare('SELECT id, email, full_name, role, phone, job_title, avatar, created_at FROM users WHERE id = ?').get(userId);
  return row && { id: row.id, email: row.email, fullName: row.full_name, role: row.role, phone: row.phone ?? '', jobTitle: row.job_title ?? '', avatar: row.avatar ?? null, createdAt: row.created_at };
};

const validationError = (message) => Object.assign(new Error(message), { status: 400 });

const updateProfile = (userId, { fullName, email, phone, jobTitle, avatar }) => {
  const current = readProfile(userId);
  const next = {
    fullName: fullName === undefined ? current.fullName : String(fullName).trim(),
    email: email === undefined ? current.email : String(email).trim().toLowerCase(),
    phone: phone === undefined ? current.phone : String(phone).trim(),
    jobTitle: jobTitle === undefined ? current.jobTitle : String(jobTitle).trim(),
    avatar: avatar === undefined ? current.avatar : avatar,
  };
  if (!next.fullName || next.fullName.length > 80) throw validationError('Full name must be between 1 and 80 characters.');
  if (!emailPattern.test(next.email)) throw validationError('Enter a valid email address.');
  if (next.phone && !phonePattern.test(next.phone)) throw validationError('Enter a valid phone number.');
  if (next.jobTitle.length > 60) throw validationError('Job title must be 60 characters or fewer.');
  if (next.avatar !== null && (typeof next.avatar !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(next.avatar) || next.avatar.length > maxAvatarLength)) {
    throw validationError('Profile picture must be a JPEG, PNG, or WebP image under 1.5 MB.');
  }
  try {
    db.prepare('UPDATE users SET full_name = ?, email = ?, phone = ?, job_title = ?, avatar = ? WHERE id = ?')
      .run(next.fullName, next.email, next.phone || null, next.jobTitle || null, next.avatar, userId);
  } catch (error) {
    if (isUniqueViolation(error)) throw Object.assign(new Error('An account with that email already exists.'), { status: 409 });
    throw error;
  }
  return readProfile(userId);
};

const requireInternal = (request, response) => {
  if (internalToken && request.headers['x-bandflow-token'] !== internalToken) {
    json(response, 401, { error: 'Internal token required.' });
    return false;
  }
  const requestVersion = request.headers['x-bandflow-bridge-version'];
  if (requestVersion && requestVersion !== bridgeApiVersion) {
    json(response, 426, { error: `Unsupported bridge contract ${requestVersion}; expected ${bridgeApiVersion}.` });
    return false;
  }
  return true;
};

const parseSubtasks = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === 'string') return { description: item.trim(), order_index: index + 1, depends_on_order_index: null };
    if (!item || typeof item !== 'object' || typeof item.description !== 'string') return null;
    const orderIndex = Number(item.order_index ?? index + 1);
    const dependsOnOrderIndex = item.depends_on_order_index == null ? null : Number(item.depends_on_order_index);
    if (!Number.isInteger(orderIndex) || orderIndex < 1 || (dependsOnOrderIndex != null && (!Number.isInteger(dependsOnOrderIndex) || dependsOnOrderIndex < 1))) return null;
    return { description: item.description.trim(), order_index: orderIndex, depends_on_order_index: dependsOnOrderIndex };
  }).filter((item) => item && item.description);
};

const fallbackBreakdown = (title, requestedSubtasks) => {
  const supplied = parseSubtasks(requestedSubtasks);
  if (supplied.length) return { title, subtasks: supplied };
  return { title, subtasks: [{ description: title, order_index: 1, depends_on_order_index: null }] };
};

const validateBreakdown = (result, fallbackTitle) => {
  if (!result || !Array.isArray(result.subtasks)) throw new Error('Structured breakdown must contain a subtasks array.');
  const subtasks = parseSubtasks(result.subtasks);
  const orderIndexes = new Set(subtasks.map((item) => item.order_index));
  if (!subtasks.length || subtasks.length !== result.subtasks.length || orderIndexes.size !== subtasks.length) throw new Error('Structured breakdown contains invalid subtasks.');
  if (subtasks.some((item) => item.depends_on_order_index != null && (item.depends_on_order_index === item.order_index || !orderIndexes.has(item.depends_on_order_index)))) {
    throw new Error('Structured breakdown contains an invalid dependency.');
  }
  return { title: typeof result.title === 'string' && result.title.trim() ? result.title.trim() : fallbackTitle, subtasks };
};

const requestAiBreakdown = async ({ title, priority, due, subtasks }) => {
  if (!aiBreakdownUrl) return fallbackBreakdown(title, subtasks);
  const response = await fetch(aiBreakdownUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.AI_BREAKDOWN_TOKEN ? { Authorization: `Bearer ${process.env.AI_BREAKDOWN_TOKEN}` } : {}) },
    body: JSON.stringify({ title, priority, due, subtasks: subtasks ?? [] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`AI breakdown service returned ${response.status}.`);
  const result = await response.json();
  return validateBreakdown(result, title);
};

const requestAiClassification = async ({ title, priority, due }) => {
  if (!aiClassificationUrl) return null;
  const response = await fetch(aiClassificationUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.AI_CLASSIFICATION_TOKEN ? { Authorization: `Bearer ${process.env.AI_CLASSIFICATION_TOKEN}` } : {}) },
    body: JSON.stringify({ title, priority, due }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`AI classification service returned ${response.status}.`);
  const result = await response.json();
  return allowed.eisenhower.includes(result.category) ? result.category : null;
};

const readSubtasks = (taskIds) => {
  if (!taskIds.length) return new Map();
  const placeholders = taskIds.map(() => '?').join(', ');
  const rows = db.prepare(`SELECT id, task_id, description, status, depends_on, order_index, started_at, completed_at
    FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY task_id, order_index`).all(...taskIds);
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.task_id)) grouped.set(row.task_id, []);
    grouped.get(row.task_id).push(row);
  }
  return grouped;
};

const listWork = (user) => {
  const rows = user.role === 'boss'
    ? db.prepare(`SELECT tasks.id, tasks.title, tasks.priority, tasks.status, tasks.progress, tasks.due, tasks.eisenhower_category,
        users.full_name AS assigned_to FROM tasks JOIN users ON users.id = tasks.assigned_to ORDER BY tasks.created_at DESC`).all()
    : db.prepare(`SELECT tasks.id, tasks.title, tasks.priority, tasks.status, tasks.progress, tasks.due, tasks.eisenhower_category,
        users.full_name AS assigned_to FROM tasks JOIN users ON users.id = tasks.assigned_to
        WHERE tasks.assigned_to = ? ORDER BY tasks.created_at DESC`).all(user.id);
  const grouped = readSubtasks(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, subtasks: (grouped.get(row.id) ?? []).map((subtask) => subtask.description), subtask_details: grouped.get(row.id) ?? [] }));
};

const findNextReadySubtask = (taskId) => db.prepare(`SELECT next.id, next.task_id, next.description, next.status, next.order_index
  FROM subtasks AS next LEFT JOIN subtasks AS dependency ON next.depends_on = dependency.id
  WHERE next.task_id = ? AND next.status = 'pending'
    AND (next.depends_on IS NULL OR dependency.status = 'done')
  ORDER BY next.order_index LIMIT 1`).get(taskId) ?? null;

const refreshTaskProgress = (taskId) => {
  const counts = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
    FROM subtasks WHERE task_id = ?`).get(taskId);
  const progress = counts.total ? Math.round((Number(counts.done ?? 0) / Number(counts.total)) * 100) : 0;
  db.prepare(`UPDATE tasks SET progress = ?, updated_at = CURRENT_TIMESTAMP,
    status = CASE WHEN ? = 100 THEN 'Done' ELSE status END,
    completed_at = CASE WHEN ? = 100 THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END
    WHERE id = ?`).run(progress, progress, progress, taskId);
  return progress;
};

const sendTaskToBand = async (assignment) => {
  if (!assignment) return { sent: false, error: 'No subtask was available to dispatch.' };
  try {
    const response = await fetch(bleBridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-BandFlow-Bridge-Version': bridgeApiVersion, ...(internalToken ? { 'X-BandFlow-Token': internalToken } : {}) },
      body: JSON.stringify({ ...assignment, bridge_api_version: bridgeApiVersion }),
      signal: AbortSignal.timeout(7000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { sent: false, error: body.error ?? `BLE bridge returned ${response.status}.` };
    return { sent: true, ...body };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'BLE bridge unavailable.' };
  }
};

const insertEvent = db.prepare(`INSERT OR IGNORE INTO sync_events
  (event_id, task_id, subtask_id, event_type, created_at, sync_status, payload)
  VALUES (?, ?, ?, ?, ?, 'received', ?)`);

const processBleEvent = (event) => {
  if (!event?.event_id || !allowed.eventTypes.includes(event.event_type)) throw new Error('Invalid BLE event.');
  const createdAt = typeof event.created_at === 'string' ? event.created_at : new Date().toISOString();
  const payload = JSON.stringify(event.payload ?? {});
  let duplicate = false;
  let next = null;
  const transaction = () => {
    const result = insertEvent.run(event.event_id, event.task_id ?? null, event.subtask_id ?? null, event.event_type, createdAt, payload);
    if (!result.changes) {
      duplicate = true;
      return;
    }
    if (event.event_type === 'subtask_completed' || event.event_type === 'task_completed') {
      const subtask = event.subtask_id ? db.prepare('SELECT id, task_id FROM subtasks WHERE id = ?').get(event.subtask_id) : null;
      if (!subtask) throw new Error('Completion event references an unknown subtask.');
      if (event.task_id && event.task_id !== subtask.task_id) throw new Error('Completion event task does not match its subtask.');
      db.prepare(`UPDATE subtasks SET status = 'done', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
        WHERE id = ?`).run(subtask.id);
      const progress = refreshTaskProgress(subtask.task_id);
      if (progress < 100) {
        next = findNextReadySubtask(subtask.task_id);
        if (next) {
          db.prepare(`UPDATE subtasks SET status = 'active', started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
            WHERE id = ?`).run(next.id);
          db.prepare(`INSERT INTO sync_events (event_id, task_id, subtask_id, event_type, created_at, sync_status, payload)
            VALUES (?, ?, ?, 'subtask_started', CURRENT_TIMESTAMP, 'received', '{}')`).run(randomUUID(), next.task_id, next.id);
        }
      }
    }
    db.prepare("UPDATE sync_events SET sync_status = 'acknowledged' WHERE event_id = ?").run(event.event_id);
  };
  withTransaction(transaction);
  return { duplicate, next };
};

const dispatchNextSubtask = async (next) => next ? sendTaskToBand({ event_id: randomUUID(), task_id: next.task_id, subtask_id: next.id, text: next.description }) : null;

const createTask = async ({ title, priority = 'Medium', due = 'Unscheduled', assignedTo, subtasks = [], eisenhowerCategory = null, createdBy }) => {
  if (!title?.trim()) throw new Error('A title is required.');
  if (!allowed.priorities.includes(priority)) throw new Error('Invalid priority.');
  if (!assignedTo) throw new Error('A worker is required.');
  const worker = db.prepare("SELECT id FROM users WHERE role = 'worker' AND (id = ? OR full_name = ?)").get(assignedTo, assignedTo);
  if (!worker) throw new Error('Worker not found.');
  if (eisenhowerCategory != null && !allowed.eisenhower.includes(eisenhowerCategory)) throw new Error('Invalid Eisenhower category.');

  const breakdown = await requestAiBreakdown({ title: title.trim(), priority, due: String(due || 'Unscheduled'), subtasks });
  const classification = eisenhowerCategory ?? await requestAiClassification({ title: breakdown.title, priority, due });
  const normalizedSubtasks = validateBreakdown(breakdown, title).subtasks;
  if (!normalizedSubtasks.length) throw new Error('At least one valid subtask is required.');
  const taskId = randomUUID();
  const idByOrder = new Map();
  normalizedSubtasks.forEach((subtask) => idByOrder.set(subtask.order_index, randomUUID()));
  let first = null;

  const transaction = () => {
    db.prepare(`INSERT INTO tasks (id, title, priority, status, progress, due, eisenhower_category, assigned_to, created_by)
      VALUES (?, ?, ?, 'In Progress', 0, ?, ?, ?, ?)`).run(taskId, breakdown.title, priority, String(due || 'Unscheduled').trim() || 'Unscheduled', classification, worker.id, createdBy);
    const insert = db.prepare(`INSERT INTO subtasks (id, task_id, description, status, depends_on, order_index)
      VALUES (?, ?, ?, 'pending', ?, ?)`);
    normalizedSubtasks.sort((a, b) => a.order_index - b.order_index).forEach((subtask) => insert.run(idByOrder.get(subtask.order_index), taskId, subtask.description, subtask.depends_on_order_index == null ? null : idByOrder.get(subtask.depends_on_order_index) ?? null, subtask.order_index));
    db.prepare(`INSERT INTO sync_events (event_id, task_id, subtask_id, event_type, created_at, sync_status, payload)
      VALUES (?, ?, NULL, 'task_received', CURRENT_TIMESTAMP, 'acknowledged', '{}')`).run(randomUUID(), taskId);
    first = findNextReadySubtask(taskId);
    if (first) {
      db.prepare("UPDATE subtasks SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?").run(first.id);
      db.prepare(`INSERT INTO sync_events (event_id, task_id, subtask_id, event_type, created_at, sync_status, payload)
        VALUES (?, ?, ?, 'subtask_started', CURRENT_TIMESTAMP, 'acknowledged', '{}')`).run(randomUUID(), taskId, first.id);
    }
  };
  withTransaction(transaction);

  const band = await sendTaskToBand(first ? { event_id: randomUUID(), task_id: taskId, subtask_id: first.id, text: first.description } : null);
  return { id: taskId, title: breakdown.title, priority, status: 'In Progress', progress: 0, due: String(due || 'Unscheduled').trim() || 'Unscheduled', eisenhower_category: classification, assignedTo: worker.id, subtasks: normalizedSubtasks.map((item) => item.description), band };
};

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, database: databasePath, bridge_api_version: bridgeApiVersion });

    if (request.method === 'POST' && url.pathname === '/auth/signup') {
      const { email, password, fullName } = await readBody(request);
      if (!email?.trim() || !password || !fullName?.trim()) return json(response, 400, { error: 'Full name, email, and password are required.' });
      db.prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), email.trim().toLowerCase(), hashPassword(password), fullName.trim(), 'worker');
      return json(response, 201, { ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      const { email, password } = await readBody(request);
      const user = db.prepare('SELECT id, email, password_hash, full_name, role FROM users WHERE email = ?').get(email?.trim().toLowerCase());
      if (!user || !verifyPassword(password ?? '', user.password_hash)) return json(response, 401, { error: 'Invalid email or password.' });
      return json(response, 200, { token: createSession(user.id), user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
    }

    if (request.method === 'POST' && url.pathname === '/auth/forgot') {
      const { email } = await readBody(request);
      if (!email?.trim()) return json(response, 400, { error: 'Enter your email address.' });
      // Same reply whether or not the account exists, so this page can't be used to find out who has one.
      db.prepare("UPDATE users SET password_reset_requested_at = CURRENT_TIMESTAMP WHERE email = ? AND role = 'worker'").run(email.trim().toLowerCase());
      return json(response, 200, { ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/me') {
      const user = requireUser(request, response);
      if (!user) return;
      return json(response, 200, readProfile(user.id));
    }

    if (request.method === 'PATCH' && url.pathname === '/me') {
      const user = requireUser(request, response);
      if (!user) return;
      return json(response, 200, updateProfile(user.id, await readBody(request)));
    }

    if (request.method === 'POST' && url.pathname === '/me/password') {
      const user = requireUser(request, response);
      if (!user) return;
      const { currentPassword, newPassword } = await readBody(request);
      const stored = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
      if (!verifyPassword(currentPassword ?? '', stored?.password_hash)) return json(response, 400, { error: 'Current password is incorrect.' });
      if (typeof newPassword !== 'string' || newPassword.length < minPasswordLength) return json(response, 400, { error: `New password must be at least ${minPasswordLength} characters.` });
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
      return json(response, 200, { ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/workers') {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can view worker details.' });
      return json(response, 200, db.prepare("SELECT id, full_name AS name, email, role, status, created_at, password_reset_requested_at FROM users WHERE role = 'worker' ORDER BY full_name").all());
    }

    const workerPasswordMatch = url.pathname.match(/^\/workers\/([^/]+)\/password$/);
    if (request.method === 'POST' && workerPasswordMatch) {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can reset worker passwords.' });
      const { password } = await readBody(request);
      if (typeof password !== 'string' || password.length < minPasswordLength) return json(response, 400, { error: `Temporary password must be at least ${minPasswordLength} characters.` });
      const workerId = workerPasswordMatch[1];
      const reset = () => {
        const result = db.prepare("UPDATE users SET password_hash = ?, password_reset_requested_at = NULL WHERE id = ? AND role = 'worker'").run(hashPassword(password), workerId);
        if (result.changes) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(workerId);
        return result.changes;
      };
      if (!withTransaction(reset)) return json(response, 404, { error: 'Worker not found.' });
      return json(response, 200, { ok: true });
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
      return json(response, 200, listWork(user));
    }

    if (request.method === 'POST' && url.pathname === '/work') {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can assign work.' });
      const body = await readBody(request);
      return json(response, 201, await createTask({ ...body, createdBy: user.id }));
    }

    if (request.method === 'PATCH' && url.pathname.startsWith('/work/')) {
      const user = requireUser(request, response);
      if (!user) return;
      const workId = url.pathname.slice('/work/'.length);
      const { status } = await readBody(request);
      if (!allowed.workStatuses.includes(status)) return json(response, 400, { error: 'Invalid work status.' });
      const work = db.prepare('SELECT id, assigned_to FROM tasks WHERE id = ?').get(workId);
      if (!work) return json(response, 404, { error: 'Work item not found.' });
      if (user.role !== 'boss' && work.assigned_to !== user.id) return json(response, 403, { error: 'You can only update work assigned to you.' });
      const transaction = () => {
        db.prepare(`UPDATE tasks SET status = ?, progress = CASE WHEN ? = 'Done' THEN 100 ELSE progress END,
          completed_at = CASE WHEN ? = 'Done' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status, status, status, workId);
        if (status === 'Done') db.prepare("UPDATE subtasks SET status = 'done', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP) WHERE task_id = ?").run(workId);
        if (status === 'Done') db.prepare(`INSERT INTO sync_events (event_id, task_id, event_type, created_at, sync_status, payload)
          VALUES (?, ?, 'task_completed', CURRENT_TIMESTAMP, 'acknowledged', ?)`).run(randomUUID(), workId, JSON.stringify({ status }));
      };
      withTransaction(transaction);
      return json(response, 200, { id: workId, status });
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/work/')) {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can delete work.' });
      const workId = url.pathname.slice('/work/'.length);
      const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(workId);
      if (!result.changes) return json(response, 404, { error: 'Work item not found.' });
      return json(response, 200, { id: workId });
    }

    if (request.method === 'POST' && url.pathname === '/internal/ble/events') {
      if (!requireInternal(request, response)) return;
      const event = await readBody(request);
      const result = processBleEvent(event);
      const band = result.next ? await dispatchNextSubtask(result.next) : null;
      return json(response, 200, { acknowledged: true, duplicate: result.duplicate, next: result.next, band });
    }

    if (request.method === 'POST' && url.pathname === '/voice/records') {
      const user = requireUser(request, response);
      if (!user) return;
      const { fileId, filePath, taskId } = await readBody(request);
      if (!fileId?.trim()) return json(response, 400, { error: 'fileId is required.' });
      const id = randomUUID();
      db.prepare(`INSERT INTO voice_records (id, task_id, file_id, file_path) VALUES (?, ?, ?, ?)`)
        .run(id, taskId ?? null, fileId.trim(), filePath ?? null);
      return json(response, 201, { id, processing_status: 'queued' });
    }

    return json(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    const status = Number(error?.status ?? (isUniqueViolation(error) ? 409 : 500));
    return json(response, status, { error: isUniqueViolation(error) ? 'An account with that email already exists.' : error instanceof Error ? error.message : 'Server error.' });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`BandFlow SQLite API listening on http://0.0.0.0:${port}`));
