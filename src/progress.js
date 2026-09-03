// Best score / wave, persisted to localStorage. Wrapped in try/catch because
// storage can be unavailable (private windows, blocked cookies).
const KEY = "zombees.best.v1";

export function loadBest() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return { score: v.score | 0, wave: v.wave | 0 };
    }
  } catch {
    /* ignore */
  }
  return { score: 0, wave: 0 };
}

export function saveBest(score, wave) {
  const cur = loadBest();
  const newScore = score > cur.score;
  const newWave = wave > cur.wave;
  const best = {
    score: Math.max(cur.score, score),
    wave: Math.max(cur.wave, wave),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* ignore */
  }
  return { newScore, newWave, best };
}
