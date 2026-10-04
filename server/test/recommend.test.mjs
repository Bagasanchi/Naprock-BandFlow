import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywordSkills, normalizeSkills, parseSkills, rankWorkers, readWorkloadLimits, scoreWorker, workloadLevel } from '../recommend.mjs';

const worker = (name, skills, openWorks, status = 'active') => ({ id: name.toLowerCase(), name, skills, openWorks, status });
const scoreOf = (ranking, name) => ranking.find((entry) => entry.name === name).score;

test('right skill + fewer open works beats right skill but busy, and beats free but wrong skill', () => {
  const ranking = rankWorkers([
    worker('Busy Designer', ['Design'], 7),
    worker('Free Programmer', ['Programming'], 0),
    worker('Free Designer', ['Design'], 1),
  ], ['Design']);

  assert.equal(ranking[0].name, 'Free Designer');
  assert.ok(scoreOf(ranking, 'Free Designer') > scoreOf(ranking, 'Busy Designer'));
  assert.ok(scoreOf(ranking, 'Free Designer') > scoreOf(ranking, 'Free Programmer'));
  assert.deepEqual(ranking[0].badges, ['recommended']);
});

test('the demo scene scores 94 / 58 / 31 with the right badges', () => {
  const ranking = rankWorkers([worker('Kenji', ['Programming'], 1), worker('Sara', ['Design'], 7), worker('Haruka', ['Design'], 2)], ['Design']);

  assert.deepEqual(ranking.map((entry) => [entry.name, entry.score, entry.badges]), [
    ['Haruka', 94, ['recommended']],
    ['Sara', 58, ['high_workload']],
    ['Kenji', 31, ['skill_mismatch']],
  ]);
  assert.equal(ranking[0].reason, 'Has Design; 2 open works');
  assert.equal(ranking[1].reason, 'Has Design; 7 open works (overloaded)');
  assert.equal(ranking[2].reason, 'No Design skill; 1 open work');
});

test('both factors move the score on their own', () => {
  const required = ['Design'];
  // Same skill, one more open work each time: the score must fall every step.
  const byLoad = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((open) => scoreWorker(worker('A', ['Design'], open), required).score);
  byLoad.slice(1).forEach((score, index) => assert.ok(score < byLoad[index], `score should fall at ${index + 1} open works`));
  // Same workload, more of the needed skills: the score must rise.
  const none = scoreWorker(worker('A', [], 2), ['Design', 'Printing']).score;
  const half = scoreWorker(worker('A', ['Design'], 2), ['Design', 'Printing']).score;
  const full = scoreWorker(worker('A', ['Design', 'Printing'], 2), ['Design', 'Printing']).score;
  assert.ok(none < half && half < full);
});

test('a skilled worker ranks above an unskilled free one only while the score says so', () => {
  const free = scoreWorker(worker('Free', [], 0), ['Design']);
  assert.ok(scoreWorker(worker('Skilled', ['Design'], 7), ['Design']).score > free.score);
  assert.ok(scoreWorker(worker('Skilled', ['Design'], 10), ['Design']).score < free.score);
});

test('away and offline workers rank lower and are flagged', () => {
  const ranking = rankWorkers([worker('Off', ['Design'], 1, 'offline'), worker('Away', ['Design'], 1, 'away'), worker('Here', ['Design'], 1)], ['Design']);

  assert.deepEqual(ranking.map((entry) => entry.name), ['Here', 'Away', 'Off']);
  assert.deepEqual(ranking[1].badges, ['away']);
  assert.deepEqual(ranking[2].badges, ['offline']);
  assert.match(ranking[2].reason, /offline$/);
});

test('a work that needs no particular skill is ranked by workload alone', () => {
  const ranking = rankWorkers([worker('Loaded', ['Design'], 6), worker('Idle', [], 0)], []);

  assert.equal(ranking[0].name, 'Idle');
  assert.equal(ranking[0].score, 100);
  assert.equal(ranking[0].skill_match, 1);
  assert.ok(!ranking.some((entry) => entry.badges.includes('skill_mismatch')));
});

test('nobody is called recommended when no one has the skill', () => {
  const ranking = rankWorkers([worker('A', ['Cooking'], 0), worker('B', [], 1)], ['Design']);
  assert.ok(ranking.every((entry) => !entry.badges.includes('recommended') && entry.badges.includes('skill_mismatch')));
});

test('skills match across word forms and letter case', () => {
  assert.equal(scoreWorker(worker('A', ['graphic design'], 0), ['Graphic Designer']).skill_match, 1);
  assert.equal(scoreWorker(worker('A', ['Programmer'], 0), ['programming']).skill_match, 1);
  assert.equal(scoreWorker(worker('A', ['Welding'], 0), ['Painting']).skill_match, 0);
});

test('keyword fallback finds the team tags mentioned in the work text', () => {
  const tags = ['Design', 'Programming', 'Food safety', 'Electrician'];
  assert.deepEqual(keywordSkills('Design the new menu card', tags), ['Design']);
  assert.deepEqual(keywordSkills('Program the order printer and check the electrical panel', tags), ['Programming', 'Electrician']);
  assert.deepEqual(keywordSkills('Write the food hygiene and safety checklist', tags), ['Food safety']);
  assert.deepEqual(keywordSkills('Sweep the yard', tags), []);
});

test('workload levels follow the configurable thresholds', () => {
  assert.deepEqual([0, 4, 5, 6, 7, 12].map((open) => workloadLevel(open)), ['light', 'light', 'busy', 'busy', 'overloaded', 'overloaded']);
  const limits = readWorkloadLimits({ WORKLOAD_BUSY_AT: '2', WORKLOAD_OVERLOADED_AT: '4' });
  assert.deepEqual([1, 2, 3, 4].map((open) => workloadLevel(open, limits)), ['light', 'busy', 'busy', 'overloaded']);
  assert.deepEqual(readWorkloadLimits({ WORKLOAD_BUSY_AT: '9', WORKLOAD_OVERLOADED_AT: '3' }), { busyAt: 5, overloadedAt: 7 });
});

test('skills lists are cleaned and bad ones are refused', () => {
  assert.deepEqual(normalizeSkills(['  Design ', 'design', 'Food   safety', '']), ['Design', 'Food safety']);
  assert.throws(() => normalizeSkills('Design'), /list/);
  assert.throws(() => normalizeSkills([42]), /text/);
  assert.throws(() => normalizeSkills(['x'.repeat(25)]), /at most 24/);
  assert.throws(() => normalizeSkills(['a,b']), /commas/);
  assert.throws(() => normalizeSkills(Array.from({ length: 13 }, (_, index) => `skill ${index}`)), /at most 12/);
  assert.deepEqual(parseSkills(null), []);
  assert.deepEqual(parseSkills('not json'), []);
  assert.deepEqual(parseSkills('["Design"]'), ['Design']);
});
