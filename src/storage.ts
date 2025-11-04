import fs from 'fs';
import path from 'path';
import { TrackedState } from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'tracked.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadState(): TrackedState {
  try {
    ensureDataDir();
    if (!fs.existsSync(STATE_FILE)) {
      const empty: TrackedState = { addresses: [] };
      fs.writeFileSync(STATE_FILE, JSON.stringify(empty, null, 2));
      return empty;
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as TrackedState;
    if (!Array.isArray(parsed.addresses)) return { addresses: [] };
    return parsed;
  } catch (e) {
    console.error('[storage] Failed to load state:', e);
    return { addresses: [] };
  }
}

export function saveState(state: TrackedState) {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[storage] Failed to save state:', e);
  }
}
