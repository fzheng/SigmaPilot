import * as hl from '@nktkas/hyperliquid';
import { clearinghouseState } from '@nktkas/hyperliquid/api/info';
import type { PositionInfo } from './types';

// Reuse a single HTTP transport for SDK calls
const transport = new hl.HttpTransport();

export async function fetchBtcPerpExposure(address: string): Promise<number> {
  try {
    const data = await clearinghouseState(
      { transport },
      { user: address as `0x${string}` }
    );
    const positions = data.assetPositions || [];
    let netBtc = 0;
    for (const ap of positions) {
      const coin = ap?.position?.coin ?? '';
      const size = Number(ap?.position?.szi ?? 0);
      if (/^btc$/i.test(coin) && Number.isFinite(size)) {
        netBtc += size;
      }
    }
    return netBtc;
  } catch (e) {
    return 0;
  }
}

export async function fetchPerpPositions(address: string): Promise<PositionInfo[]> {
  try {
    const data = await clearinghouseState(
      { transport },
      { user: address as `0x${string}` }
    );
    const out: PositionInfo[] = [];
    for (const ap of data.assetPositions || []) {
      const coin = ap?.position?.coin ?? '';
      const size = Number(ap?.position?.szi ?? 0);
      if (!Number.isFinite(size) || size === 0) continue;
      const entry = Number(ap?.position?.entryPx ?? NaN);
      const levValue = Number(ap?.position?.leverage?.value ?? NaN);
      const symbol = coin; // e.g., BTC
      out.push({
        symbol,
        size,
        entryPriceUsd: Number.isFinite(entry) ? entry : undefined,
        leverage: Number.isFinite(levValue) ? levValue : undefined,
      });
    }
    return out;
  } catch (e) {
    return [];
  }
}
