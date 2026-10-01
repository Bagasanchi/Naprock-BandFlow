// AI task planning with the Gemini API (free tier works): turns a task title into ordered steps
// short enough for the wristband, and picks an Eisenhower Matrix category.
// Set GEMINI_API_KEY in .env to enable it. Without a key the server works as before.
// Docs: https://ai.google.dev/gemini-api/docs/structured-output

const apiKey = process.env.GEMINI_API_KEY ?? '';
// Free models are often busy, so each request falls through this list until one answers.
// GEMINI_MODEL (optional) is tried first.
const models = [...new Set([process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'].filter(Boolean))];
const endpoint = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/interactions';

export const maxStepLength = 60; // the band shows one step on a 320x170 screen
export const aiPlanningEnabled = Boolean(apiKey);

const schema = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      description: 'Ordered steps a worker follows to finish the task.',
      items: { type: 'string' },
    },
    category: {
      type: 'string',
      enum: ['do_first', 'schedule', 'delegate', 'eliminate'],
      description: 'Eisenhower Matrix: do_first = urgent and important, schedule = important not urgent, delegate = urgent not important, eliminate = neither.',
    },
  },
  required: ['steps', 'category'],
};

const buildPrompt = ({ title, priority, due }) => `You plan hands-on work for a worker who reads one step at a time on a small wristband screen.

Task: ${title}
Priority: ${priority}
Due: ${due}

Break the task into 3 to 6 concrete steps in the order they must be done.
Rules for every step:
- A short instruction for one physical action.
- At most ${maxStepLength} characters, no numbering, no trailing period.
- Write in the same language as the task, with that language's natural word order.
Only include steps that clearly belong to this task. If the task is already a single simple action, return it as one step.

Also choose the Eisenhower category from the priority and due date.`;

// The interaction's answer is in steps[]: { type: 'model_output', content: [{ type: 'text', text }] }
// (after a 'thought' step). output_text / outputs[] are accepted too for other API shapes.
const readText = (body) => {
  if (typeof body?.output_text === 'string') return body.output_text;
  const parts = [
    ...(Array.isArray(body?.steps) ? body.steps.filter((step) => step?.type === 'model_output').flatMap((step) => step.content ?? []) : []),
    ...(Array.isArray(body?.outputs) ? body.outputs : []),
  ];
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('');
};

const askModel = async (model, prompt) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ model, input: prompt, response_format: { type: 'text', mime_type: 'application/json', schema } }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message ?? `HTTP ${response.status}`), { status: response.status });
  return JSON.parse(readText(body));
};

// Returns { steps: string[], category } or throws with a short reason.
export async function planTask({ title, priority, due }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
  const prompt = buildPrompt({ title, priority, due });
  let plan = null;
  let lastError = null;
  // Two passes over the model list: demand spikes on the free tier usually clear within seconds.
  attempts: for (let round = 0; round < 2; round++) {
    if (round) await new Promise((resolve) => setTimeout(resolve, 2000));
    for (const model of models) {
      try {
        plan = await askModel(model, prompt);
        break attempts;
      } catch (error) {
        lastError = error;
        // A wrong key fails the same way on every model, so stop early.
        if (error?.status === 400 || error?.status === 401 || error?.status === 403) break attempts;
      }
    }
  }
  if (!plan) {
    if (lastError?.status === 429) throw new Error('The free AI limit was reached. Try again in a minute.');
    if (lastError?.status === 503) throw new Error('The free AI models are busy right now. Try again in a minute.');
    throw new Error(lastError instanceof SyntaxError ? 'Gemini did not return valid JSON.' : `Gemini request failed: ${lastError?.message ?? 'unknown error'}`);
  }
  // AI output is never trusted as-is: keep only clean, short, unique steps.
  const seen = new Set();
  const steps = (Array.isArray(plan?.steps) ? plan.steps : [])
    .filter((step) => typeof step === 'string')
    .map((step) => step.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').replace(/\s+/g, ' ').trim().replace(/\.$/, ''))
    .filter((step) => step && step.length <= 120 && !seen.has(step.toLowerCase()) && seen.add(step.toLowerCase()))
    .slice(0, 8);
  if (!steps.length) throw new Error('Gemini returned no usable steps.');
  return { steps, category: typeof plan?.category === 'string' ? plan.category : null };
}
