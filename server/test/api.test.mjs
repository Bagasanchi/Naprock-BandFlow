// End-to-end checks: the real server process, a throwaway database, and a stand-in AI service whose
// behaviour each test switches (good answers, garbage, or down) to prove the fallbacks.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../passwords.mjs';

const serverFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.mjs');
const folder = mkdtempSync(join(tmpdir(), 'bandflow-test-'));
const databasePath = join(folder, 'test.sqlite');

const goodAnswers = {
  steps: { steps: [
    { n: 1, text: 'Collect the dish list', depends_on: null },
    { n: 2, text: 'Sketch the layout', depends_on: 1 },
    { n: 3, text: 'Send it to the printer', depends_on: 2 },
  ] },
  skills: { skills: ['Design'] },
};
const garbageAnswers = {
  category: { items: [{ id: 'new', urgent: 'maybe', important: true, quadrant: 'whenever', reason: 'x' }] },
  steps: { steps: [{ n: 1, text: 'План', depends_on: 5 }] },
  skills: { skills: 'Design' },
};
// Modes: good, garbage, prose (not JSON), down (HTTP 500), and for the matrix only: contradict (every item
// placed against its own priority) and half (every second item of a request placed against its priority).
let aiMode = 'good';
let aiCalls = 0;
let matrixReason = 'High priority with no deadline yet.';
const matrixRequests = [];

// What a model that follows the matrix prompt answers: the definitions applied to each item it was sent.
const matrixAnswer = (asked, mode) => ({ items: asked.items.map((item, index) => {
  const days = item.due_date ? Math.round((new Date(`${item.due_date}T00:00:00`) - new Date(`${asked.today}T00:00:00`)) / 86_400_000) : null;
  const urgent = days !== null && days <= 2;
  let important = item.priority !== 'Low';
  if (mode === 'contradict' || (mode === 'half' && index % 2 === 1)) important = !important;
  return { id: item.id, urgent, important, quadrant: important ? (urgent ? 'do_first' : 'schedule') : (urgent ? 'delegate' : 'eliminate'), reason: matrixReason };
}) });

const fakeAi = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  aiCalls += 1;
  if (aiMode === 'down') return response.writeHead(500).end('{}');
  const messages = JSON.parse(body).messages;
  const system = messages[0].content;
  const kind = system.includes('priority-matrix') ? 'category' : system.includes('wristband') ? 'steps' : 'skills';
  let content = 'Sorry, I cannot help with that.';
  if (kind === 'category') {
    const asked = JSON.parse(messages[1].content);
    matrixRequests.push(asked);
    if (aiMode !== 'prose') content = JSON.stringify(aiMode === 'garbage' ? garbageAnswers.category : matrixAnswer(asked, aiMode));
  } else if (aiMode !== 'prose') {
    content = JSON.stringify((aiMode === 'garbage' ? garbageAnswers : goodAnswers)[kind]);
  }
  response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ choices: [{ message: { content } }] }));
});

const dayFromNow = (offset) => {
  const date = new Date(Date.now() + offset * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
// Changes the server's database from outside, the way a day passing or an edit elsewhere would.
const editDatabase = (path, sql, ...values) => {
  const database = new DatabaseSync(path);
  try {
    database.exec('PRAGMA busy_timeout = 2000');
    database.prepare(sql).run(...values);
  } finally {
    database.close();
  }
};
const waitFor = async (check, what, timeoutMs = 8000) => {
  for (const end = Date.now() + timeoutMs; Date.now() < end;) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`timed out waiting for ${what}`);
};

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const freePort = async () => {
  const probe = createServer();
  const port = await listen(probe);
  await new Promise((resolve) => probe.close(resolve));
  return port;
};

const startServer = async (env, args = []) => {
  const port = await freePort();
  let output = '';
  const child = spawn(process.execPath, [serverFile, ...args], { env: { ...process.env, PORT: String(port), BLE_BRIDGE_URL: 'http://127.0.0.1:9/v1/dispatch', BLE_INTERNAL_TOKEN: '', ...env } });
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`${base}/health`)).ok) return { base, child, output: () => output };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  child.kill();
  throw new Error(`Server did not start:\n${output}`);
};

const call = async (base, method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

let app;
let base;
let boss;
let worker;
const tokens = {};

const login = async (email, password = 'password1') => (await call(base, 'POST', '/auth/login', { body: { email, password } })).body;
const rpc = async (bandId, request) => (await call(base, 'POST', '/internal/band/rpc', { body: { band_id: bandId, request } })).body;

before(async () => {
  // An account from before this change: a users table without the skills column.
  const old = new DatabaseSync(databasePath);
  old.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('worker', 'boss')) DEFAULT 'worker', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  old.prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').run('old-boss', 'boss@test.mn', hashPassword('password1'), 'Old Boss', 'boss');
  old.prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').run('old-worker', 'worker@test.mn', hashPassword('password1'), 'Old Worker', 'worker');
  old.close();

  const aiPort = await listen(fakeAi);
  app = await startServer({ DATABASE_PATH: databasePath, AI_BASE_URL: `http://127.0.0.1:${aiPort}/v1`, AI_MODEL: 'test-model', AI_API_KEY: '' });
  base = app.base;
  boss = await login('boss@test.mn');
  worker = await login('worker@test.mn');
  tokens.boss = boss.token;
  tokens.worker = worker.token;
});

after(async () => {
  app?.child.kill();
  await new Promise((resolve) => fakeAi.close(resolve));
  fakeAi.closeAllConnections?.();
  await new Promise((resolve) => setTimeout(resolve, 300));
  rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('accounts made before the skills column still log in and start with no skills', async () => {
  assert.equal(boss.user.fullName, 'Old Boss');
  const profile = await call(base, 'GET', '/me', { token: tokens.worker });
  assert.deepEqual(profile.body.skills, []);
  const health = await call(base, 'GET', '/health');
  assert.equal(health.body.ai, true);
  assert.equal(health.body.bridge_api_version, 'v3');
});

test('a worker edits their own skills and the boss edits them in Manage Workers', async () => {
  const mine = await call(base, 'PATCH', '/me', { token: tokens.worker, body: { skills: ['Cooking', ' cooking ', 'Cleaning'] } });
  assert.deepEqual(mine.body.skills, ['Cooking', 'Cleaning']);

  const byBoss = await call(base, 'PATCH', '/workers/old-worker', { token: tokens.boss, body: { skills: ['Design'] } });
  assert.deepEqual(byBoss.body, { id: 'old-worker', status: 'active', skills: ['Design'] });

  assert.equal((await call(base, 'PATCH', '/workers/old-worker', { token: tokens.boss, body: { skills: 'Design' } })).status, 400);
  assert.equal((await call(base, 'PATCH', '/workers/old-worker', { token: tokens.worker, body: { skills: [] } })).status, 403);
  // Changing only the status must not wipe the skills.
  await call(base, 'PATCH', '/workers/old-worker', { token: tokens.boss, body: { status: 'away' } });
  await call(base, 'PATCH', '/workers/old-worker', { token: tokens.boss, body: { status: 'active' } });
  const listed = (await call(base, 'GET', '/workers', { token: tokens.boss })).body.find((row) => row.id === 'old-worker');
  assert.deepEqual(listed.skills, ['Design']);
  assert.deepEqual(listed.workload, { open: 0, level: 'light', busy_at: 5, overloaded_at: 7 });
});

test('with the AI answering, a new work gets AI steps and an AI category, and the app and the watch agree', async () => {
  aiMode = 'good';
  const created = await call(base, 'POST', '/work', { token: tokens.boss, body: { title: 'Design the new menu card', priority: 'High', due: 'Unscheduled', assignedTo: 'old-worker' } });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.subtasks, ['Collect the dish list', 'Sketch the layout', 'Send it to the printer']);
  assert.deepEqual(created.body.ai, { breakdown: 'ai', category: 'ai' });
  // High priority with no due date is "schedule" by definition; the sentence beside it can only be the AI's.
  assert.equal(created.body.eisenhower_category, 'schedule');
  assert.equal(created.body.eisenhower_reason, 'High priority with no deadline yet.');
  assert.equal(created.body.eisenhower_reason_by, 'ai');
  assert.deepEqual(matrixRequests.at(-1), { today: dayFromNow(0), items: [{ id: 'new', title: 'Design the new menu card', priority: 'High', due_date: null }] });

  const inApp = (await call(base, 'GET', '/work', { token: tokens.worker })).body.find((row) => row.id === created.body.id);
  assert.equal(inApp.eisenhower_category, 'schedule');
  assert.equal(inApp.eisenhower_source, 'ai');
  assert.equal(inApp.eisenhower_reason, 'High priority with no deadline yet.');
  assert.equal(inApp.eisenhower_reason_by, 'ai');
  assert.deepEqual(inApp.subtask_details.map((step) => [step.status, step.locked]), [['active', false], ['pending', true], ['pending', true]]);

  // Link a watch to the worker and read the same work through the watch's channel.
  const bandId = 'aa:bb:cc:dd:ee:01';
  const { code } = await rpc(bandId, { t: 'pair' });
  assert.equal((await call(base, 'POST', '/band/link', { token: tokens.worker, body: { code } })).status, 200);
  assert.deepEqual((await rpc(bandId, { t: 'matrix' })).counts, { do_first: 0, schedule: 1, delegate: 0, eliminate: 0 });
  assert.equal((await rpc(bandId, { t: 'works', cat: 'schedule' })).works[0].id, created.body.id);
  assert.deepEqual((await rpc(bandId, { t: 'subtasks', work: created.body.id })).subtasks.map((step) => step.s), ['a', 'l', 'l']);

  // A locked step cannot be ticked; finishing its prerequisite unlocks it.
  const [first, second, third] = inApp.subtask_details;
  const refused = await call(base, 'PATCH', `/work/${created.body.id}/subtasks/${third.id}`, { token: tokens.worker, body: { done: true } });
  assert.equal(refused.status, 409);
  assert.match(refused.body.error, /locked until "Sketch the layout"/);
  await call(base, 'PATCH', `/work/${created.body.id}/subtasks/${first.id}`, { token: tokens.worker, body: { done: true } });
  assert.deepEqual((await rpc(bandId, { t: 'subtasks', work: created.body.id })).subtasks.map((step) => step.s), ['d', 'a', 'l']);
  assert.equal((await call(base, 'PATCH', `/work/${created.body.id}/subtasks/${second.id}`, { token: tokens.worker, body: { done: true } })).status, 200);
});

test('steps typed by the boss are kept as they are', async () => {
  aiMode = 'good';
  const created = await call(base, 'POST', '/work', { token: tokens.boss, body: { title: 'Clean the grill', priority: 'Low', assignedTo: 'old-worker', subtasks: ['Scrape it', 'Oil it'] } });
  assert.deepEqual(created.body.subtasks, ['Scrape it', 'Oil it']);
  assert.equal(created.body.ai.breakdown, 'manual');
});

for (const mode of ['garbage', 'prose', 'down']) {
  test(`AI ${mode}: the work is still created, with one step from the title and a category from the rules`, async () => {
    aiMode = mode;
    const created = await call(base, 'POST', '/work', { token: tokens.boss, body: { title: `Restock the bar (${mode})`, priority: 'Medium', due: dayFromNow(1), assignedTo: 'old-worker' } });

    assert.equal(created.status, 201);
    assert.deepEqual(created.body.subtasks, [`Restock the bar (${mode})`]);
    assert.deepEqual(created.body.ai, { breakdown: 'fallback', category: 'rules' });
    assert.equal(created.body.eisenhower_category, 'do_first');
    // With no AI sentence, the rules say why.
    assert.equal(created.body.eisenhower_reason, 'Due tomorrow and priority is Medium.');
    assert.equal(created.body.eisenhower_reason_by, 'rules');
    assert.equal((await call(base, 'GET', '/work', { token: tokens.worker })).body.find((row) => row.id === created.body.id).eisenhower_reason, 'Due tomorrow and priority is Medium.');
    const stored = new DatabaseSync(databasePath, { readOnly: true });
    assert.deepEqual({ ...stored.prepare('SELECT eisenhower_category, eisenhower_source FROM tasks WHERE id = ?').get(created.body.id) }, { eisenhower_category: 'do_first', eisenhower_source: 'rules' });
    stored.close();
  });
}

test('Break Down rewrites the unfinished steps with the AI and leaves the work alone when the AI fails', async () => {
  aiMode = 'down';
  const created = await call(base, 'POST', '/work', { token: tokens.boss, body: { title: 'Design the wall poster', assignedTo: 'old-worker' } });
  assert.deepEqual(created.body.subtasks, ['Design the wall poster']);

  const failed = await call(base, 'POST', `/work/${created.body.id}/breakdown`, { token: tokens.worker });
  assert.equal(failed.status, 502);
  aiMode = 'garbage';
  assert.equal((await call(base, 'POST', `/work/${created.body.id}/breakdown`, { token: tokens.worker })).status, 502);
  const untouched = (await call(base, 'GET', '/work', { token: tokens.worker })).body.find((row) => row.id === created.body.id);
  assert.deepEqual(untouched.subtasks, ['Design the wall poster']);

  aiMode = 'good';
  const done = await call(base, 'POST', `/work/${created.body.id}/breakdown`, { token: tokens.worker });
  assert.equal(done.status, 200);
  assert.equal(done.body.steps, 3);
  const after = (await call(base, 'GET', '/work', { token: tokens.worker })).body.find((row) => row.id === created.body.id);
  assert.deepEqual(after.subtask_details.map((step) => [step.description, step.status, step.locked]), [
    ['Collect the dish list', 'active', false], ['Sketch the layout', 'pending', true], ['Send it to the printer', 'pending', true],
  ]);
});

test('recommendation: boss only, AI skills when available, keywords when not, same ranking either way', async () => {
  aiMode = 'good';
  assert.equal((await call(base, 'POST', '/work/recommend', { token: tokens.worker, body: { text: 'Design the new menu card' } })).status, 403);
  assert.equal((await call(base, 'POST', '/work/recommend', { body: { text: 'x' } })).status, 401);

  await call(base, 'POST', '/auth/signup', { body: { fullName: 'Free Coder', email: 'coder@test.mn', password: 'password1' } });
  const coder = await login('coder@test.mn');
  await call(base, 'PATCH', '/me', { token: coder.token, body: { skills: ['Programming'] } });

  const byAi = (await call(base, 'POST', '/work/recommend', { token: tokens.boss, body: { text: 'Design the new menu card' } })).body;
  assert.equal(byAi.source, 'ai');
  assert.deepEqual(byAi.required_skills, ['Design']);
  const [top, second] = byAi.recommendations;
  // Old Worker has the Design skill but several open works by now; Free Coder is free but lacks the skill.
  assert.equal(top.name, 'Old Worker');
  assert.ok(top.badges.includes('recommended'));
  assert.equal(top.skill_match, 1);
  assert.ok(top.open_works >= 3);
  assert.deepEqual(Object.keys(top).sort(), ['badges', 'matched_skills', 'name', 'open_works', 'reason', 'score', 'skill_match', 'skills', 'status', 'worker_id', 'workload']);
  assert.equal(second.name, 'Free Coder');
  assert.deepEqual(second.badges, ['skill_mismatch']);
  assert.equal(second.score, 34);

  for (const mode of ['down', 'garbage']) {
    aiMode = mode;
    const byKeywords = (await call(base, 'POST', '/work/recommend', { token: tokens.boss, body: { text: 'Design the new menu card' } })).body;
    assert.equal(byKeywords.source, 'keywords');
    assert.deepEqual(byKeywords.required_skills, ['Design']);
    assert.deepEqual(byKeywords.recommendations.map((entry) => [entry.name, entry.score]), byAi.recommendations.map((entry) => [entry.name, entry.score]));
  }

  // No text yet: no AI call, everyone ranked by workload.
  const before = aiCalls;
  const empty = (await call(base, 'POST', '/work/recommend', { token: tokens.boss, body: { text: '  ' } })).body;
  assert.equal(empty.source, 'none');
  assert.equal(empty.recommendations[0].name, 'Free Coder');
  assert.equal(aiCalls, before);
});

test('a matrix answer that contradicts the priority is refused, and the rules place the work', async () => {
  aiMode = 'contradict';
  const created = await call(base, 'POST', '/work', { token: tokens.boss, body: { title: 'Fix the gas leak', priority: 'High', due: dayFromNow(1), assignedTo: 'old-worker', subtasks: ['Close the valve'] } });
  assert.equal(created.status, 201);
  assert.equal(created.body.ai.category, 'rules');
  assert.equal(created.body.eisenhower_category, 'do_first');
  assert.equal(created.body.eisenhower_reason, 'Due tomorrow and priority is High.');
  await waitFor(() => /AI classification failed, using the fallback: AI matrix answer refused: important contradicts the priority\./.test(app.output()), 'the refusal in the server log');
});

test('the AI sentence is shown on the day it was written; later the rules explain, and a close deadline moves the work', async () => {
  aiMode = 'good';
  matrixReason = 'Important, and the deadline is still far away.';
  const created = await call(base, 'POST', '/work', { token: tokens.boss, body: { title: 'Repaint the sign', priority: 'High', due: dayFromNow(9), assignedTo: 'old-worker', subtasks: ['Buy paint'] } });
  const read = async () => (await call(base, 'GET', '/work', { token: tokens.worker })).body.find((row) => row.id === created.body.id);
  assert.deepEqual([created.body.eisenhower_category, created.body.eisenhower_reason], ['schedule', matrixReason]);
  let row = await read();
  assert.deepEqual([row.eisenhower_category, row.eisenhower_source, row.eisenhower_reason, row.eisenhower_reason_by], ['schedule', 'ai', matrixReason, 'ai']);
  assert.equal('eisenhower_checked_on' in row, false);

  // The next day: the sentence was about yesterday, so the rules explain until the AI has been asked again.
  editDatabase(databasePath, "UPDATE tasks SET eisenhower_checked_on = '2000-01-01' WHERE id = ?", created.body.id);
  row = await read();
  assert.deepEqual([row.eisenhower_category, row.eisenhower_source, row.eisenhower_reason], ['schedule', 'ai', 'Not due for 9 days and priority is High.']);
  // The category is still the AI's, but this sentence is not, and the answer says so.
  assert.equal(row.eisenhower_reason_by, 'rules');

  // The deadline comes close: the work moves to "do first" at once, without waiting for the AI.
  editDatabase(databasePath, 'UPDATE tasks SET due = ? WHERE id = ?', dayFromNow(1), created.body.id);
  row = await read();
  assert.deepEqual([row.eisenhower_category, row.eisenhower_reason], ['do_first', 'Due tomorrow and priority is High.']);

  // A category the caller sends is kept as it is and comes with no explanation.
  const manual = await call(base, 'POST', '/work', { token: tokens.boss, body: { title: 'Count the stock', priority: 'High', due: dayFromNow(1), eisenhowerCategory: 'eliminate', assignedTo: 'old-worker', subtasks: ['Count'] } });
  assert.deepEqual([manual.body.eisenhower_category, manual.body.eisenhower_reason, manual.body.eisenhower_reason_by, manual.body.ai.category], ['eliminate', null, null, 'manual']);
});

test('once a day the open works go to the AI again in one request; a refused item falls back and is not asked twice', async () => {
  const path = join(folder, 'refresh.sqlite');
  const seed = new DatabaseSync(path);
  seed.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('worker', 'boss')) DEFAULT 'worker', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  seed.prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').run('b2', 'boss2@test.mn', hashPassword('password1'), 'Second Boss', 'boss');
  seed.prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').run('w2', 'worker2@test.mn', hashPassword('password1'), 'Second Worker', 'worker');
  seed.close();

  aiMode = 'down';
  const second = await startServer({ DATABASE_PATH: path, AI_BASE_URL: `http://127.0.0.1:${fakeAi.address().port}/v1`, AI_MODEL: 'test-model', AI_API_KEY: '', MATRIX_REFRESH_MS: '150' });
  try {
    const session = (await call(second.base, 'POST', '/auth/login', { body: { email: 'boss2@test.mn', password: 'password1' } })).body;
    const make = (title, priority, due) => call(second.base, 'POST', '/work', { token: session.token, body: { title, priority, due, assignedTo: 'w2', subtasks: ['One step'] } });
    const list = async () => (await call(second.base, 'GET', '/work', { token: session.token })).body;
    const shown = async (titles) => {
      const rows = Object.fromEntries((await list()).map((row) => [row.title, row]));
      return titles.map((title) => [rows[title].eisenhower_category, rows[title].eisenhower_source, rows[title].eisenhower_reason]);
    };
    const titles = ['Fix the gas leak', 'Tidy the shelf', 'Plan the menu'];

    // The AI is down, so these are placed by the rules and left for the refresh to pick up.
    const made = [await make(titles[0], 'High', dayFromNow(1)), await make(titles[1], 'Low', 'Unscheduled'), await make(titles[2], 'Medium', dayFromNow(9))];
    assert.deepEqual(made.map((work) => work.body.ai.category), ['rules', 'rules', 'rules']);

    // The AI comes back, but gets the second item of the request wrong.
    matrixRequests.length = 0;
    matrixReason = 'Checked by the daily refresh.';
    aiMode = 'half';
    await waitFor(async () => (await list()).filter((row) => row.eisenhower_source === 'ai').length === 2, 'the refresh to classify the works');
    assert.deepEqual(matrixRequests[0].items.map((item) => [item.title, item.priority, item.due_date]), [
      [titles[0], 'High', dayFromNow(1)], [titles[1], 'Low', null], [titles[2], 'Medium', dayFromNow(9)],
    ], 'all three works went in one request');
    assert.deepEqual(await shown(titles), [
      ['do_first', 'ai', matrixReason],
      ['eliminate', 'rules', 'No due date and priority is Low.'],
      ['schedule', 'ai', matrixReason],
    ]);
    // Nothing is left to ask about today, so the AI is not called again.
    const callsSoFar = matrixRequests.length;
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(matrixRequests.length, callsSoFar);
    assert.equal(callsSoFar, 1);

    // A new day. Finished work is left alone; the open ones are asked about again, together.
    await call(second.base, 'PATCH', `/work/${made[1].body.id}`, { token: session.token, body: { status: 'Done' } });
    matrixRequests.length = 0;
    matrixReason = 'A new day, checked again.';
    aiMode = 'good';
    editDatabase(path, "UPDATE tasks SET eisenhower_checked_on = '2000-01-01'");
    await waitFor(async () => (await shown([titles[0], titles[2]])).every(([, , reason]) => reason === matrixReason), 'the next day\'s refresh');
    assert.deepEqual(matrixRequests[0].items.map((item) => item.title), [titles[0], titles[2]]);
    assert.deepEqual(await shown([titles[0], titles[2]]), [['do_first', 'ai', matrixReason], ['schedule', 'ai', matrixReason]]);
  } finally {
    second.child.kill();
  }
});

test('--demo serves a separate database where the menu card work ranks Haruka 94, Sara 58, Kenji 31', async () => {
  const demoPath = join(folder, 'demo.sqlite');
  const demo = await startServer({ DATABASE_PATH: databasePath, DEMO_DATABASE_PATH: demoPath, AI_BASE_URL: '', AI_API_KEY: '', OPENAI_API_KEY: '' }, ['--demo']);
  try {
    let password;
    for (let attempt = 0; attempt < 50 && !password; attempt += 1) {
      password = /Log in as boss@demo\.bandflow\.invalid \/ (\w+)/.exec(demo.output())?.[1];
      if (!password) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(password, demo.output());
    const session = (await call(demo.base, 'POST', '/auth/login', { body: { email: 'boss@demo.bandflow.invalid', password } })).body;
    const result = (await call(demo.base, 'POST', '/work/recommend', { token: session.token, body: { text: 'Design the new menu card' } })).body;

    assert.equal(result.source, 'keywords');
    assert.deepEqual(result.recommendations.map((entry) => [entry.name, entry.skills, entry.open_works, entry.score, entry.badges]), [
      ['Haruka', ['Design'], 2, 94, ['recommended']],
      ['Sara', ['Design'], 7, 58, ['high_workload']],
      ['Kenji', ['Programming'], 1, 31, ['skill_mismatch']],
    ]);
    // The real database never sees the demo people.
    const real = new DatabaseSync(databasePath, { readOnly: true });
    assert.equal(real.prepare("SELECT COUNT(*) AS count FROM users WHERE email LIKE '%demo.bandflow.invalid'").get().count, 0);
    real.close();
  } finally {
    demo.child.kill();
  }
});
