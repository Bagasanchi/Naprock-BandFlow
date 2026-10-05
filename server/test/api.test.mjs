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
  category: { category: 'eliminate' },
  steps: { steps: [
    { n: 1, text: 'Collect the dish list', depends_on: null },
    { n: 2, text: 'Sketch the layout', depends_on: 1 },
    { n: 3, text: 'Send it to the printer', depends_on: 2 },
  ] },
  skills: { skills: ['Design'] },
};
let aiMode = 'good';
let aiCalls = 0;
const fakeAi = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  aiCalls += 1;
  if (aiMode === 'down') return response.writeHead(500).end('{}');
  const system = JSON.parse(body).messages[0].content;
  const kind = system.includes('Eisenhower') ? 'category' : system.includes('wristband') ? 'steps' : 'skills';
  const answers = {
    good: goodAnswers,
    garbage: { category: { category: 'whenever' }, steps: { steps: [{ n: 1, text: 'План', depends_on: 5 }] }, skills: { skills: 'Design' } },
    prose: null,
  }[aiMode];
  const content = answers ? JSON.stringify(answers[kind]) : 'Sorry, I cannot help with that.';
  response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ choices: [{ message: { content } }] }));
});

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
  // The rules would say "schedule" for a High work with no due date, so "eliminate" can only be the AI's answer.
  assert.equal(created.body.eisenhower_category, 'eliminate');

  const inApp = (await call(base, 'GET', '/work', { token: tokens.worker })).body.find((row) => row.id === created.body.id);
  assert.equal(inApp.eisenhower_category, 'eliminate');
  assert.equal(inApp.eisenhower_source, 'ai');
  assert.deepEqual(inApp.subtask_details.map((step) => [step.status, step.locked]), [['active', false], ['pending', true], ['pending', true]]);

  // Link a watch to the worker and read the same work through the watch's channel.
  const bandId = 'aa:bb:cc:dd:ee:01';
  const { code } = await rpc(bandId, { t: 'pair' });
  assert.equal((await call(base, 'POST', '/band/link', { token: tokens.worker, body: { code } })).status, 200);
  assert.deepEqual((await rpc(bandId, { t: 'matrix' })).counts, { do_first: 0, schedule: 0, delegate: 0, eliminate: 1 });
  assert.equal((await rpc(bandId, { t: 'works', cat: 'eliminate' })).works[0].id, created.body.id);
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
    const tomorrow = new Date(Date.now() + 86_400_000);
    const due = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    const created = await call(base, 'POST', '/work', { token: tokens.boss, body: { title: `Restock the bar (${mode})`, priority: 'Medium', due, assignedTo: 'old-worker' } });

    assert.equal(created.status, 201);
    assert.deepEqual(created.body.subtasks, [`Restock the bar (${mode})`]);
    assert.deepEqual(created.body.ai, { breakdown: 'fallback', category: 'rules' });
    assert.equal(created.body.eisenhower_category, 'do_first');
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
