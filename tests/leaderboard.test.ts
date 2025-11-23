jest.mock('@hl/ts-lib', () => {
  // Import actual scoring functions (don't mock them)
  const actualScoring = jest.requireActual('@hl/ts-lib/scoring');

  return {
    createLogger: () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    }),
    getPool: jest.fn(async () => ({
      query: jest.fn().mockResolvedValue({ rows: [] }),
    })),
    normalizeAddress: (value: string) => value.toLowerCase(),
    nowIso: () => '2024-01-01T00:00:00.000Z',
    CandidateEventSchema: { parse: (input: any) => input },
    // Include scoring functions from actual module
    computePerformanceScore: actualScoring.computePerformanceScore,
    computeSmoothPnlScore: actualScoring.computeSmoothPnlScore,
    DEFAULT_SCORING_PARAMS: actualScoring.DEFAULT_SCORING_PARAMS,
  };
});

import LeaderboardService from '../services/hl-scout/src/leaderboard';

type RawEntry = {
  address: string;
  winRate: number;
  executedOrders: number;
  realizedPnl: number;
  pnlList: Array<{ timestamp: number; value: string }>;
  remark?: string | null;
  labels?: string[];
  stats?: {
    maxDrawdown?: number;
    totalPnl?: number;
    openPosCount?: number;
    closePosCount?: number;
  };
};

function makeEntry(overrides: Partial<RawEntry> = {}): RawEntry {
  return {
    address: overrides.address ?? `0x${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`,
    winRate: overrides.winRate ?? 0.65,
    executedOrders: overrides.executedOrders ?? 100, // Higher trade count for better freq score
    realizedPnl: overrides.realizedPnl ?? 50_000, // More reasonable PnL
    pnlList:
      overrides.pnlList ??
      [
        { timestamp: 1, value: '0' },
        { timestamp: 2, value: '10000' },
        { timestamp: 3, value: '20000' },
        { timestamp: 4, value: '30000' },
        { timestamp: 5, value: '40000' },
        { timestamp: 6, value: '50000' },
      ],
    remark: overrides.remark ?? null,
    labels: overrides.labels ?? [],
    stats: overrides.stats,
  };
}

function buildService(selectCount = 2) {
  return new LeaderboardService(
    {
      apiUrl: 'https://example.com',
      topN: 100,
      selectCount,
      periods: [30],
      pageSize: 50,
      refreshMs: 24 * 60 * 60 * 1000,
    },
    async () => {}
  );
}

describe('LeaderboardService scoreEntries', () => {
  it('filters out accounts with perfect win rate and many trades', () => {
    const service = buildService(2);
    const entries = [
      makeEntry({ address: '0xperfect', winRate: 1, executedOrders: 50 }), // Perfect win rate with many trades
      makeEntry({ address: '0xnormal', winRate: 0.75, executedOrders: 100 }),
    ];
    const scored = (service as any).scoreEntries(entries);
    // Perfect win rates with > 10 trades are filtered
    expect(scored.some((row: any) => row.address === '0xperfect')).toBe(false);
    expect(scored[0].address).toBe('0xnormal');
  });

  it('allows perfect win rate with few trades', () => {
    const service = buildService(2);
    const entries = [
      makeEntry({ address: '0xperfect', winRate: 1, executedOrders: 5 }), // Few trades is OK
      makeEntry({ address: '0xnormal', winRate: 0.75, executedOrders: 100 }),
    ];
    const scored = (service as any).scoreEntries(entries);
    // Perfect win rate with < 10 trades is allowed
    expect(scored.some((row: any) => row.address === '0xperfect')).toBe(true);
  });

  it('falls back to base list when filter removes everyone', () => {
    const service = buildService(2);
    const entries = [
      makeEntry({ address: '0xalpha', winRate: 1, executedOrders: 50 }),
      makeEntry({ address: '0xbeta', winRate: 1, executedOrders: 50 }),
    ];
    const scored = (service as any).scoreEntries(entries);
    expect(scored).toHaveLength(entries.length);
  });

  it('normalizes weights across selectCount addresses', () => {
    const service = buildService(2);
    const entries = [
      makeEntry({
        address: '0x1',
        realizedPnl: 100_000,
        pnlList: [
          { timestamp: 1, value: '0' },
          { timestamp: 2, value: '25000' },
          { timestamp: 3, value: '50000' },
          { timestamp: 4, value: '75000' },
          { timestamp: 5, value: '100000' },
        ],
      }),
      makeEntry({
        address: '0x2',
        realizedPnl: 50_000,
        pnlList: [
          { timestamp: 1, value: '0' },
          { timestamp: 2, value: '12500' },
          { timestamp: 3, value: '25000' },
          { timestamp: 4, value: '37500' },
          { timestamp: 5, value: '50000' },
        ],
      }),
      makeEntry({
        address: '0x3',
        realizedPnl: 25_000,
        pnlList: [
          { timestamp: 1, value: '0' },
          { timestamp: 2, value: '6000' },
          { timestamp: 3, value: '12000' },
          { timestamp: 4, value: '18000' },
          { timestamp: 5, value: '25000' },
        ],
      }),
    ];
    const scored = (service as any).scoreEntries(entries);
    const topWeights = scored.slice(0, 2).map((row: any) => row.weight);
    expect(topWeights[0]).toBeGreaterThan(0);
    expect(topWeights[1]).toBeGreaterThan(0);
    expect(topWeights[0] + topWeights[1]).toBeCloseTo(1, 6);
    expect(scored[2].weight).toBe(0);
  });

  it('includes smoothPnlScore in scoring details', () => {
    const service = buildService(2);
    const entries = [
      makeEntry({
        address: '0xtest',
        pnlList: [
          { timestamp: 1, value: '0' },
          { timestamp: 2, value: '10000' },
          { timestamp: 3, value: '20000' },
          { timestamp: 4, value: '30000' },
        ],
      }),
    ];
    const scored = (service as any).scoreEntries(entries);
    expect(scored[0].meta.scoringDetails).toBeDefined();
    expect(scored[0].meta.scoringDetails.smoothPnlScore).toBeGreaterThan(0);
  });

  it('filters out accounts with max drawdown > 80%', () => {
    const service = buildService(2);
    // Create a PnL series with >80% drawdown: goes up to 100k, then crashes to 10k
    const badDrawdownPnlList = [
      { timestamp: 1, value: '0' },
      { timestamp: 2, value: '50000' },
      { timestamp: 3, value: '100000' },  // Peak
      { timestamp: 4, value: '30000' },   // 70% drawdown
      { timestamp: 5, value: '10000' },   // 90% drawdown - exceeds 80% limit
    ];
    // Normal account with small drawdown
    const goodPnlList = [
      { timestamp: 1, value: '0' },
      { timestamp: 2, value: '25000' },
      { timestamp: 3, value: '50000' },
      { timestamp: 4, value: '45000' },  // Small 10% dip
      { timestamp: 5, value: '60000' },
    ];
    const entries = [
      makeEntry({ address: '0xbad_drawdown', pnlList: badDrawdownPnlList }),
      makeEntry({ address: '0xgood', pnlList: goodPnlList }),
    ];
    const scored = (service as any).scoreEntries(entries);
    // Bad drawdown account should be filtered out
    expect(scored.some((row: any) => row.address === '0xbad_drawdown')).toBe(false);
    expect(scored[0].address).toBe('0xgood');
  });

  it('includes maxDrawdown in scoring details', () => {
    const service = buildService(2);
    const entries = [
      makeEntry({
        address: '0xtest',
        pnlList: [
          { timestamp: 1, value: '0' },
          { timestamp: 2, value: '100000' },
          { timestamp: 3, value: '70000' },  // 30% drawdown
          { timestamp: 4, value: '90000' },
        ],
      }),
    ];
    const scored = (service as any).scoreEntries(entries);
    expect(scored[0].meta.scoringDetails.maxDrawdown).toBeDefined();
    expect(scored[0].meta.scoringDetails.maxDrawdown).toBeCloseTo(0.3, 1);
    expect(scored[0].statMaxDrawdown).toBeCloseTo(0.3, 1);
  });

  it('applies scalping penalty for high trade counts (>100)', () => {
    const service = buildService(2);
    const entries = [
      // Moderate trader - should score better
      makeEntry({
        address: '0xmoderate',
        executedOrders: 80,
        winRate: 0.65,
        realizedPnl: 50000,
      }),
      // Heavy trader (scalper) - should be penalized
      makeEntry({
        address: '0xscalper',
        executedOrders: 200,  // 200 trades should get 0.4x penalty
        winRate: 0.65,
        realizedPnl: 50000,
      }),
    ];
    const scored = (service as any).scoreEntries(entries);
    // Moderate trader should rank higher due to scalping penalty on heavy trader
    expect(scored[0].address).toBe('0xmoderate');
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });

  it('severely penalizes extreme scalpers (>300 trades)', () => {
    const service = buildService(2);
    const entries = [
      makeEntry({
        address: '0xnormal',
        executedOrders: 100,
        winRate: 0.6,
        realizedPnl: 30000,
      }),
      makeEntry({
        address: '0xextreme_scalper',
        executedOrders: 400,  // 400 trades should get 0.05x penalty (extreme)
        winRate: 0.7,         // Even with better win rate
        realizedPnl: 100000,  // And better PnL
      }),
    ];
    const scored = (service as any).scoreEntries(entries);
    // Normal trader should rank higher despite scalper having better raw stats
    expect(scored[0].address).toBe('0xnormal');
  });

  it('filters out accounts with API stats.maxDrawdown > 80%', () => {
    const service = buildService(2);
    const entries = [
      // Account with 100% maxDrawdown from API stats (should be filtered)
      makeEntry({
        address: '0xhigh_mdd',
        winRate: 0.82,
        executedOrders: 28,
        realizedPnl: 100000,
        stats: { maxDrawdown: 1 },  // 100% MDD from API
      }),
      // Normal account
      makeEntry({
        address: '0xnormal',
        winRate: 0.65,
        executedOrders: 50,
        realizedPnl: 50000,
        stats: { maxDrawdown: 0.2 },  // 20% MDD - acceptable
      }),
    ];
    const scored = (service as any).scoreEntries(entries);
    // High MDD account should be filtered out
    expect(scored.some((row: any) => row.address === '0xhigh_mdd')).toBe(false);
    expect(scored[0].address).toBe('0xnormal');
  });

  it('hard filters scalpers with > 200 trades', () => {
    const service = buildService(2);
    const entries = [
      // Heavy scalper (>200 trades should be hard filtered)
      makeEntry({
        address: '0xheavy_scalper',
        executedOrders: 250,
        winRate: 0.7,
        realizedPnl: 150000,
      }),
      // Normal trader
      makeEntry({
        address: '0xnormal',
        executedOrders: 80,
        winRate: 0.6,
        realizedPnl: 40000,
      }),
    ];
    const scored = (service as any).scoreEntries(entries);
    // Heavy scalper should be hard filtered
    expect(scored.some((row: any) => row.address === '0xheavy_scalper')).toBe(false);
    expect(scored[0].address).toBe('0xnormal');
  });
});
