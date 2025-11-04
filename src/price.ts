import { fetchWithRetry } from './utils';
import type { PriceInfo } from './types';

async function binance(): Promise<number> {
  const data = await fetchWithRetry<{ symbol: string; price: string }>(
    'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    { method: 'GET' },
    { retries: 1, baseDelayMs: 500 }
  );
  const price = Number(data.price);
  if (!Number.isFinite(price)) throw new Error('Invalid price from Binance');
  return price;
}

async function coinbase(): Promise<number> {
  const data = await fetchWithRetry<any>(
    'https://api.exchange.coinbase.com/products/BTC-USD/ticker',
    { method: 'GET' },
    { retries: 1, baseDelayMs: 500 }
  );
  const price = Number(data.price ?? data.last);
  if (!Number.isFinite(price)) throw new Error('Invalid price from Coinbase');
  return price;
}

async function coingecko(): Promise<number> {
  const data = await fetchWithRetry<any>(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
    { method: 'GET' },
    { retries: 1, baseDelayMs: 500 }
  );
  const price = Number(data?.bitcoin?.usd);
  if (!Number.isFinite(price)) throw new Error('Invalid price from CoinGecko');
  return price;
}

async function bitstamp(): Promise<number> {
  const data = await fetchWithRetry<any>(
    'https://www.bitstamp.net/api/v2/ticker/btcusd/',
    { method: 'GET' },
    { retries: 1, baseDelayMs: 500 }
  );
  const price = Number(data?.last);
  if (!Number.isFinite(price)) throw new Error('Invalid price from Bitstamp');
  return price;
}

async function kraken(): Promise<number> {
  const data = await fetchWithRetry<any>(
    'https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD',
    { method: 'GET' },
    { retries: 1, baseDelayMs: 500 }
  );
  const result = data?.result ?? {};
  const key = Object.keys(result)[0];
  const priceStr = result?.[key]?.c?.[0];
  const price = Number(priceStr);
  if (!Number.isFinite(price)) throw new Error('Invalid price from Kraken');
  return price;
}

export async function fetchBtcPriceUsd(): Promise<PriceInfo> {
  const sources: Array<() => Promise<number>> = [binance, coinbase, coingecko, bitstamp, kraken];
  const errors: string[] = [];
  for (const s of sources) {
    try {
      const price = await s();
      return { symbol: 'BTCUSD', price };
    } catch (e: any) {
      errors.push(String(e?.message ?? e));
      continue;
    }
  }
  throw new Error('All price sources failed: ' + errors.join(' | '));
}
