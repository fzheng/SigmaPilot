// Helper module extracted from inline script
export function mergeTrades(existing, incoming) {
  const seen = new Set(existing.map(t => `${t.id}|${t.time}`));
  const additions = [];
  for (const t of incoming) {
    const key = `${t.id}|${t.time}`;
    if (!seen.has(key)) { seen.add(key); additions.push(t); }
  }
  if (!additions.length) return existing.slice();
  const merged = existing.concat(additions);
  merged.sort((a,b)=>{
    const ta = new Date(a.time).getTime();
    const tb = new Date(b.time).getTime();
    if (ta !== tb) return tb - ta;
    return b.id - a.id;
  });
  return merged;
}

export function canLoadMore(state, minIntervalMs) {
  const now = Date.now();
  if (now - state.lastAt < minIntervalMs) return false;
  state.lastAt = now;
  return true;
}
