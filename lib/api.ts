import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkItem } from './work';

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const tokenKey = 'bandflow_api_token';

export type ApiUser = { id: string; email: string; fullName: string; role: 'worker' | 'boss' };
export type WorkerStatus = 'active' | 'away' | 'offline';
export type ApiWorker = { id: string; name: string; email?: string; role?: 'worker' | 'boss'; status?: WorkerStatus; created_at?: string };

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
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
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

export async function logout() {
  await AsyncStorage.removeItem(tokenKey);
}

export async function getWorkers() {
  return request<ApiWorker[]>('/workers');
}

export async function updateWorkerStatus(workerId: string, status: WorkerStatus) {
  return request<{ id: string; status: WorkerStatus }>(`/workers/${workerId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function getWork() {
  const rows = await request<Array<{ id: string; title: string; priority: WorkItem['priority']; status: WorkItem['status']; progress: number; due: string; subtasks?: string; assigned_to: string }>>('/work');
  return rows.map((row) => ({ ...row, assignedTo: row.assigned_to, subtasks: parseSubtasks(row.subtasks) }));
}

function parseSubtasks(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function updateWorkStatus(workId: string, status: WorkItem['status']) {
  return request<{ id: string; status: WorkItem['status'] }>(`/work/${workId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function deleteWork(workId: string) {
  return request<{ id: string }>(`/work/${workId}`, { method: 'DELETE' });
}

export async function createWork(work: { title: string; priority: WorkItem['priority']; due?: string; assignedTo: string }) {
  return request('/work', { method: 'POST', body: JSON.stringify(work) });
}
