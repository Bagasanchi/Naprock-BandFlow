// Worker recommendation and workload levels. Everything here is plain arithmetic on purpose: the AI only
// names the skills a work needs, and this file turns skills + open works into a score anyone can check.

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// ---- Workload ------------------------------------------------------------------------------------------

// A worker is Light below busyAt open works, Busy from busyAt, and Overloaded from overloadedAt.
export const defaultWorkloadLimits = { busyAt: 5, overloadedAt: 7 };

export const readWorkloadLimits = (env = process.env) => {
  const busyAt = Number(env.WORKLOAD_BUSY_AT || defaultWorkloadLimits.busyAt);
  const overloadedAt = Number(env.WORKLOAD_OVERLOADED_AT || defaultWorkloadLimits.overloadedAt);
  if (!Number.isInteger(busyAt) || !Number.isInteger(overloadedAt) || busyAt < 1 || overloadedAt <= busyAt) {
    console.warn('WORKLOAD_BUSY_AT and WORKLOAD_OVERLOADED_AT must be whole numbers with 1 <= busy < overloaded; using the defaults.');
    return { ...defaultWorkloadLimits };
  }
  return { busyAt, overloadedAt };
};

export const workloadLevel = (openWorks, limits = defaultWorkloadLimits) => {
  if (openWorks >= limits.overloadedAt) return 'overloaded';
  return openWorks >= limits.busyAt ? 'busy' : 'light';
};

export const describeWorkload = (openWorks, limits = defaultWorkloadLimits) => ({
  open: openWorks,
  level: workloadLevel(openWorks, limits),
  busy_at: limits.busyAt,
  overloaded_at: limits.overloadedAt,
});

// ---- Skill tags ----------------------------------------------------------------------------------------

export const maxSkills = 12;
export const maxSkillLength = 24;

// Checks a skills list sent by the app. Returns the cleaned list or throws a 400 error.
export const normalizeSkills = (value) => {
  if (!Array.isArray(value)) throw badRequest('Skills must be a list of short tags.');
  const seen = new Set();
  const skills = [];
  for (const item of value) {
    if (typeof item !== 'string') throw badRequest('Each skill must be text.');
    const tag = item.replace(/\s+/g, ' ').trim();
    if (!tag) continue;
    if (tag.length > maxSkillLength) throw badRequest(`A skill can be at most ${maxSkillLength} characters.`);
    if (/[\p{Cc},;]/u.test(tag)) throw badRequest('Skills cannot contain commas or control characters.');
    if (seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    skills.push(tag);
  }
  if (skills.length > maxSkills) throw badRequest(`A worker can have at most ${maxSkills} skills.`);
  return skills;
};

// Reads the skills column (a JSON array, or NULL for accounts created before skills existed).
export const parseSkills = (stored) => {
  try {
    const parsed = JSON.parse(stored ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
};

const suffixes = ['ations', 'ation', 'ings', 'ing', 'ians', 'ian', 'ers', 'er', 'ists', 'ist', 'ions', 'ion', 'als', 'al', 'ed', 'es', 's', 'e'];

// Rough word stem so "Design", "designer" and "designing" count as the same skill.
const stem = (word) => {
  let result = word;
  const suffix = suffixes.find((ending) => result.endsWith(ending) && result.length - ending.length >= 3);
  if (suffix) result = result.slice(0, -suffix.length);
  if (result.length > 3 && result.at(-1) === result.at(-2)) result = result.slice(0, -1);
  return result;
};

const words = (text) => String(text ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export const skillKey = (tag) => words(tag).map(stem).join(' ');

// Fallback when the AI is unavailable: the team's skill tags whose words all appear in the work text.
export const keywordSkills = (text, knownSkills) => {
  const textStems = new Set(words(text).map(stem));
  const found = new Map();
  for (const tag of knownSkills) {
    const key = skillKey(tag);
    if (key && !found.has(key) && key.split(' ').every((part) => textStems.has(part))) found.set(key, tag);
  }
  return [...found.values()];
};

// ---- Score ---------------------------------------------------------------------------------------------

// score = 66 x (share of needed skills the worker has) + 34 - workload cost - status cost, kept within 0-100.
// Each open work costs 3 points while the worker is Light and 10 points from the Busy threshold on, so a
// skilled worker with a full plate can drop below an unskilled worker with a free one.
export const scoring = { skillPoints: 66, availabilityPoints: 34, lightCost: 3, heavyCost: 10, statusCost: { active: 0, away: 15, offline: 30 } };

export const workloadCost = (openWorks, limits = defaultWorkloadLimits) => {
  const lightWorks = Math.min(openWorks, limits.busyAt - 1);
  return lightWorks * scoring.lightCost + (openWorks - lightWorks) * scoring.heavyCost;
};

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// worker: { id, name, skills: string[], openWorks: number, status: 'active' | 'away' | 'offline' }
export const scoreWorker = (worker, requiredSkills, limits = defaultWorkloadLimits) => {
  const ownKeys = new Map(worker.skills.map((tag) => [skillKey(tag), tag]));
  // Matched skills are reported in the worker's own wording, so the app can highlight those tags.
  const matched = requiredSkills.filter((tag) => ownKeys.has(skillKey(tag))).map((tag) => ownKeys.get(skillKey(tag)));
  const missing = requiredSkills.filter((tag) => !ownKeys.has(skillKey(tag)));
  // A work that needs no particular skill does not hold anyone back, so only workload and status decide.
  const skillMatch = requiredSkills.length ? matched.length / requiredSkills.length : 1;
  const status = worker.status in scoring.statusCost ? worker.status : 'active';
  const raw = scoring.skillPoints * skillMatch + scoring.availabilityPoints - workloadCost(worker.openWorks, limits) - scoring.statusCost[status];
  const level = workloadLevel(worker.openWorks, limits);

  const skillReason = !requiredSkills.length ? 'No specific skill needed'
    : !matched.length ? `No ${missing.join(' or ')} skill`
    : missing.length ? `Has ${matched.join(', ')}, missing ${missing.join(', ')}`
    : `Has ${matched.join(', ')}`;
  const reason = `${skillReason}; ${plural(worker.openWorks, 'open work')}${level === 'light' ? '' : ` (${level})`}${status === 'active' ? '' : `; ${status}`}`;

  return {
    worker_id: worker.id,
    name: worker.name,
    score: Math.max(0, Math.min(100, Math.round(raw))),
    skill_match: Math.round(skillMatch * 100) / 100,
    open_works: worker.openWorks,
    status,
    reason,
    skills: worker.skills,
    matched_skills: matched,
    workload: describeWorkload(worker.openWorks, limits),
  };
};

// Best first. Ties go to the worker with fewer open works, then by name so the order never flickers.
export const rankWorkers = (workers, requiredSkills, limits = defaultWorkloadLimits) => {
  const ranked = workers.map((worker) => scoreWorker(worker, requiredSkills, limits))
    .sort((a, b) => b.score - a.score || a.open_works - b.open_works || a.name.localeCompare(b.name));
  return ranked.map((entry, index) => {
    const badges = [];
    if (index === 0 && entry.skill_match > 0) badges.push('recommended');
    if (requiredSkills.length && entry.skill_match === 0) badges.push('skill_mismatch');
    if (entry.workload.level === 'overloaded') badges.push('high_workload');
    if (entry.status !== 'active') badges.push(entry.status);
    return { ...entry, badges };
  });
};
