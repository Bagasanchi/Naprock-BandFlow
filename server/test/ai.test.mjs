import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AiError, breakDownWithAi, classifyByRules, classifyWithAi, createAi, extractSkillsWithAi, raiseUrgency, toWatchText,
  validateBreakdownAnswer, validateClassification, validateSkillsAnswer,
} from '../ai.mjs';

// A stand-in for the chat-completions endpoint: answers every request with the given text.
const fakeFetch = (content, { status = 200, calls = [] } = {}) => async (url, options) => {
  calls.push({ url, body: JSON.parse(options.body), headers: options.headers });
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
};
const aiAnswering = (content, options) => createAi({ AI_API_KEY: 'test-key' }, fakeFetch(content, options));
const day = (offset) => {
  const date = new Date(2026, 9, 5 + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const now = new Date(2026, 9, 5, 14, 30);

test('AI is off without a key and on with one', () => {
  assert.equal(createAi({}).enabled, false);
  assert.equal(createAi({ AI_BASE_URL: 'http://localhost:11434/v1' }).enabled, false, 'a local server still needs a model name');
  assert.equal(createAi({ AI_BASE_URL: 'http://localhost:11434/v1', AI_MODEL: 'llama3' }).enabled, true);
  assert.equal(createAi({ OPENAI_API_KEY: 'k' }).enabled, true);
});

test('the request is a standard chat completion with the key as a bearer token', async () => {
  const calls = [];
  const ai = createAi({ AI_API_KEY: 'secret', AI_BASE_URL: 'http://ai.test/v1/', AI_MODEL: 'some-model' }, fakeFetch('{"category":"schedule"}', { calls }));

  assert.equal(await classifyWithAi(ai, { title: 'Plan the menu', priority: 'High', due: 'Unscheduled' }, now), 'schedule');
  assert.equal(calls[0].url, 'http://ai.test/v1/chat/completions');
  assert.equal(calls[0].headers.Authorization, 'Bearer secret');
  assert.equal(calls[0].body.model, 'some-model');
  assert.deepEqual(calls[0].body.messages.map((message) => message.role), ['system', 'user']);
  assert.equal(JSON.parse(calls[0].body.messages[1].content).today, '2026-10-05');
});

test('JSON wrapped in a code fence or extra words is still read', async () => {
  const ai = aiAnswering('Sure!\n```json\n{"category": "delegate"}\n```');
  assert.equal(await classifyWithAi(ai, { title: 'x', priority: 'Low', due: day(1) }, now), 'delegate');
});

test('an unreachable service, an error status and a non-JSON answer all throw AiError', async () => {
  const unreachable = createAi({ AI_API_KEY: 'k' }, async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(classifyWithAi(unreachable, { title: 'x', priority: 'Low', due: 'Unscheduled' }), AiError);
  await assert.rejects(classifyWithAi(aiAnswering('{}', { status: 500 }), { title: 'x', priority: 'Low', due: 'Unscheduled' }), /returned 500/);
  await assert.rejects(classifyWithAi(aiAnswering('I think it is urgent.'), { title: 'x', priority: 'Low', due: 'Unscheduled' }), /not a JSON object/);
  await assert.rejects(classifyWithAi(createAi({}), { title: 'x', priority: 'Low', due: 'Unscheduled' }), /not configured/);
});

test('a server that rejects response_format gets one retry without it', async () => {
  const bodies = [];
  const ai = createAi({ AI_API_KEY: 'k' }, async (url, options) => {
    const body = JSON.parse(options.body);
    bodies.push(body);
    if (body.response_format) return new Response('{}', { status: 400 });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"skills":["Design"]}' } }] }));
  });
  assert.deepEqual(await extractSkillsWithAi(ai, { text: 'Design the menu', knownSkills: ['Design'] }), ['Design']);
  assert.equal(bodies.length, 2);
});

test('classification accepts only the four categories', () => {
  assert.equal(validateClassification({ category: 'do_first' }), 'do_first');
  for (const bad of [{ category: 'urgent' }, { category: 'Do First' }, {}, null, { category: ['do_first'] }]) assert.throws(() => validateClassification(bad), AiError);
});

test('rule fallback: urgent = due within 2 days or overdue, important = above Low', () => {
  assert.equal(classifyByRules({ priority: 'High', due: day(2) }, now), 'do_first');
  assert.equal(classifyByRules({ priority: 'Medium', due: day(-3) }, now), 'do_first');
  assert.equal(classifyByRules({ priority: 'Medium', due: day(3) }, now), 'schedule');
  assert.equal(classifyByRules({ priority: 'High', due: 'Unscheduled' }, now), 'schedule');
  assert.equal(classifyByRules({ priority: 'Low', due: day(0) }, now), 'delegate');
  assert.equal(classifyByRules({ priority: 'Low', due: day(9) }, now), 'eliminate');
});

test('a close deadline makes an AI category urgent but never changes its importance', () => {
  assert.equal(raiseUrgency('schedule', day(1), now), 'do_first');
  assert.equal(raiseUrgency('eliminate', day(-1), now), 'delegate');
  assert.equal(raiseUrgency('schedule', day(5), now), 'schedule');
  assert.equal(raiseUrgency('delegate', day(5), now), 'delegate');
});

test('a valid breakdown becomes ordered steps with at most one earlier prerequisite', () => {
  const steps = validateBreakdownAnswer({ steps: [
    { n: 1, text: 'Collect the dish list', depends_on: null },
    { n: 2, text: 'Sketch the layout', depends_on: 1 },
    { n: 3, text: 'Send it to the printer', depends_on: 2 },
  ] });
  assert.deepEqual(steps, [
    { description: 'Collect the dish list', order_index: 1, depends_on_order_index: null },
    { description: 'Sketch the layout', order_index: 2, depends_on_order_index: 1 },
    { description: 'Send it to the printer', order_index: 3, depends_on_order_index: 2 },
  ]);
});

test('typographic characters and accents are made plain for the watch', () => {
  assert.equal(toWatchText('Check the  café’s “menu” – twice…'), 'Check the cafe\'s "menu" - twice...');
  assert.deepEqual(validateBreakdownAnswer({ steps: [{ n: 1, text: 'Print the café menu', depends_on: null }] })[0].description, 'Print the cafe menu');
});

test('invalid breakdowns are refused whole', () => {
  const step = (overrides) => ({ steps: [{ n: 1, text: 'First step', depends_on: null }, { n: 2, text: 'Second step', depends_on: null, ...overrides }] });
  const bad = [
    null,
    {},
    { steps: [] },
    { steps: 'Do it' },
    { steps: Array.from({ length: 13 }, (_, index) => ({ n: index + 1, text: 'Step', depends_on: null })) },
    step({ n: 3 }),
    step({ text: '' }),
    step({ text: 42 }),
    step({ text: 'x'.repeat(81) }),
    step({ text: 'Проверить меню' }),
    step({ text: 'Ship it \u{1F680}' }),
    step({ depends_on: 2 }),
    step({ depends_on: 3 }),
    step({ depends_on: 0 }),
    step({ depends_on: '1' }),
  ];
  for (const answer of bad) assert.throws(() => validateBreakdownAnswer(answer), AiError, JSON.stringify(answer)?.slice(0, 80));
});

test('finished steps are passed to the AI when a work is broken down again', async () => {
  const calls = [];
  const ai = aiAnswering('{"steps":[{"n":1,"text":"Print the menu","depends_on":null}]}', { calls });
  await breakDownWithAi(ai, { title: 'Design the new menu card', priority: 'High', due: 'Unscheduled', finishedSteps: ['Sketch the layout'] });
  assert.deepEqual(JSON.parse(calls[0].body.messages[1].content).finished_steps, ['Sketch the layout']);
});

test('extracted skills must be a short list of short text tags', () => {
  assert.deepEqual(validateSkillsAnswer({ skills: [' Design ', 'design', 'Printing'] }), ['Design', 'Printing']);
  assert.deepEqual(validateSkillsAnswer({ skills: [] }), []);
  for (const bad of [{}, { skills: 'Design' }, { skills: [1] }, { skills: [''] }, { skills: ['x'.repeat(31)] }, { skills: ['a', 'b', 'c', 'd', 'e', 'f'] }]) {
    assert.throws(() => validateSkillsAnswer(bad), AiError, JSON.stringify(bad));
  }
});
