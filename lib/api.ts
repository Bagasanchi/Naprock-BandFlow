import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { BandDelivery, SubtaskDetail, WorkItem } from './work';

// In development, hostUri is the address of the computer running Expo (e.g. "192.168.1.5:8081"),
// so the API on the same computer is reachable on port 8787 without editing .env after changing networks.
const devServerHost = Constants.expoConfig?.hostUri?.split(':')[0];
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || (devServerHost ? `http://${devServerHost}:8787` : 'http://127.0.0.1:8787')).replace(/\/$/, '');
const tokenKey = 'bandflow_api_token';

export type ApiUser = { id: string; email: string; fullName: string; role: 'worker' | 'boss' };
export type WorkerStatus = 'active' | 'away' | 'offline';
export type WorkloadLevel = 'light' | 'busy' | 'overloaded';
// open = works assigned to the worker that are not Done; the thresholds are set on the server.
export type Workload = { open: number; level: WorkloadLevel; busy_at: number; overloaded_at: number };
export type ApiWorker = { id: string; name: string; email?: string; role?: 'worker' | 'boss'; status?: WorkerStatus; created_at?: string; password_reset_requested_at?: string | null; skills?: string[]; open_works?: number; workload?: Workload };

export type RecommendationBadge = 'recommended' | 'skill_mismatch' | 'high_workload' | 'away' | 'offline';
export type WorkerRecommendation = {
  worker_id: string;
  name: string;
  score: number;
  skill_match: number;
  open_works: number;
  status: WorkerStatus;
  reason: string;
  skills: string[];
  matched_skills: string[];
  workload: Workload;
  badges: RecommendationBadge[];
};
// source says where required_skills came from: the AI, the keyword fallback, or 'none' when no text was sent.
export type RecommendationResult = { required_skills: string[]; source: 'ai' | 'keywords' | 'none'; recommendations: WorkerRecommendation[] };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem(tokenKey);
  const requestOptions = {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  };
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, requestOptions);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      response = await fetch(`${apiUrl}${path}`, requestOptions);
    } catch {
      throw new Error(`BandFlow server is unavailable at ${apiUrl}. Check that the Pi is running and this device is on the same Wi-Fi.`);
    }
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error ?? `Request failed (${response.status})`), { status: response.status });
  return body as T;
}

export async function login(email: string, password: string) {
  const result = await request<{ token: string; user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  await AsyncStorage.setItem(tokenKey, result.token);
  return result.user;
}

export async function signup(fullName: string, email: string, password: string) {
  await request('/auth/signup', { method: 'POST', body: JSON.stringify({ fullName, email, password }) });
}

export async function requestPasswordReset(email: string) {
  return request<{ ok: true }>('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetWorkerPassword(workerId: string, password: string) {
  return request<{ ok: true }>(`/workers/${workerId}/password`, { method: 'POST', body: JSON.stringify({ password }) });
}

export async function logout() {
  await AsyncStorage.removeItem(tokenKey);
}

export type ApiProfile = ApiUser & { phone: string; jobTitle: string; avatar: string | null; skills: string[]; createdAt: string };
export type ProfileUpdate = Partial<Pick<ApiProfile, 'fullName' | 'email' | 'phone' | 'jobTitle' | 'avatar' | 'skills'>>;

export function getApiUrl() {
  return apiUrl;
}

export async function checkServer() {
  return request<{ ok: boolean }>('/health');
}

export async function getProfile() {
  return request<ApiProfile>('/me');
}

export async function updateProfile(update: ProfileUpdate) {
  return request<ApiProfile>('/me', { method: 'PATCH', body: JSON.stringify(update) });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ ok: true }>('/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
}

export async function getWorkers() {
  return request<ApiWorker[]>('/workers');
}

export async function updateWorkerStatus(workerId: string, status: WorkerStatus) {
  return request<{ id: string; status: WorkerStatus }>(`/workers/${workerId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

// Boss only: replaces a worker's skill tags (workers edit their own in Profile).
export async function updateWorkerSkills(workerId: string, skills: string[]) {
  return request<{ id: string; skills: string[] }>(`/workers/${workerId}`, { method: 'PATCH', body: JSON.stringify({ skills }) });
}

// Boss only: every worker ranked for the described work, best first. Empty text ranks by workload alone.
export async function recommendWorkers(text: string) {
  return request<RecommendationResult>('/work/recommend', { method: 'POST', body: JSON.stringify({ text }) });
}

export async function getWork() {
  const rows = await request<Array<{ id: string; title: string; priority: WorkItem['priority']; status: WorkItem['status']; progress: number; due: string; subtasks?: string[] | string; subtask_details?: SubtaskDetail[]; assigned_to: string; eisenhower_category?: string | null; eisenhower_source?: string | null; eisenhower_reason?: string | null; eisenhower_reason_by?: string | null }>>('/work');
  return rows.map((row): WorkItem => ({
    id: row.id,
    title: row.title,
    priority: row.priority,
    status: row.status,
    progress: row.progress,
    due: row.due,
    assignedTo: row.assigned_to,
    subtasks: parseSubtasks(row.subtasks),
    subtaskDetails: row.subtask_details ?? [],
    eisenhowerCategory: row.eisenhower_category ?? null,
    eisenhowerSource: row.eisenhower_source ?? null,
    eisenhowerReason: row.eisenhower_reason ?? null,
    eisenhowerReasonBy: row.eisenhower_reason_by ?? null,
  }));
}

function parseSubtasks(value?: string[] | string) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

// Ticks or unticks one subtask. When the step on the wristband is finished, the server sends the next one.
export async function setSubtaskDone(workId: string, subtaskId: string, done: boolean) {
  return request<{ progress: number; band: BandDelivery | null }>(`/work/${workId}/subtasks/${subtaskId}`, { method: 'PATCH', body: JSON.stringify({ done }) });
}

export async function updateWorkStatus(workId: string, status: WorkItem['status']) {
  return request<{ id: string; status: WorkItem['status'] }>(`/work/${workId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function deleteWork(workId: string) {
  return request<{ id: string }>(`/work/${workId}`, { method: 'DELETE' });
}

// One step of a breakdown. depends_on_order_index is the order_index of the step that must be done first.
export type BreakdownStep = { description: string; order_index: number; depends_on_order_index: number | null };

// Boss only: asks the AI for the steps of a work that is not created yet. Nothing is saved; pass the steps
// (edited or not) to createWork as subtasks. Fails when the AI is off or its answer is unusable.
export async function previewBreakdown(work: { title: string; priority?: WorkItem['priority']; due?: string }) {
  return request<{ title: string; subtasks: BreakdownStep[] }>('/work/breakdown', { method: 'POST', body: JSON.stringify(work) });
}

// assignedTo is the worker's account id, so two workers with the same name never get each other's work.
export async function createWork(work: { title: string; priority: WorkItem['priority']; due?: string; subtasks?: string[] | BreakdownStep[]; assignedTo: string }) {
  return request<CreatedWork>('/work', { method: 'POST', body: JSON.stringify(work) });
}

// ai.breakdown is 'ai' when the AI wrote the steps, 'manual' when the boss typed them, and 'fallback' when
// the AI could not be used and the work got a single step made from its title.
export type CreatedWork = { id: string; band: BandDelivery; subtasks?: string[]; ai?: { breakdown: 'ai' | 'manual' | 'fallback'; category: 'ai' | 'rules' | 'manual' } };

// Asks the AI to rewrite the steps of a work that are not done yet. Fails (and changes nothing) without AI.
export async function breakDownWork(workId: string) {
  return request<{ progress: number; steps: number; band: BandDelivery | null }>(`/work/${workId}/breakdown`, { method: 'POST' });
}

// Restores the previous login when the app starts; null when there is no valid saved session.
export async function restoreSession() {
  if (!(await AsyncStorage.getItem(tokenKey))) return null;
  try {
    return await getProfile();
  } catch (error) {
    if ((error as { status?: number })?.status === 401) await AsyncStorage.removeItem(tokenKey);
    return null;
  }
}

export type BandLinkStatus = { linked: boolean; linkedAt: string | null; lastSeenAt: string | null };

export async function getBandLink() {
  return request<BandLinkStatus>('/band/link');
}

// Links the watch that is showing this 6-digit code to the signed-in worker's account.
export async function linkBand(code: string) {
  return request<{ linked: true; band: BandDelivery | null }>('/band/link', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function unlinkBand() {
  return request<{ linked: false }>('/band/link', { method: 'DELETE' });
}

export async function deleteSubtask(workId: string, subtaskId: string) {
  return request<{ progress: number; band: BandDelivery | null }>(`/work/${workId}/subtasks/${subtaskId}`, { method: 'DELETE' });
}
