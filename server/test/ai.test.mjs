import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AiError, breakDownWithAi, classifyByRules, classifyWithAi, createAi, extractSkillsWithAi, localDate, quadrantOf, raiseUrgency, reasonByRules,
  toWatchText, validateBreakdownAnswer, validateClassificationAnswer, validateSkillsAnswer,
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

const answer = (...items) => JSON.stringify({ items });
const entry = (id, urgent, important, reason = 'A short reason.') => ({ id, urgent, important, quadrant: quadrantOf(urgent, important), reason });

test('the request is a standard chat completion with the key as a bearer token', async () => {
  const calls = [];
  const ai = createAi({ AI_API_KEY: 'secret', AI_BASE_URL: 'http://ai.test/v1/', AI_MODEL: 'some-model' }, fakeFetch(answer(entry('w1', false, true)), { calls }));

  const { results, rejected } = await classifyWithAi(ai, [{ id: 'w1', title: 'Plan the menu', priority: 'High', due: 'Unscheduled' }], now);
  assert.deepEqual(results.get('w1'), { urgent: false, important: true, quadrant: 'schedule', reason: 'A short reason.' });
  assert.deepEqual(rejected, []);
  assert.equal(calls[0].url, 'http://ai.test/v1/chat/completions');
  assert.equal(calls[0].headers.Authorization, 'Bearer secret');
  assert.equal(calls[0].body.model, 'some-model');
  assert.deepEqual(calls[0].body.messages.map((message) => message.role), ['system', 'user']);
});

test('the matrix prompt is the team\'s own, and the request has exactly the fields it describes', async () => {
  const calls = [];
  const ai = aiAnswering(answer(entry('a', true, true), entry('b', false, false)), { calls });
  await classifyWithAi(ai, [
    { id: 'a', title: 'Fix the gas leak', priority: 'High', due: day(1), status: 'In Progress', assigned_to: 'someone' },
    { id: 'b', title: 'Tidy the shelf', priority: 'Low', due: 'Unscheduled' },
  ], now);

  const system = calls[0].body.messages[0].content;
  assert.match(system, /^You are the priority-matrix classifier inside BandFlow, a task management system used with a wristband\./);
  assert.match(system, /- urgent = the due date is within 2 days of the current date, or already overdue\./);
  assert.match(system, /- important = the priority is above "Low" \(Medium, High, or Critical\)\./);
  assert.match(system, /- Return every input item exactly once\. Do not add, merge, or drop items\./);
  assert.match(system, /Output: valid JSON only, no markdown, no extra text:/);
  // Many works go in one request, with nothing but id, title, priority and due_date.
  assert.deepEqual(JSON.parse(calls[0].body.messages[1].content), {
    today: '2026-10-05',
    items: [
      { id: 'a', title: 'Fix the gas leak', priority: 'High', due_date: day(1) },
      { id: 'b', title: 'Tidy the shelf', priority: 'Low', due_date: null },
    ],
  });
});

test('JSON wrapped in a code fence or extra words is still read', async () => {
  const ai = aiAnswering(`Sure!\n\`\`\`json\n${answer(entry('a', true, false))}\n\`\`\``);
  assert.equal((await classifyWithAi(ai, [{ id: 'a', title: 'x', priority: 'Low', due: day(1) }], now)).results.get('a').quadrant, 'delegate');
});

test('an unreachable service, an error status and a non-JSON answer all throw AiError', async () => {
  const works = [{ id: 'a', title: 'x', priority: 'Low', due: 'Unscheduled' }];
  const unreachable = createAi({ AI_API_KEY: 'k' }, async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(classifyWithAi(unreachable, works), AiError);
  await assert.rejects(classifyWithAi(aiAnswering('{}', { status: 500 }), works), /returned 500/);
  await assert.rejects(classifyWithAi(aiAnswering('I think it is urgent.'), works), /not a JSON object/);
  await assert.rejects(classifyWithAi(aiAnswering('{"category":"schedule"}'), works), /no items list/);
  await assert.rejects(classifyWithAi(createAi({}), works), /not configured/);
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

const asked = [
  { id: 'soon-high', title: 'Fix the gas leak', priority: 'High', due_date: day(1) },
  { id: 'late-low', title: 'Tidy the shelf', priority: 'Low', due_date: day(9) },
  { id: 'no-date', title: 'Plan the menu', priority: 'Medium', due_date: null },
];
const allRight = [entry('soon-high', true, true), entry('late-low', false, false), entry('no-date', false, true)];
const check = (items) => validateClassificationAnswer({ items }, asked, now);

test('a right answer gives every work its quadrant and reason', () => {
  const { results, rejected } = check(allRight);
  assert.deepEqual([...results].map(([id, result]) => [id, result.quadrant]), [['soon-high', 'do_first'], ['late-low', 'eliminate'], ['no-date', 'schedule']]);
  assert.deepEqual(rejected, []);
  // The order of the answer does not matter, and typographic characters in the reason are made plain.
  const shuffled = check([entry('no-date', false, true, 'It’s  important – no deadline'), allRight[0], allRight[1]]);
  assert.equal(shuffled.results.get('no-date').reason, "It's important - no deadline");
  assert.equal(shuffled.results.size, 3);
});

test('an item the AI got wrong is refused on its own and the rest of the batch is kept', () => {
  const wrong = {
    'urgent is not true or false': { ...entry('soon-high', true, true), urgent: 'yes' },
    'important is missing': { id: 'soon-high', urgent: true, quadrant: 'do_first', reason: 'x' },
    'an unknown quadrant': { ...entry('soon-high', true, true), quadrant: 'Do First' },
    'a quadrant that does not follow from its own flags': { ...entry('soon-high', true, true), quadrant: 'schedule' },
    'urgent that contradicts a due date one day away': entry('soon-high', false, true),
    'important that contradicts a High priority': entry('soon-high', true, false),
    'no reason': { ...entry('soon-high', true, true), reason: undefined },
    'an empty reason': entry('soon-high', true, true, '   '),
    'a reason that runs on': entry('soon-high', true, true, 'word '.repeat(40)),
  };
  for (const [what, bad] of Object.entries(wrong)) {
    const { results, rejected } = check([bad, allRight[1], allRight[2]]);
    assert.deepEqual(rejected.map((item) => item.id), ['soon-high'], what);
    assert.ok(rejected[0].why.length > 5, what);
    assert.deepEqual([...results.keys()], ['late-low', 'no-date'], what);
  }
});

test('a dropped, repeated or invented item is caught', () => {
  const dropped = check([allRight[0], allRight[2]]);
  assert.deepEqual(dropped.rejected, [{ id: 'late-low', why: 'it was left out of the answer' }]);
  assert.equal(dropped.results.size, 2);

  const repeated = check([...allRight, entry('late-low', false, false)]);
  assert.deepEqual(repeated.rejected, [{ id: 'late-low', why: 'it was answered more than once' }]);

  const invented = check([...allRight, entry('made-up', true, true), 'nonsense', null]);
  assert.deepEqual([...invented.results.keys()], ['soon-high', 'late-low', 'no-date']);
  assert.deepEqual(invented.rejected, []);

  for (const bad of [null, {}, { items: 'none' }, { category: 'do_first' }]) assert.throws(() => validateClassificationAnswer(bad, asked, now), AiError);
});

test('urgency follows the calendar exactly: two days away is urgent, three is not, overdue is', () => {
  const dated = (due) => [{ id: 'x', title: 'x', priority: 'High', due_date: due }];
  const accepts = (due, urgent) => validateClassificationAnswer({ items: [entry('x', urgent, true)] }, dated(due), now).results.has('x');
  assert.equal(accepts(day(2), true), true);
  assert.equal(accepts(day(2), false), false);
  assert.equal(accepts(day(3), false), true);
  assert.equal(accepts(day(3), true), false);
  assert.equal(accepts(day(-4), true), true);
  assert.equal(accepts(null, false), true);
  assert.equal(accepts(null, true), false, 'a missing due date is never urgent');
});

test('only a missing priority leaves importance to the AI', () => {
  const judged = (priority, important) => validateClassificationAnswer({ items: [entry('x', false, important)] }, [{ id: 'x', title: 'Fix the gas leak', priority, due_date: null }], now).results.has('x');
  assert.equal(judged(null, true), true);
  assert.equal(judged(null, false), true);
  for (const priority of ['Medium', 'High', 'Critical']) {
    assert.equal(judged(priority, true), true, priority);
    assert.equal(judged(priority, false), false, priority);
  }
  assert.equal(judged('Low', false), true);
  assert.equal(judged('Low', true), false);
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

test('the rules and the quadrant table agree, including Critical priority', () => {
  assert.deepEqual([quadrantOf(true, true), quadrantOf(false, true), quadrantOf(true, false), quadrantOf(false, false)], ['do_first', 'schedule', 'delegate', 'eliminate']);
  assert.equal(classifyByRules({ priority: 'Critical', due: day(0) }, now), 'do_first');
  assert.equal(classifyByRules({ priority: 'Critical', due: 'Unscheduled' }, now), 'schedule');
  assert.equal(localDate(now), '2026-10-05');
});

test('without an AI sentence the rules explain the quadrant in a few plain words', () => {
  const reason = (category, priority, due) => reasonByRules(category, { priority, due }, now);
  assert.equal(reason('do_first', 'High', day(1)), 'Due tomorrow and priority is High.');
  assert.equal(reason('do_first', 'Medium', day(0)), 'Due today and priority is Medium.');
  assert.equal(reason('do_first', 'High', day(2)), 'Due in 2 days and priority is High.');
  assert.equal(reason('do_first', 'High', day(-1)), 'Overdue by 1 day and priority is High.');
  assert.equal(reason('delegate', 'Low', day(-3)), 'Overdue by 3 days and priority is Low.');
  assert.equal(reason('schedule', 'Medium', day(9)), 'Not due for 9 days and priority is Medium.');
  assert.equal(reason('schedule', 'High', 'Unscheduled'), 'No due date and priority is High.');
  assert.equal(reason('eliminate', 'Low', 'Unscheduled'), 'No due date and priority is Low.');
  // A category that something else chose against the priority is not explained by the priority.
  assert.equal(reason('eliminate', 'High', 'Unscheduled'), 'No due date and it was judged less important.');
  assert.equal(reason('schedule', 'Low', day(9)), 'Not due for 9 days and it was judged important.');
  for (const text of [reason('do_first', 'High', day(-12)), reason('schedule', 'Medium', day(40))]) assert.ok(text.split(' ').length < 15, text);
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
