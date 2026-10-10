// The AI layer: one provider-neutral chat call, the three prompts BandFlow uses, and strict checks on
// every answer. Nothing here touches the database; callers fall back to simple rules when a call throws.
//
// Any service with the OpenAI-style "POST <base>/chat/completions" API works (OpenAI, Ollama, Groq,
// OpenRouter, LM Studio, ...). Settings: AI_BASE_URL, AI_API_KEY (or OPENAI_API_KEY), AI_MODEL.

const openAiBaseUrl = 'https://api.openai.com/v1';

export class AiError extends Error {}

export const createAi = (env = process.env, fetchImpl = fetch) => {
  const baseUrl = (env.AI_BASE_URL || openAiBaseUrl).replace(/\/$/, '');
  const apiKey = env.AI_API_KEY || env.OPENAI_API_KEY || '';
  const model = env.AI_MODEL || (baseUrl === openAiBaseUrl ? 'gpt-4o-mini' : '');
  const timeoutMs = Number(env.AI_TIMEOUT_MS) > 0 ? Number(env.AI_TIMEOUT_MS) : 15000;
  // A hosted service needs a key; a local one (AI_BASE_URL set) only needs a model name.
  const enabled = Boolean(model) && Boolean(apiKey || env.AI_BASE_URL);
  const status = enabled ? `${model} at ${baseUrl}`
    : env.AI_BASE_URL && !model ? 'off (AI_BASE_URL is set but AI_MODEL is missing)'
    : 'off (set AI_API_KEY, or AI_BASE_URL and AI_MODEL)';

  const post = (body) => fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  // Sends one system + user message and returns the JSON object the model answered with.
  const askJson = async (system, user) => {
    if (!enabled) throw new AiError('AI is not configured.');
    const body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
    let response;
    try {
      response = await post({ ...body, response_format: { type: 'json_object' } });
      // Some servers do not know response_format; the prompt already asks for JSON only, so retry without it.
      if (response.status === 400) response = await post(body);
    } catch (error) {
      throw new AiError(`AI service unreachable: ${error instanceof Error ? error.message : error}`);
    }
    if (!response.ok) throw new AiError(`AI service returned ${response.status}.`);
    const reply = await response.json().catch(() => null);
    const content = reply?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiError('AI answer had no text.');
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    try {
      const parsed = JSON.parse(content.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to the error below
    }
    throw new AiError('AI answer was not a JSON object.');
  };

  return { enabled, status, askJson };
};

// ---- Text the watch can show ---------------------------------------------------------------------------

// The watch font only has ASCII, so common typographic characters and accents are swapped for plain ones.
export const toWatchText = (value) => String(value ?? '')
  .replace(/[‘’‚′]/g, "'")
  .replace(/[“”„″]/g, '"')
  .replace(/[‐-―−]/g, '-')
  .replace(/…/g, '...')
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const isWatchText = (text) => /^[\x20-\x7E]+$/.test(text);

// ---- 1. Priority matrix --------------------------------------------------------------------------------

export const eisenhowerCategories = ['do_first', 'schedule', 'delegate', 'eliminate'];
export const urgentWithinDays = 2;
const knownPriorities = ['Low', 'Medium', 'High', 'Critical'];
// The longest explanation that is kept. The prompt asks for under 15 words; this leaves room for a wordy model.
export const maxReasonLength = 120;

export const localDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// Whole days from today to a YYYY-MM-DD due date (negative when overdue); null for "Unscheduled".
export const daysUntilDue = (due, now = new Date()) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due ?? '');
  if (!match) return null;
  const dueDay = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
};

export const isUrgent = (due, now = new Date()) => {
  const days = daysUntilDue(due, now);
  return days !== null && days <= urgentWithinDays;
};

// Everything above Low is important: Medium, High and Critical.
export const isImportant = (priority) => priority !== 'Low';

export const quadrantOf = (urgent, important) => (important ? (urgent ? 'do_first' : 'schedule') : (urgent ? 'delegate' : 'eliminate'));

// Fallback without AI. These are the same definitions the prompt below gives the AI.
export const classifyByRules = ({ priority, due }, now = new Date()) => quadrantOf(isUrgent(due, now), isImportant(priority));

// A category was chosen on one day. A deadline that has since come close makes the work urgent whatever
// was decided then; its importance stays as it was.
export const raiseUrgency = (category, due, now = new Date()) => {
  if (!isUrgent(due, now)) return category;
  return category === 'schedule' ? 'do_first' : category === 'eliminate' ? 'delegate' : category;
};

// One plain sentence for why a work sits in its quadrant, used whenever there is no AI sentence for today.
export const reasonByRules = (category, { priority, due }, now = new Date()) => {
  const days = daysUntilDue(due, now);
  const count = (number) => `${number} day${number === 1 ? '' : 's'}`;
  const when = days === null ? 'No due date'
    : days < 0 ? `Overdue by ${count(-days)}`
    : days === 0 ? 'Due today'
    : days === 1 ? 'Due tomorrow'
    : days <= urgentWithinDays ? `Due in ${count(days)}`
    : `Not due for ${count(days)}`;
  const important = category === 'do_first' || category === 'schedule';
  // The category disagrees with the priority only when something other than these rules chose it.
  const why = important === isImportant(priority) ? `priority is ${priority}` : important ? 'it was judged important' : 'it was judged less important';
  return `${when} and ${why}.`;
};

// The system prompt, word for word as the team wrote it. Only the number of days comes from the constant
// above, so the prompt and the rule fallback cannot drift apart.
const classificationPrompt = `You are the priority-matrix classifier inside BandFlow, a task management system used with a wristband.

Your job: place each work item into exactly one of four quadrants.

Definitions:
- urgent = the due date is within ${urgentWithinDays} days of the current date, or already overdue.
- important = the priority is above "Low" (Medium, High, or Critical).

Quadrants:
- "do_first"  = urgent AND important
- "schedule"  = NOT urgent AND important
- "delegate"  = urgent AND NOT important
- "eliminate" = NOT urgent AND NOT important

Rules:
- Use only the fields given. Do not invent due dates or priorities.
- If a due date is missing, treat the item as NOT urgent.
- If a priority is missing, treat the item as important only if the title clearly describes a safety, customer, or deadline matter. Otherwise treat it as NOT important.
- Return every input item exactly once. Do not add, merge, or drop items.
- "reason" is one short sentence (under 15 words) in plain English.

Input (JSON):
{ "today": "YYYY-MM-DD", "items": [ { "id": "string", "title": "string", "priority": "Low|Medium|High|Critical|null", "due_date": "YYYY-MM-DD|null" } ] }

Output: valid JSON only, no markdown, no extra text:
{ "items": [ { "id": "string", "urgent": true, "important": true, "quadrant": "do_first|schedule|delegate|eliminate", "reason": "string" } ] }`;

// What is wrong with one answered item, or null when it holds up. The definitions are exact, so an answer
// that contradicts the due date or the priority is a mistake by the model, not a judgment. Only a missing
// priority leaves the AI a real choice (it then decides importance from the title).
const faultInClassification = (entry, item, now) => {
  if (typeof entry.urgent !== 'boolean' || typeof entry.important !== 'boolean') return 'urgent and important must be true or false';
  if (!eisenhowerCategories.includes(entry.quadrant)) return 'the quadrant is not one of the four';
  if (entry.quadrant !== quadrantOf(entry.urgent, entry.important)) return 'the quadrant does not follow from urgent and important';
  if (entry.urgent !== isUrgent(item.due_date, now)) return 'urgent contradicts the due date';
  if (knownPriorities.includes(item.priority) && entry.important !== isImportant(item.priority)) return 'important contradicts the priority';
  if (typeof entry.reason !== 'string') return 'the reason is missing';
  const reason = toWatchText(entry.reason);
  if (!reason || reason.length > maxReasonLength) return 'the reason is empty or too long';
  return null;
};

// Checks the answer against the items that were sent, one by one. Returns the answers that hold up (by id)
// and, for every other requested item, why it was refused, so one bad item never spoils the rest of a
// batch. Items the AI added on its own are ignored. Throws only when there is no items list at all.
export const validateClassificationAnswer = (answer, items, now = new Date()) => {
  if (!Array.isArray(answer?.items)) throw new AiError('AI classification has no items list.');
  const requested = new Map(items.map((item) => [item.id, item]));
  const answered = new Map();
  for (const entry of answer.items) {
    const id = entry && typeof entry === 'object' ? entry.id : undefined;
    if (requested.has(id)) answered.set(id, answered.has(id) ? 'twice' : entry);
  }
  const results = new Map();
  const rejected = [];
  for (const [id, item] of requested) {
    const entry = answered.get(id);
    const why = entry === undefined ? 'it was left out of the answer'
      : entry === 'twice' ? 'it was answered more than once'
      : faultInClassification(entry, item, now);
    if (why) rejected.push({ id, why });
    else results.set(id, { urgent: entry.urgent, important: entry.important, quadrant: entry.quadrant, reason: toWatchText(entry.reason) });
  }
  return { results, rejected };
};

// Classifies any number of works in one call. items: [{ id, title, priority, due }], where due is
// YYYY-MM-DD or anything else for "no due date". Returns { results: Map(id -> { urgent, important,
// quadrant, reason }), rejected: [{ id, why }] }. Throws AiError when the service fails.
export const classifyWithAi = async (ai, items, now = new Date()) => {
  const request = {
    today: localDate(now),
    items: items.map((item) => ({
      id: String(item.id),
      title: String(item.title).slice(0, 300),
      priority: item.priority ?? null,
      due_date: daysUntilDue(item.due, now) === null ? null : item.due,
    })),
  };
  return validateClassificationAnswer(await ai.askJson(classificationPrompt, JSON.stringify(request)), request.items, now);
};

// ---- 2. Task breakdown ---------------------------------------------------------------------------------

export const maxAiSteps = 12;
// Steps longer than this are cut with "..." in the watch's task list, so an answer with one is rejected.
export const maxStepLength = 80;

const breakdownPrompt = `You break one piece of work into steps for a worker who reads them one at a time on a small wristband screen.
Rules:
- 2 to 8 steps, in the order they should be done. Use fewer steps for simple work.
- Each step is one concrete action in plain English that starts with a verb, at most 60 characters.
- Use only ASCII letters, digits and basic punctuation. No emoji, no quotation marks, no line breaks.
- A step may depend on at most one earlier step. Set "depends_on" to that step's number, or null when it can start right away.
- If "finished_steps" is given, those are already done: write only the steps that remain.
Answer with JSON only: {"steps": [{"n": 1, "text": "...", "depends_on": null}]}`;

// Returns [{ description, order_index, depends_on_order_index }] or throws. Nothing is repaired silently
// except typographic characters, so a bad answer leads to the fallback instead of a half-right work.
export const validateBreakdownAnswer = (answer) => {
  const steps = answer?.steps;
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > maxAiSteps) throw new AiError(`AI breakdown must have 1 to ${maxAiSteps} steps.`);
  return steps.map((step, index) => {
    const number = index + 1;
    if (!step || typeof step !== 'object' || step.n !== number || typeof step.text !== 'string') throw new AiError(`AI step ${number} is malformed.`);
    const description = toWatchText(step.text);
    if (!description || description.length > maxStepLength || !isWatchText(description)) throw new AiError(`AI step ${number} is empty, too long, or not plain ASCII.`);
    const dependsOn = step.depends_on ?? null;
    if (dependsOn !== null && (!Number.isInteger(dependsOn) || dependsOn < 1 || dependsOn >= number)) throw new AiError(`AI step ${number} depends on a step that is not earlier.`);
    return { description, order_index: number, depends_on_order_index: dependsOn };
  });
};

export const breakDownWithAi = async (ai, { title, priority, due, finishedSteps = [] }) => {
  const request = { work: String(title).slice(0, 500), priority, due };
  if (finishedSteps.length) request.finished_steps = finishedSteps;
  return validateBreakdownAnswer(await ai.askJson(breakdownPrompt, JSON.stringify(request)));
};

// ---- 4. Skills a work needs (for the worker recommendation) --------------------------------------------

export const maxRequiredSkills = 5;

const skillsPrompt = `You name the skills a piece of work needs so it can be matched to a worker.
You get the work text and the skill tags this team uses.
- Choose the tags the work really needs, usually one and at most three, copied exactly from the list.
- Only when no tag fits, name the needed skill yourself in one or two words.
- If the text is too vague to tell, return an empty list.
Answer with JSON only: {"skills": ["..."]}`;

export const validateSkillsAnswer = (answer) => {
  const skills = answer?.skills;
  if (!Array.isArray(skills) || skills.length > maxRequiredSkills) throw new AiError(`AI must return a list of at most ${maxRequiredSkills} skills.`);
  const seen = new Set();
  const cleaned = [];
  for (const item of skills) {
    if (typeof item !== 'string') throw new AiError('AI returned a skill that is not text.');
    const tag = item.replace(/\s+/g, ' ').trim();
    if (!tag || tag.length > 30 || /\p{Cc}/u.test(tag)) throw new AiError('AI returned an empty or overlong skill.');
    if (!seen.has(tag.toLowerCase())) cleaned.push(tag);
    seen.add(tag.toLowerCase());
  }
  return cleaned;
};

export const extractSkillsWithAi = async (ai, { text, knownSkills }) =>
  validateSkillsAnswer(await ai.askJson(skillsPrompt, JSON.stringify({ work: String(text).slice(0, 500), team_skill_tags: knownSkills })));
