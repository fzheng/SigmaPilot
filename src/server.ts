import express from 'express';
import cors from 'cors';
import path from 'path';
import { loadState, saveState } from './storage';
import type { Address, Recommendation } from './types';
import { Poller } from './poller';
import { fetchPerpPositions } from './hyperliquid';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS ? Number(process.env.POLL_INTERVAL_MS) : 90_000;

app.use(cors());
app.use(express.json());

// In-memory state mirrors persisted addresses and latest recommendations
let state = loadState();
let recommendations: Recommendation[] = [];

function getAddresses(): Address[] {
  return state.addresses;
}
function setRecommendations(recs: Recommendation[]) {
  recommendations = recs;
}
function getRecommendations(): Recommendation[] {
  return recommendations;
}

// API routes
app.get('/api/addresses', (_req, res) => {
  res.json({ addresses: getAddresses() });
});

app.post('/api/addresses', (req, res) => {
  const address: unknown = req.body?.address;
  if (typeof address !== 'string' || address.trim().length === 0) {
    return res.status(400).json({ error: 'Invalid address' });
  }
  const addr = address.trim().toLowerCase();
  if (!state.addresses.map(a => a.toLowerCase()).includes(addr)) {
    state.addresses.push(addr);
    saveState(state);
    console.log(`[api] Added address ${addr}`);
    // Kick the poller to process immediately
    poller.trigger().catch((e) => console.warn('[api] immediate poll failed', e));
  }
  res.json({ addresses: state.addresses });
});

app.get('/api/recommendations', (_req, res) => {
  res.json({ recommendations: getRecommendations() });
});

// Remove address
app.delete('/api/addresses/:address', (req, res) => {
  const addrParam = String(req.params.address || '').trim().toLowerCase();
  if (!addrParam) return res.status(400).json({ error: 'Invalid address' });
  const before = state.addresses.length;
  state.addresses = state.addresses.filter((a) => a.toLowerCase() !== addrParam);
  if (state.addresses.length !== before) {
    saveState(state);
    console.log(`[api] Removed address ${addrParam}`);
    // Remove any existing recommendation for that address
    recommendations = recommendations.filter((r) => r.address.toLowerCase() !== addrParam);
  }
  res.json({ addresses: state.addresses });
});

// Trigger poll now
app.post('/api/poll-now', async (_req, res) => {
  try {
    await poller.trigger();
    res.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// On-demand perp positions for an address
app.get('/api/positions/:address', async (req, res) => {
  const addr = String(req.params.address || '').trim();
  if (!addr) return res.status(400).json({ error: 'Invalid address' });
  try {
    const positions = await fetchPerpPositions(addr);
    res.json({ address: addr, positions });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Static UI
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
app.use(express.static(PUBLIC_DIR));
app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Poller
const poller = new Poller(getAddresses, setRecommendations, getRecommendations, {
  intervalMs: POLL_INTERVAL_MS
});
poller.start();

app.listen(PORT, () => {
  console.log(`hlbot server listening on http://localhost:${PORT}`);
});
