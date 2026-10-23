type Progress = { pending: number; label: string; mutation: boolean; success: string; revision: number };
const active = new Map<number, { label: string; mutation: boolean }>();
const listeners = new Set<(state: Progress) => void>();
let nextId = 0; let success = ''; let revision = 0;
function state(): Progress { const tasks = [...active.values()]; const task = tasks.find(t => t.mutation) || tasks[0]; return { pending: tasks.length, label: task?.label || '', mutation: tasks.some(t => t.mutation), success, revision }; }
function emit() { const current = state(); listeners.forEach(listener => listener(current)); }
export function subscribeProgress(listener: (state: Progress) => void) { listeners.add(listener); listener(state()); return () => { listeners.delete(listener); }; }
export async function withRequestFeedback<T>(path: string, method: string, request: () => Promise<T>): Promise<T> {
 if (!/^\/(events|qr-codes|roles|users|companies|bookings|public\/events)(\/|$)/.test(path) || path.includes('payment-status')) return request();
 const mutation = method !== 'GET';
 const label = !mutation ? 'Loading data' : method === 'DELETE' ? 'Deleting' : path.endsWith('/duplicate') ? 'Duplicating event' : path.endsWith('/finalize') ? 'Updating event status' : path.includes('/banners') && method === 'POST' ? 'Uploading image' : method === 'PATCH' || method === 'PUT' ? 'Updating changes' : 'Creating record';
 const id = ++nextId; active.set(id, { label, mutation }); emit();
 try {
  const result = await request();
  if (mutation) { success = method === 'DELETE' ? 'Changes done. Record deleted.' : path.endsWith('/duplicate') ? 'Changes done. Event duplicated.' : 'Changes done. Your updates have been saved.'; revision++; }
  return result;
 } catch (error) { if (mutation) { success = ''; revision++; } throw error;
 } finally { active.delete(id); emit(); }
}
