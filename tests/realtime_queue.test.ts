import { EventQueue } from '../src/queue';

describe('EventQueue trade extension', () => {
  test('push assigns seq and retains extended fields', () => {
    const q = new EventQueue(10);
    const evt = q.push({
      type: 'trade',
      at: new Date().toISOString(),
      address: '0xabc',
      symbol: 'BTC',
      side: 'buy',
      direction: 'long',
      effect: 'open',
      priceUsd: 50000,
      size: 1,
      realizedPnlUsd: 10,
      startPosition: 0,
      fee: 0.1,
      feeToken: 'USDC',
      hash: '0xhash',
      action: 'Open Long'
    });
    expect((evt as any).seq).toBe(1);
    expect((evt as any).hash).toBe('0xhash');
    expect((evt as any).action).toBe('Open Long');
  });

  test('listSince returns only events after seq', () => {
    const q = new EventQueue(10);
    for (let i=0;i<5;i++) {
      q.push({
        type: 'trade', at: new Date().toISOString(), address: '0x'+i, symbol: 'BTC',
        side: 'buy', direction: 'long', effect: 'open', priceUsd: 1, size: 1
      });
    }
    const after2 = q.listSince(2, 10);
    expect(after2.length).toBe(3);
    expect(after2[0].seq).toBe(3);
    expect(after2[after2.length-1].seq).toBe(5);
  });
});
