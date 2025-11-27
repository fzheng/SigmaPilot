export type TradeRow = {
  id?: number;
  time: string;
  address: string;
  action: string;
  size: number;
  startPosition: number;
  price: number;
  closedPnl: number | null;
  tx?: string | null;
  hash?: string | null;
};

export type RateState = { lastAt: number };

const toTs = (t: TradeRow): number => {
  const ts = Date.parse(t.time);
  return Number.isFinite(ts) ? ts : 0;
};

function tradeKey(t: TradeRow): string {
  if (t.tx) return `tx:${t.tx}`;
  if (t.hash) return `hash:${t.hash}`;
  if (t.id != null && t.time) return `idtime:${t.id}:${t.time}`;
  if (t.time && t.address) return `addrtime:${t.address}:${t.time}`;
  if (t.id != null) return `id:${t.id}`;
  return `fallback:${t.address ?? ''}:${t.time ?? ''}`;
}

const tradeSort = (a: TradeRow, b: TradeRow): number => {
  const ta = toTs(a);
  const tb = toTs(b);
  if (ta !== tb) return tb - ta; // newest first
  const ida = a.id ?? 0;
  const idb = b.id ?? 0;
  return idb - ida;
};

/**
 * Merge two trade arrays, prefer existing entries when keys collide, and sort newest-first.
 */
export function mergeTrades(base: TradeRow[], incoming: TradeRow[]): TradeRow[] {
  const result = [...base];
  const seen = new Set(result.map((t) => tradeKey(t)));
  for (const t of incoming) {
    const key = tradeKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(t);
  }
  return result.sort(tradeSort);
}

/**
 * Simple rate limiter: returns true if enough time has passed since the last call.
 */
export function canLoadMore(state: RateState, minIntervalMs: number): boolean {
  const now = Date.now();
  if (!state.lastAt || now - state.lastAt >= minIntervalMs) {
    state.lastAt = now;
    return true;
  }
  return false;
}
