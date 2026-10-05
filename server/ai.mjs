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

// Fallback without AI: urgent = due within two days (or overdue); important = anything above Low priority.
export const classifyByRules = ({ priority, due }, now = new Date()) => {
  const important = priority !== 'Low';
  if (important) return isUrgent(due, now) ? 'do_first' : 'schedule';
  return isUrgent(due, now) ? 'delegate' : 'eliminate';
};

// The AI judged the work once, when it was created. A deadline that has since come close makes the work
// urgent whatever the AI said then; importance stays the AI's call.
export const raiseUrgency = (category, due, now = new Date()) => {
  if (!isUrgent(due, now)) return category;
  return category === 'schedule' ? 'do_first' : category === 'eliminate' ? 'delegate' : category;
};

const classificationPrompt = `You sort work items for a small team into the Eisenhower matrix.
Urgent means the deadline is about ${urgentWithinDays} days away or less, or has already passed. Work with no due date is not urgent.
Important means the work matters to the team's goals; the boss's priority (Low, Medium, High) is a strong hint.
Categories: do_first = urgent and important, schedule = important but not urgent, delegate = urgent but not important, eliminate = neither.
Answer with JSON only: {"category": "do_first" | "schedule" | "delegate" | "eliminate"}`;

export const validateClassification = (answer) => {
  if (!eisenhowerCategories.includes(answer?.category)) throw new AiError('AI returned an unknown matrix category.');
  return answer.category;
};

export const classifyWithAi = async (ai, { title, priority, due }, now = new Date()) => {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return validateClassification(await ai.askJson(classificationPrompt, JSON.stringify({ title: String(title).slice(0, 300), priority, due, today, days_until_due: daysUntilDue(due, now) })));
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
