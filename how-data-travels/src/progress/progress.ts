export interface MissionResult { score: number; stars: number }
export interface Progress { completed: Record<string, MissionResult> }
const KEY = 'how-data-travels:progress:v1';
const empty = (): Progress => ({ completed: {} });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Progress;
    return p && typeof p.completed === 'object' ? p : empty();
  } catch { return empty(); }
}
export function saveResult(id: string, r: MissionResult): Progress {
  const p = loadProgress();
  const prev = p.completed[id];
  if (!prev || r.score >= prev.score) p.completed[id] = r;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: progress is session-only */ }
  return p;
}
export function resetProgress() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
