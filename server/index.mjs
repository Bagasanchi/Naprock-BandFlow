import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, minPasswordLength, verifyPassword } from './passwords.mjs';
import { AiError, breakDownWithAi, classifyByRules, classifyWithAi, createAi, eisenhowerCategories, extractSkillsWithAi, raiseUrgency } from './ai.mjs';
import { describeWorkload, keywordSkills, normalizeSkills, parseSkills, rankWorkers, readWorkloadLimits } from './recommend.mjs';
import { seedDemo } from './demo.mjs';

const port = Number(process.env.PORT ?? 8787);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// "--demo" serves a separate database with made-up workers for screenshots, never the real one.
const demoMode = process.argv.includes('--demo');
const databasePath = demoMode
  ? process.env.DEMO_DATABASE_PATH ?? join(projectRoot, 'data', 'demo.sqlite')
  : process.env.DATABASE_PATH ?? process.env.BAND_FLOW_DB_PATH ?? join(projectRoot, 'data', 'bandflow.sqlite');
const bleBridgeUrl = (process.env.BLE_BRIDGE_URL ?? 'http://127.0.0.1:5000/v1/dispatch').replace(/\/$/, '');
// v2 added the wristband session (pairing + RPC); v3 adds locked steps, stored quadrants and voice error codes.
// Older bridges are still accepted for events.
const bridgeApiVersion = 'v3';
const supportedBridgeVersions = ['v1', 'v2', 'v3'];
const internalToken = process.env.BLE_INTERNAL_TOKEN ?? '';
const aiBreakdownUrl = (process.env.AI_BREAKDOWN_URL ?? '').replace(/\/$/, '');
const aiClassificationUrl = (process.env.AI_CLASSIFICATION_URL ?? '').replace(/\/$/, '');
const ai = createAi();
const workloadLimits = readWorkloadLimits();

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
  eisenhower: eisenhowerCategories,
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
  CREATE TABLE IF NOT EXISTS bands (
    band_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT
  );
  CREATE TABLE IF NOT EXISTS band_pairing_codes (
    code TEXT PRIMARY KEY,
    band_id TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL
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
// skills holds a JSON array of short tags used by the worker recommendation; NULL means none yet.
for (const column of ['phone', 'job_title', 'avatar', 'password_reset_requested_at', 'skills']) {
  if (!columnExists('users', column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
}
if (!columnExists('users', 'is_demo')) db.exec('ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0');
// Who chose a work's matrix category: 'ai', 'rules' (the fallback) or 'manual' (sent by the caller).
if (!columnExists('tasks', 'eisenhower_source')) db.exec('ALTER TABLE tasks ADD COLUMN eisenhower_source TEXT');
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
  const row = db.prepare('SELECT id, email, full_name, role, phone, job_title, avatar, skills, created_at FROM users WHERE id = ?').get(userId);
  return row && { id: row.id, email: row.email, fullName: row.full_name, role: row.role, phone: row.phone ?? '', jobTitle: row.job_title ?? '', avatar: row.avatar ?? null, skills: parseSkills(row.skills), createdAt: row.created_at };
};

const validationError = (message) => Object.assign(new Error(message), { status: 400 });

const updateProfile = (userId, { fullName, email, phone, jobTitle, avatar, skills }) => {
  const current = readProfile(userId);
  const next = {
    fullName: fullName === undefined ? current.fullName : String(fullName).trim(),
    email: email === undefined ? current.email : String(email).trim().toLowerCase(),
    phone: phone === undefined ? current.phone : String(phone).trim(),
    jobTitle: jobTitle === undefined ? current.jobTitle : String(jobTitle).trim(),
    avatar: avatar === undefined ? current.avatar : avatar,
    skills: skills === undefined ? current.skills : normalizeSkills(skills),
  };
  if (!next.fullName || next.fullName.length > 80) throw validationError('Full name must be between 1 and 80 characters.');
  if (!emailPattern.test(next.email)) throw validationError('Enter a valid email address.');
  if (next.phone && !phonePattern.test(next.phone)) throw validationError('Enter a valid phone number.');
  if (next.jobTitle.length > 60) throw validationError('Job title must be 60 characters or fewer.');
  if (next.avatar !== null && (typeof next.avatar !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(next.avatar) || next.avatar.length > maxAvatarLength)) {
    throw validationError('Profile picture must be a JPEG, PNG, or WebP image under 1.5 MB.');
  }
  try {
    db.prepare('UPDATE users SET full_name = ?, email = ?, phone = ?, job_title = ?, avatar = ?, skills = ? WHERE id = ?')
      .run(next.fullName, next.email, next.phone || null, next.jobTitle || null, next.avatar, JSON.stringify(next.skills), userId);
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
  if (requestVersion && !supportedBridgeVersions.includes(requestVersion)) {
    json(response, 426, { error: `Unsupported bridge contract ${requestVersion}; expected ${supportedBridgeVersions.join(' or ')}.` });
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
  // Each step has at most one prerequisite and it must come earlier, so steps can never wait on each
  // other in a loop (1 -> 2 -> 1) that would leave the work impossible to finish.
  if (subtasks.some((item) => item.depends_on_order_index != null && (item.depends_on_order_index >= item.order_index || !orderIndexes.has(item.depends_on_order_index)))) {
    throw new Error('Structured breakdown contains an invalid dependency.');
  }
  return { title: typeof result.title === 'string' && result.title.trim() ? result.title.trim() : fallbackTitle, subtasks };
};

const postJson = async (url, token, body, timeoutMs) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}.`);
  return response.json();
};

const logAiFallback = (what, error) => console.warn(`AI ${what} failed, using the fallback: ${error instanceof Error ? error.message : error}`);

// Steps for a new work. Steps the boss typed are used as they are; otherwise the AI writes them, and if it
// is switched off, unreachable or answers with something invalid, the work gets one step made from its title.
// AI_BREAKDOWN_URL (a service that returns the finished structure) still takes the place of the prompt.
const planBreakdown = async ({ title, priority, due, subtasks }) => {
  if (parseSubtasks(subtasks).length) return { ...fallbackBreakdown(title, subtasks), source: 'manual' };
  if (!aiBreakdownUrl && !ai.enabled) return { ...fallbackBreakdown(title), source: 'fallback' };
  try {
    if (aiBreakdownUrl) return { ...validateBreakdown(await postJson(aiBreakdownUrl, process.env.AI_BREAKDOWN_TOKEN, { title, priority, due, subtasks: [] }, 15000), title), source: 'ai' };
    return { title, subtasks: await breakDownWithAi(ai, { title, priority, due }), source: 'ai' };
  } catch (error) {
    logAiFallback('breakdown', error);
    return { ...fallbackBreakdown(title), source: 'fallback' };
  }
};

// Matrix category for a new work: the AI's answer when it gives a valid one, the rules otherwise.
const planCategory = async ({ title, priority, due }) => {
  if (aiClassificationUrl || ai.enabled) {
    try {
      const category = aiClassificationUrl
        ? (await postJson(aiClassificationUrl, process.env.AI_CLASSIFICATION_TOKEN, { title, priority, due }, 10000))?.category
        : await classifyWithAi(ai, { title, priority, due });
      if (allowed.eisenhower.includes(category)) return { category, source: 'ai' };
      throw new AiError('AI returned an unknown matrix category.');
    } catch (error) {
      logAiFallback('classification', error);
    }
  }
  return { category: classifyByRules({ priority, due }), source: 'rules' };
};

// The category shown for a work, the same for the app and the watch. Rule-made categories follow the
// calendar, and a deadline that has come close makes an AI-made one urgent too. The stored value is kept
// in step so the database always holds what is on screen.
const currentCategory = (task) => {
  const stored = allowed.eisenhower.includes(task.eisenhower_category) ? task.eisenhower_category : null;
  if (task.status === 'Done' && stored) return stored;
  const category = task.eisenhower_source === 'manual' && stored ? stored
    : task.eisenhower_source === 'ai' && stored ? raiseUrgency(stored, task.due)
    : classifyByRules(task);
  if (category !== stored) {
    db.prepare("UPDATE tasks SET eisenhower_category = ?, eisenhower_source = COALESCE(eisenhower_source, 'rules') WHERE id = ?").run(category, task.id);
  }
  return category;
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

// A step is locked while the one step it depends on is not done yet.
const lockedSubtaskIds = (subtasks) => {
  const statusById = new Map(subtasks.map((subtask) => [subtask.id, subtask.status]));
  return new Set(subtasks.filter((subtask) => subtask.status !== 'done' && subtask.depends_on && statusById.has(subtask.depends_on) && statusById.get(subtask.depends_on) !== 'done').map((subtask) => subtask.id));
};

const listWork = (user) => {
  const rows = user.role === 'boss'
    ? db.prepare(`SELECT tasks.id, tasks.title, tasks.priority, tasks.status, tasks.progress, tasks.due, tasks.eisenhower_category, tasks.eisenhower_source,
        users.full_name AS assigned_to FROM tasks JOIN users ON users.id = tasks.assigned_to ORDER BY tasks.created_at DESC`).all()
    : db.prepare(`SELECT tasks.id, tasks.title, tasks.priority, tasks.status, tasks.progress, tasks.due, tasks.eisenhower_category, tasks.eisenhower_source,
        users.full_name AS assigned_to FROM tasks JOIN users ON users.id = tasks.assigned_to
        WHERE tasks.assigned_to = ? ORDER BY tasks.created_at DESC`).all(user.id);
  const grouped = readSubtasks(rows.map((row) => row.id));
  return rows.map((row) => {
    const details = grouped.get(row.id) ?? [];
    const lockedIds = lockedSubtaskIds(details);
    return {
      ...row,
      eisenhower_category: currentCategory(row),
      eisenhower_source: row.eisenhower_source ?? 'rules',
      subtasks: details.map((subtask) => subtask.description),
      subtask_details: details.map((subtask) => ({ ...subtask, locked: lockedIds.has(subtask.id) })),
    };
  });
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

// A step only goes to the wristband linked to the worker it is assigned to.
const findBandForTask = (taskId) => db.prepare(`SELECT bands.band_id FROM tasks JOIN bands ON bands.user_id = tasks.assigned_to
  WHERE tasks.id = ?`).get(taskId)?.band_id ?? null;

const sendTaskToBand = async (assignment) => {
  if (!assignment) return { sent: false, error: 'No subtask was available to dispatch.' };
  const bandId = findBandForTask(assignment.task_id);
  if (!bandId) return { sent: false, error: 'No wristband is linked to this worker. Link it from Settings in the app.' };
  try {
    const response = await fetch(bleBridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-BandFlow-Bridge-Version': bridgeApiVersion, ...(internalToken ? { 'X-BandFlow-Token': internalToken } : {}) },
      body: JSON.stringify({ ...assignment, band_id: bandId, bridge_api_version: bridgeApiVersion }),
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

// When a work has no step on the band, the next ready step becomes the active one.
// Returns that step (to be dispatched after the transaction) or null.
const activateNextIfIdle = (taskId) => {
  if (db.prepare("SELECT 1 FROM subtasks WHERE task_id = ? AND status = 'active'").get(taskId)) return null;
  const next = findNextReadySubtask(taskId);
  if (!next) return null;
  db.prepare("UPDATE subtasks SET status = 'active', started_at = COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id = ?").run(next.id);
  db.prepare(`INSERT INTO sync_events (event_id, task_id, subtask_id, event_type, created_at, sync_status, payload)
    VALUES (?, ?, ?, 'subtask_started', CURRENT_TIMESTAMP, 'acknowledged', '{}')`).run(randomUUID(), taskId, next.id);
  return next;
};

const dispatchNextSubtask = async (next) => next ? sendTaskToBand({ event_id: randomUUID(), task_id: next.task_id, subtask_id: next.id, text: next.description }) : null;

// Ticking a subtask in the app works like DONE on the wristband: progress updates and, when the
// step on the band is finished, the next ready step becomes active and is sent to the band.
// Unticking puts the step back to pending and reopens a finished task.
const setSubtaskDone = (taskId, subtaskId, done) => {
  let next = null;
  const transaction = () => {
    const subtask = db.prepare('SELECT id, status, depends_on FROM subtasks WHERE id = ? AND task_id = ?').get(subtaskId, taskId);
    if (!subtask) throw Object.assign(new Error('Subtask not found.'), { status: 404 });
    if (done) {
      const prerequisite = subtask.depends_on ? db.prepare('SELECT description, status FROM subtasks WHERE id = ?').get(subtask.depends_on) : null;
      if (prerequisite && prerequisite.status !== 'done') throw Object.assign(new Error(`This step is locked until "${prerequisite.description}" is done.`), { status: 409 });
      db.prepare("UPDATE subtasks SET status = 'done', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP) WHERE id = ?").run(subtaskId);
      db.prepare(`INSERT INTO sync_events (event_id, task_id, subtask_id, event_type, created_at, sync_status, payload)
        VALUES (?, ?, ?, 'subtask_completed', CURRENT_TIMESTAMP, 'acknowledged', '{"source":"app"}')`).run(randomUUID(), taskId, subtaskId);
    } else {
      db.prepare("UPDATE subtasks SET status = 'pending', completed_at = NULL WHERE id = ?").run(subtaskId);
    }
    const progress = refreshTaskProgress(taskId);
    if (progress < 100) {
      db.prepare("UPDATE tasks SET status = CASE WHEN status = 'Done' THEN 'In Progress' ELSE status END, completed_at = NULL WHERE id = ? AND status = 'Done'").run(taskId);
      next = activateNextIfIdle(taskId);
    }
    return progress;
  };
  const progress = withTransaction(transaction);
  return { progress, next };
};

// Removes one step from a work. If it was the step on the band, the next ready step takes its place.
// Must be called by a caller that already checked the user may edit this work.
const removeSubtask = (taskId, subtaskId) => {
  let next = null;
  let wasActive = false;
  const transaction = () => {
    const subtask = db.prepare('SELECT id, status FROM subtasks WHERE id = ? AND task_id = ?').get(subtaskId, taskId);
    if (!subtask) throw Object.assign(new Error('Task not found.'), { status: 404 });
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM subtasks WHERE task_id = ?').get(taskId);
    if (total <= 1) throw validationError('A work needs at least one task. Delete the whole work instead.');
    wasActive = subtask.status === 'active';
    db.prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);
    const progress = refreshTaskProgress(taskId);
    if (progress < 100) next = activateNextIfIdle(taskId);
    return progress;
  };
  const progress = withTransaction(transaction);
  return { progress, next, clearedStep: wasActive && !next };
};

// The watch lists at most this many tasks per work, so adding stops there.
const maxSubtasksPerWork = 24;
const maxSubtaskLength = 200;

// Adds one step to the end of a work. A finished work is reopened, and if nothing is on the band
// the new step becomes the active one. The caller has already checked the user may edit this work.
const addSubtask = (taskId, description) => {
  const text = String(description ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw validationError('The task cannot be empty.');
  if (text.length > maxSubtaskLength) throw validationError(`A task can be at most ${maxSubtaskLength} characters.`);
  let next = null;
  const transaction = () => {
    const { total, last } = db.prepare('SELECT COUNT(*) AS total, COALESCE(MAX(order_index), 0) AS last FROM subtasks WHERE task_id = ?').get(taskId);
    if (total >= maxSubtasksPerWork) throw validationError(`A work can have at most ${maxSubtasksPerWork} tasks.`);
    db.prepare("INSERT INTO subtasks (id, task_id, description, status, order_index) VALUES (?, ?, ?, 'pending', ?)").run(randomUUID(), taskId, text, last + 1);
    db.prepare("UPDATE tasks SET status = 'In Progress', completed_at = NULL WHERE id = ? AND status = 'Done'").run(taskId);
    const progress = refreshTaskProgress(taskId);
    if (progress < 100) next = activateNextIfIdle(taskId);
    return progress;
  };
  const progress = withTransaction(transaction);
  return { progress, next };
};

const createTask = async ({ title, priority = 'Medium', due = 'Unscheduled', assignedTo, subtasks = [], eisenhowerCategory = null, createdBy }) => {
  if (!title?.trim()) throw new Error('A title is required.');
  if (!allowed.priorities.includes(priority)) throw new Error('Invalid priority.');
  if (!assignedTo) throw new Error('A worker is required.');
  const worker = db.prepare("SELECT id FROM users WHERE role = 'worker' AND (id = ? OR full_name = ?)").get(assignedTo, assignedTo);
  if (!worker) throw new Error('Worker not found.');
  if (eisenhowerCategory != null && !allowed.eisenhower.includes(eisenhowerCategory)) throw new Error('Invalid Eisenhower category.');

  const work = { title: title.trim(), priority, due: String(due || 'Unscheduled').trim() || 'Unscheduled', subtasks };
  // The two AI calls do not depend on each other, so they run side by side.
  const [breakdown, planned] = await Promise.all([planBreakdown(work), eisenhowerCategory ? { category: eisenhowerCategory, source: 'manual' } : planCategory(work)]);
  const classification = planned.category;
  const normalizedSubtasks = validateBreakdown(breakdown, title).subtasks;
  if (!normalizedSubtasks.length) throw new Error('At least one valid subtask is required.');
  const taskId = randomUUID();
  const idByOrder = new Map();
  normalizedSubtasks.forEach((subtask) => idByOrder.set(subtask.order_index, randomUUID()));
  let first = null;

  const transaction = () => {
    db.prepare(`INSERT INTO tasks (id, title, priority, status, progress, due, eisenhower_category, eisenhower_source, assigned_to, created_by)
      VALUES (?, ?, ?, 'In Progress', 0, ?, ?, ?, ?, ?)`).run(taskId, breakdown.title, priority, work.due, classification, planned.source, worker.id, createdBy);
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
  // "ai" tells the app where the steps and the category came from: 'ai', or a fallback ('manual', 'fallback', 'rules').
  return { id: taskId, title: breakdown.title, priority, status: 'In Progress', progress: 0, due: work.due, eisenhower_category: classification, assignedTo: worker.id, subtasks: normalizedSubtasks.map((item) => item.description), ai: { breakdown: breakdown.source, category: planned.source }, band };
};

// "Break Down" in the app: the AI rewrites the steps of an existing work that are not done yet; finished
// steps stay. There is no rule to fall back on here, so when the AI cannot answer the work keeps its steps.
const breakDownExistingWork = async (taskId) => {
  if (!ai.enabled) throw Object.assign(new Error('AI breakdown is not set up on the server. Add AI_API_KEY (see server/README.md).'), { status: 503 });
  const task = db.prepare('SELECT title, priority, due, status FROM tasks WHERE id = ?').get(taskId);
  if (task.status === 'Done') throw validationError('This work is already done.');
  const finishedSteps = db.prepare("SELECT description FROM subtasks WHERE task_id = ? AND status = 'done' ORDER BY order_index").all(taskId).map((row) => row.description);
  let steps;
  try {
    steps = await breakDownWithAi(ai, { ...task, finishedSteps });
    if (finishedSteps.length + steps.length > maxSubtasksPerWork) throw new AiError('AI returned more steps than a work can hold.');
  } catch (error) {
    console.warn(`AI breakdown failed, the work keeps its steps: ${error instanceof Error ? error.message : error}`);
    throw Object.assign(new Error('The AI could not break this work down right now. Its steps were left as they are.'), { status: 502 });
  }
  const ids = steps.map(() => randomUUID());
  return withTransaction(() => {
    db.prepare("DELETE FROM subtasks WHERE task_id = ? AND status != 'done'").run(taskId);
    const { last } = db.prepare('SELECT COALESCE(MAX(order_index), 0) AS last FROM subtasks WHERE task_id = ?').get(taskId);
    const insert = db.prepare("INSERT INTO subtasks (id, task_id, description, status, depends_on, order_index) VALUES (?, ?, ?, 'pending', ?, ?)");
    steps.forEach((step, index) => insert.run(ids[index], taskId, step.description, step.depends_on_order_index == null ? null : ids[step.depends_on_order_index - 1], last + step.order_index));
    return { progress: refreshTaskProgress(taskId), steps: steps.length, next: activateNextIfIdle(taskId) };
  });
};

// ---- Workers: skills, workload and the recommendation --------------------------------------------------

// Open works are the works assigned to a worker that are not Done.
const readWorkers = () => db.prepare(`SELECT users.id, users.full_name AS name, users.email, users.role, users.status, users.skills, users.created_at, users.password_reset_requested_at,
    (SELECT COUNT(*) FROM tasks WHERE tasks.assigned_to = users.id AND tasks.status != 'Done') AS open_works
  FROM users WHERE users.role = 'worker' ORDER BY users.full_name`).all()
  .map((row) => ({ ...row, skills: parseSkills(row.skills), workload: describeWorkload(row.open_works, workloadLimits) }));

// Ranks every worker for a work described in free text. The AI only names the skills the work needs
// (keywords stand in when it cannot); the score itself is computed in recommend.mjs.
const recommendWorkers = async (text) => {
  const brief = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (brief.length > 2000) throw validationError('The work description is too long.');
  const workers = readWorkers();
  const knownSkills = [...new Set(workers.flatMap((worker) => worker.skills))];
  let requiredSkills = [];
  let source = 'none';
  if (brief) {
    requiredSkills = keywordSkills(brief, knownSkills);
    source = 'keywords';
    if (ai.enabled) {
      try {
        requiredSkills = await extractSkillsWithAi(ai, { text: brief, knownSkills });
        source = 'ai';
      } catch (error) {
        logAiFallback('skill extraction', error);
      }
    }
  }
  return {
    required_skills: requiredSkills,
    source,
    workload_limits: { busy_at: workloadLimits.busyAt, overloaded_at: workloadLimits.overloadedAt },
    recommendations: rankWorkers(workers.map((worker) => ({ id: worker.id, name: worker.name, skills: worker.skills, openWorks: worker.open_works, status: worker.status })), requiredSkills, workloadLimits),
  };
};

// ---- Wristband session: pairing and the requests the watch makes through the bridge ----------

const bandCodeTtlSeconds = 300;
// The watch has little memory, so it lists at most this many works per quadrant and says how many more exist.
const bandListLimit = 12;

// The watch font only has ASCII, so truncation uses three dots rather than an ellipsis character.
const clip = (text, length) => {
  const value = String(text ?? '');
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
};

const activeWorkFor = (userId) => db.prepare(`SELECT id, title, priority, status, progress, due, eisenhower_category, eisenhower_source
  FROM tasks WHERE assigned_to = ? AND status != 'Done' ORDER BY created_at DESC`).all(userId);

const createBandPairingCode = (bandId) => {
  const now = Date.now();
  db.prepare('DELETE FROM band_pairing_codes WHERE expires_at <= ? OR band_id = ?').run(now, bandId);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      db.prepare('INSERT INTO band_pairing_codes (code, band_id, expires_at) VALUES (?, ?, ?)').run(code, bandId, now + bandCodeTtlSeconds * 1000);
      return code;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error('Could not create a pairing code.');
};

// A six-digit code is guessable, and whoever enters it takes over that watch, so failed guesses are limited.
const maxLinkFailures = 5;
const linkFailureWindowMs = 10 * 60 * 1000;
const linkFailures = new Map();
const isLinkLimited = (userId) => {
  const entry = linkFailures.get(userId);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= maxLinkFailures);
};
const recordLinkFailure = (userId) => {
  const entry = linkFailures.get(userId);
  if (!entry || entry.resetAt <= Date.now()) linkFailures.set(userId, { count: 1, resetAt: Date.now() + linkFailureWindowMs });
  else entry.count += 1;
};

const linkBandWithCode = (userId, code) => {
  const row = db.prepare('SELECT band_id FROM band_pairing_codes WHERE code = ? AND expires_at > ?').get(code, Date.now());
  if (!row) return null;
  withTransaction(() => {
    db.prepare('DELETE FROM bands WHERE user_id = ? OR band_id = ?').run(userId, row.band_id);
    db.prepare('INSERT INTO bands (band_id, user_id) VALUES (?, ?)').run(row.band_id, userId);
    db.prepare('DELETE FROM band_pairing_codes WHERE band_id = ?').run(row.band_id);
  });
  return row.band_id;
};

const readBandSubtasks = (taskId) => {
  const task = db.prepare('SELECT id, title, progress FROM tasks WHERE id = ?').get(taskId);
  const rows = db.prepare('SELECT id, description, status, depends_on FROM subtasks WHERE task_id = ? ORDER BY order_index').all(taskId);
  const lockedIds = lockedSubtaskIds(rows);
  return {
    work: { id: task.id, title: clip(task.title, 40), progress: task.progress },
    subtasks: rows.map((row) => ({ id: row.id, d: clip(row.description, 80), s: row.status === 'done' ? 'd' : row.status === 'active' ? 'a' : lockedIds.has(row.id) ? 'l' : 'p' })),
  };
};

// Every request the watch makes arrives here (via the bridge). Replies are small because they cross BLE.
const handleBandRequest = async (bandId, request) => {
  const link = db.prepare('SELECT bands.user_id, users.full_name FROM bands JOIN users ON users.id = bands.user_id WHERE bands.band_id = ?').get(bandId);
  const type = request?.t;
  if (link) db.prepare('UPDATE bands SET last_seen_at = CURRENT_TIMESTAMP WHERE band_id = ?').run(bandId);

  if (type === 'status' || type === 'link_status') return link ? { ok: true, linked: true, name: clip(link.full_name, 30) } : { ok: true, linked: false };
  if (type === 'pair') {
    if (link) return { ok: true, linked: true, name: clip(link.full_name, 30) };
    return { ok: true, linked: false, code: createBandPairingCode(bandId), ttl: bandCodeTtlSeconds };
  }
  if (!link) return { ok: false, error: 'not_linked' };

  if (type === 'unlink') {
    db.prepare('DELETE FROM bands WHERE band_id = ?').run(bandId);
    return { ok: true, linked: false };
  }

  if (type === 'matrix') {
    const counts = { do_first: 0, schedule: 0, delegate: 0, eliminate: 0 };
    for (const task of activeWorkFor(link.user_id)) counts[currentCategory(task)] += 1;
    return { ok: true, counts };
  }

  if (type === 'works') {
    if (!allowed.eisenhower.includes(request.cat)) return { ok: false, error: 'Unknown quadrant.' };
    const matching = activeWorkFor(link.user_id).filter((task) => currentCategory(task) === request.cat);
    return {
      ok: true,
      cat: request.cat,
      more: Math.max(0, matching.length - bandListLimit),
      works: matching.slice(0, bandListLimit).map((task) => ({
        id: task.id,
        title: clip(task.title, 40),
        p: task.progress,
        pr: task.priority[0],
        due: task.due === 'Unscheduled' ? '' : task.due,
      })),
    };
  }

  if (type === 'subtasks' || type === 'remove' || type === 'add') {
    const work = db.prepare('SELECT id, assigned_to FROM tasks WHERE id = ?').get(String(request.work ?? ''));
    if (!work || work.assigned_to !== link.user_id) return { ok: false, error: 'Work not found.' };
    if (type === 'subtasks') return { ok: true, ...readBandSubtasks(work.id) };
    if (type === 'add') {
      try {
        const result = addSubtask(work.id, request.text);
        if (result.next) await dispatchNextSubtask(result.next);
        return { ok: true, ...readBandSubtasks(work.id) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not add the task.' };
      }
    }
    try {
      const result = removeSubtask(work.id, String(request.sub ?? ''));
      if (result.next) await dispatchNextSubtask(result.next);
      return { ok: true, clear_step: result.clearedStep, ...readBandSubtasks(work.id) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not remove the task.' };
    }
  }

  return { ok: false, error: 'Unknown request.' };
};

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, database: databasePath, bridge_api_version: bridgeApiVersion, ai: ai.enabled, demo: demoMode });

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
      return json(response, 200, readWorkers());
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
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can edit workers.' });
      const workerId = url.pathname.slice('/workers/'.length);
      const body = await readBody(request);
      if (body.status === undefined && body.skills === undefined) return json(response, 400, { error: 'Send a status, a skills list, or both.' });
      if (body.status !== undefined && !['active', 'away', 'offline'].includes(body.status)) return json(response, 400, { error: 'Status must be active, away, or offline.' });
      const skills = body.skills === undefined ? undefined : normalizeSkills(body.skills);
      const result = db.prepare("UPDATE users SET status = COALESCE(?, status), skills = COALESCE(?, skills) WHERE id = ? AND role = 'worker'")
        .run(body.status ?? null, skills === undefined ? null : JSON.stringify(skills), workerId);
      if (!result.changes) return json(response, 404, { error: 'Worker not found.' });
      const saved = db.prepare('SELECT status, skills FROM users WHERE id = ?').get(workerId);
      return json(response, 200, { id: workerId, status: saved.status, skills: parseSkills(saved.skills) });
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

    if (request.method === 'POST' && url.pathname === '/work/recommend') {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'boss') return json(response, 403, { error: 'Only bosses can ask for a worker recommendation.' });
      return json(response, 200, await recommendWorkers((await readBody(request)).text));
    }

    const breakdownMatch = url.pathname.match(/^\/work\/([^/]+)\/breakdown$/);
    if (request.method === 'POST' && breakdownMatch) {
      const user = requireUser(request, response);
      if (!user) return;
      const work = db.prepare('SELECT id, assigned_to FROM tasks WHERE id = ?').get(breakdownMatch[1]);
      if (!work) return json(response, 404, { error: 'Work item not found.' });
      if (user.role !== 'boss' && work.assigned_to !== user.id) return json(response, 403, { error: 'You can only edit work assigned to you.' });
      const result = await breakDownExistingWork(work.id);
      const band = result.next ? await dispatchNextSubtask(result.next) : null;
      return json(response, 200, { ...result, band });
    }

    const subtaskMatch = url.pathname.match(/^\/work\/([^/]+)\/subtasks\/([^/]+)$/);
    if (request.method === 'PATCH' && subtaskMatch) {
      const user = requireUser(request, response);
      if (!user) return;
      const [, workId, subtaskId] = subtaskMatch;
      const { done } = await readBody(request);
      if (typeof done !== 'boolean') return json(response, 400, { error: 'done must be true or false.' });
      const work = db.prepare('SELECT id, assigned_to FROM tasks WHERE id = ?').get(workId);
      if (!work) return json(response, 404, { error: 'Work item not found.' });
      if (user.role !== 'boss' && work.assigned_to !== user.id) return json(response, 403, { error: 'You can only update work assigned to you.' });
      const result = setSubtaskDone(workId, subtaskId, done);
      const band = result.next ? await dispatchNextSubtask(result.next) : null;
      return json(response, 200, { progress: result.progress, next: result.next, band });
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

    const subtaskListMatch = url.pathname.match(/^\/work\/([^/]+)\/subtasks$/);
    if (request.method === 'POST' && subtaskListMatch) {
      const user = requireUser(request, response);
      if (!user) return;
      const work = db.prepare('SELECT id, assigned_to FROM tasks WHERE id = ?').get(subtaskListMatch[1]);
      if (!work) return json(response, 404, { error: 'Work item not found.' });
      if (user.role !== 'boss' && work.assigned_to !== user.id) return json(response, 403, { error: 'You can only edit work assigned to you.' });
      const result = addSubtask(work.id, (await readBody(request)).description);
      const band = result.next ? await dispatchNextSubtask(result.next) : null;
      return json(response, 201, { progress: result.progress, next: result.next, band });
    }

    if (request.method === 'DELETE' && subtaskMatch) {
      const user = requireUser(request, response);
      if (!user) return;
      const [, workId, subtaskId] = subtaskMatch;
      const work = db.prepare('SELECT id, assigned_to FROM tasks WHERE id = ?').get(workId);
      if (!work) return json(response, 404, { error: 'Work item not found.' });
      if (user.role !== 'boss' && work.assigned_to !== user.id) return json(response, 403, { error: 'You can only edit work assigned to you.' });
      const result = removeSubtask(workId, subtaskId);
      const band = result.next ? await dispatchNextSubtask(result.next) : null;
      return json(response, 200, { progress: result.progress, next: result.next, band });
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

    if (request.method === 'GET' && url.pathname === '/band/link') {
      const user = requireUser(request, response);
      if (!user) return;
      const band = db.prepare('SELECT linked_at, last_seen_at FROM bands WHERE user_id = ?').get(user.id);
      return json(response, 200, { linked: Boolean(band), linkedAt: band?.linked_at ?? null, lastSeenAt: band?.last_seen_at ?? null });
    }

    if (request.method === 'POST' && url.pathname === '/band/link') {
      const user = requireUser(request, response);
      if (!user) return;
      if (user.role !== 'worker') return json(response, 403, { error: 'Only workers link a wristband.' });
      if (isLinkLimited(user.id)) return json(response, 429, { error: 'Too many wrong codes. Wait a few minutes and try again.' });
      const code = String((await readBody(request)).code ?? '').replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) return json(response, 400, { error: 'Enter the 6-digit code shown on the watch.' });
      const bandId = linkBandWithCode(user.id, code);
      if (!bandId) {
        recordLinkFailure(user.id);
        return json(response, 400, { error: 'That code is wrong or has expired. Check the code on the watch.' });
      }
      linkFailures.delete(user.id);
      // A step that became active before the band was linked never reached it, so send it now.
      const pending = db.prepare(`SELECT subtasks.id, subtasks.task_id, subtasks.description FROM subtasks JOIN tasks ON tasks.id = subtasks.task_id
        WHERE tasks.assigned_to = ? AND subtasks.status = 'active' ORDER BY subtasks.started_at LIMIT 1`).get(user.id);
      const band = pending ? await sendTaskToBand({ event_id: randomUUID(), task_id: pending.task_id, subtask_id: pending.id, text: pending.description }) : null;
      return json(response, 200, { linked: true, band });
    }

    if (request.method === 'DELETE' && url.pathname === '/band/link') {
      const user = requireUser(request, response);
      if (!user) return;
      db.prepare('DELETE FROM bands WHERE user_id = ?').run(user.id);
      return json(response, 200, { linked: false });
    }

    if (request.method === 'POST' && url.pathname === '/internal/band/rpc') {
      if (!requireInternal(request, response)) return;
      const { band_id: bandId, request: bandRequest } = await readBody(request);
      if (typeof bandId !== 'string' || !bandId.trim() || !bandRequest || typeof bandRequest !== 'object') return json(response, 400, { error: 'band_id and request are required.' });
      return json(response, 200, await handleBandRequest(bandId.trim().toLowerCase(), bandRequest));
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

server.listen(port, '0.0.0.0', () => {
  console.log(`BandFlow SQLite API listening on http://0.0.0.0:${port}`);
  console.log(`AI: ${ai.status}`);
  if (demoMode) {
    const demo = seedDemo(db, withTransaction);
    console.log(`DEMO MODE: serving ${databasePath} with made-up workers. Log in as ${demo.bossEmail} / ${demo.bossPassword}`);
  }
});
