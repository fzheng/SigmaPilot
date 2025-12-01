# HyperMind Development Plan

## Business Goal

> A private, single-tenant platform that continuously tracks Hyperliquid wallets, identifies consistently strong performers, filters out low-value activity (losers, noise traders, HFT churn), and uses an online-learning engine to generate risk-controlled trade recommendations. It can connect to a Hyperliquid account (read-only first, then trading) to execute a rules-based "follow-the-leaders" strategy that self-adapts as leaders change in bull or bear markets.

### Core Principles

1. **Not blind copy-trading** - Intelligently filter who and when to follow
2. **Online learning** - Continuously adapt to changing market conditions and trader performance
3. **Risk-controlled** - Kelly criterion position sizing, drawdown limits, exposure management
4. **Self-adapting** - Automatically adjust to bull/bear markets and leader changes
5. **Private single-tenant** - Your own instance, your own data, your own edge

---

## Current State (Phase 1 Complete)

### What's Built
- [x] **Leaderboard Scanner** (`hl-scout`): Scans top 1000 traders, composite scoring
- [x] **BTC/ETH Filtering**: Only tracks traders profitable on majors (≥10% contribution)
- [x] **Real-time Fill Tracking** (`hl-stream`): WebSocket feeds for top N traders
- [x] **Position Tracking**: Current positions with incremental updates
- [x] **Dashboard**: Live clock, BTC/ETH prices, top performers, live fills
- [x] **Streaming Aggregation**: Smart grouping of fills within time windows
- [x] **Custom Account Tracking**: Add custom addresses to monitor (pinned accounts)
- [x] **Historical Backfill**: Load more fills from Hyperliquid API

### Architecture
```
hl-scout (4101) → Leaderboard scanning, scoring, BTC/ETH filtering, candidate publishing
     ↓ a.candidates.v1
hl-sage (4103)  → Score computation, weight assignment
     ↓ b.scores.v1
hl-stream (4102) → Real-time feeds, dashboard, WebSocket
     ↓ c.fills.v1
hl-decide (4104) → Signal generation, outcome tracking (infrastructure exists)
```

### Partial Infrastructure (from Phase 2 work)
- [x] `hl-sage`: Consumes candidates, computes weights, publishes scores
- [x] `hl-decide`: Basic signal/outcome infrastructure (tickets, ticket_outcomes tables)
- [ ] Consensus detection logic (not implemented)
- [ ] Actual signal generation from multiple traders (not implemented)

---

## Phase 2: Trader Selection Engine (Multi-Armed Bandit)

### Goal
Replace static leaderboard scoring with an adaptive system that learns which traders to follow based on real outcomes. Uses **Thompson Sampling** (Bayesian multi-armed bandit) for exploration/exploitation balance.

### Why Multi-Armed Bandit?
Research shows MAB algorithms outperform static selection for portfolio/trader allocation:
- **Thompson Sampling**: Best for non-stationary environments (crypto markets)
- **UCB1 with CVaR**: Balances return vs risk-adjusted performance
- **Contextual bandits**: Can incorporate market regime as context

### Tasks

#### 2.1 Trader Performance Database
- [ ] Create `trader_performance` table to track per-trader outcomes
```sql
CREATE TABLE trader_performance (
  address VARCHAR(42) PRIMARY KEY,
  total_signals INT DEFAULT 0,
  winning_signals INT DEFAULT 0,
  total_pnl_r NUMERIC DEFAULT 0,      -- Sum of R-multiples
  avg_hold_time_s INT,
  last_signal_at TIMESTAMPTZ,
  -- Bayesian prior parameters (Beta distribution)
  alpha NUMERIC DEFAULT 1,            -- Successes + 1
  beta NUMERIC DEFAULT 1,             -- Failures + 1
  -- Risk metrics
  max_drawdown NUMERIC DEFAULT 0,
  sharpe_ratio NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2.2 Thompson Sampling Implementation
- [ ] Create `services/hl-sage/app/bandit.py` module
- [ ] Implement Beta-Bernoulli Thompson Sampling for trader selection
- [ ] Sample from each trader's Beta(alpha, beta) posterior
- [ ] Select top K traders with highest sampled values
- [ ] Update posteriors after each signal outcome (online learning)

```python
# Pseudocode for trader selection
def select_traders(pool: List[Trader], k: int) -> List[Trader]:
    samples = []
    for trader in pool:
        # Sample from posterior Beta distribution
        sample = np.random.beta(trader.alpha, trader.beta)
        samples.append((trader, sample))
    # Select top k by sampled value
    samples.sort(key=lambda x: x[1], reverse=True)
    return [t for t, _ in samples[:k]]

def update_posterior(trader: Trader, success: bool):
    if success:
        trader.alpha += 1
    else:
        trader.beta += 1
```

#### 2.3 Exploration vs Exploitation Config
- [ ] Add environment variables:
```bash
BANDIT_POOL_SIZE=50              # Candidate pool from leaderboard
BANDIT_SELECT_K=10               # Traders to actively follow
BANDIT_MIN_SAMPLES=5             # Min signals before trusting posterior
BANDIT_DECAY_FACTOR=0.95         # Weight recent performance more
```

#### 2.4 Decay Mechanism for Non-Stationarity
- [ ] Implement sliding window or exponential decay
- [ ] Recent performance weighted higher than old performance
- [ ] Detect and handle trader "regime changes" (sudden style shifts)

### Decisions Made
- **Algorithm**: Thompson Sampling (handles non-stationarity well)
- **Prior**: Beta(1,1) = uniform prior (no initial bias)
- **Update**: Online, after each signal closes
- **Decay**: Exponential decay with configurable factor

---

## Phase 3: Consensus Signal Generation

### Goal
Generate trading signals when multiple selected traders take the same position. Filter noise by requiring consensus.

### Tasks

#### 3.1 Consensus Detection in `hl-decide`
- [ ] Track recent fills per address in sliding window
- [ ] Detect consensus: same symbol + same direction + within time window
- [ ] Configurable thresholds:
```bash
CONSENSUS_MIN_TRADERS=3          # Minimum traders for signal
CONSENSUS_TIME_WINDOW_S=300      # 5 minute window
CONSENSUS_SYMBOLS=BTC,ETH        # Only these symbols
```

#### 3.2 Signal Schema
```sql
CREATE TABLE consensus_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,  -- 'long' or 'short'
  entry_price NUMERIC NOT NULL,
  confidence NUMERIC,              -- From bandit posteriors
  trigger_count INT NOT NULL,
  trigger_addresses TEXT[] NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  close_reason VARCHAR(20),        -- 'tp', 'sl', 'timeout', 'reversal'
  exit_price NUMERIC,
  pnl_r NUMERIC,                   -- R-multiple result
  metadata JSONB
);

CREATE INDEX idx_consensus_signals_active ON consensus_signals(status)
  WHERE status = 'active';
```

#### 3.3 Signal Confidence Scoring
- [ ] Aggregate confidence from triggering traders' posteriors
- [ ] Higher confidence when high-alpha traders agree
- [ ] Lower confidence when consensus is borderline

#### 3.4 NATS Integration
- [ ] Publish `d.consensus.v1` events for new consensus signals
- [ ] Update signal status on close

### Decisions Made
- **Consensus rule**: N traders same direction within time window
- **No conflicting signals**: If split (3 long, 2 short), wait for clarity
- **Single active signal per symbol**: New consensus replaces old

---

## Phase 4: Risk Management & Position Sizing

### Goal
Implement Kelly criterion position sizing with practical guardrails for crypto volatility.

### Why Kelly Criterion?
- Mathematically optimal for long-term growth
- Naturally sizes down during drawdowns
- Research recommends **fractional Kelly (0.25-0.5x)** for real trading

### Tasks

#### 4.1 Kelly Calculator
- [ ] Create `services/hl-decide/app/kelly.py`
- [ ] Implement fractional Kelly formula:
```python
def kelly_fraction(win_rate: float, avg_win_r: float, avg_loss_r: float) -> float:
    """
    Kelly % = W - (1-W)/R
    where W = win rate, R = avg_win / avg_loss
    """
    if avg_loss_r == 0:
        return 0
    R = avg_win_r / avg_loss_r
    kelly = win_rate - (1 - win_rate) / R
    return max(0, min(kelly, 1))  # Clamp to [0, 1]

def position_size(kelly: float, fraction: float, account_value: float) -> float:
    """Apply fractional Kelly (e.g., 0.25x) for safety"""
    return kelly * fraction * account_value
```

#### 4.2 Risk Limits
- [ ] Max position size per signal (e.g., 5% of account)
- [ ] Max total exposure (e.g., 20% of account)
- [ ] Max concurrent signals (e.g., 3)
- [ ] Drawdown circuit breaker (pause at -10% daily)

```bash
KELLY_FRACTION=0.25              # Quarter-Kelly for safety
MAX_POSITION_PCT=0.05            # 5% max per signal
MAX_EXPOSURE_PCT=0.20            # 20% total exposure
MAX_CONCURRENT_SIGNALS=3
DAILY_DRAWDOWN_LIMIT=-0.10       # -10% daily stops trading
```

#### 4.3 Position Size in Signal
- [ ] Add `suggested_size_pct` to SignalEvent
- [ ] Calculate based on signal confidence × Kelly fraction
- [ ] Dashboard shows suggested size

### Decisions Made
- **Fractional Kelly**: 0.25x (quarter Kelly) - conservative for crypto
- **Max limits**: Hard caps override Kelly suggestions
- **Daily reset**: Drawdown limit resets at UTC midnight

---

## Phase 5: Market Regime Detection

### Goal
Detect market regime (trending, ranging, volatile) and adjust strategy parameters accordingly.

### Why Regime Detection?
Research shows different strategies work in different regimes:
- **Trending**: Follow momentum, wider stops
- **Ranging**: Mean reversion, tighter stops
- **High volatility**: Reduce position size, require stronger consensus

### Tasks

#### 5.1 Regime Classifier
- [ ] Create `services/hl-sage/app/regime.py`
- [ ] Implement rule-based regime detection (start simple):
```python
def detect_regime(prices: List[float], atr: float) -> str:
    """
    Simple regime detection based on trend and volatility.
    """
    # Trend: compare 20-period vs 50-period MA
    ma20 = np.mean(prices[-20:])
    ma50 = np.mean(prices[-50:])
    trend_strength = (ma20 - ma50) / ma50

    # Volatility: ATR as % of price
    volatility = atr / prices[-1]

    if abs(trend_strength) > 0.02 and volatility < 0.03:
        return "trending"
    elif abs(trend_strength) < 0.01 and volatility < 0.02:
        return "ranging"
    else:
        return "volatile"
```

#### 5.2 Regime-Specific Parameters
- [ ] Store regime-specific configs:
```python
REGIME_PARAMS = {
    "trending": {
        "consensus_min": 2,      # Lower threshold in trends
        "kelly_fraction": 0.35,  # More aggressive
        "sl_atr_mult": 2.0,      # Wider stops
    },
    "ranging": {
        "consensus_min": 4,      # Higher threshold
        "kelly_fraction": 0.15,  # Conservative
        "sl_atr_mult": 1.0,      # Tight stops
    },
    "volatile": {
        "consensus_min": 5,      # Very high threshold
        "kelly_fraction": 0.10,  # Minimal size
        "sl_atr_mult": 1.5,
    }
}
```

#### 5.3 Regime Broadcast
- [ ] Publish `e.regime.v1` events on regime change
- [ ] Dashboard shows current regime indicator
- [ ] Log regime changes for analysis

### Future Enhancement
- Hidden Markov Models (HMM) for probabilistic regime detection
- Random Forest classifier trained on labeled historical data
- Separate models for BTC and ETH (may have different regimes)

---

## Phase 6: Hyperliquid Integration (Read-Only)

### Goal
Connect to user's Hyperliquid account for read-only access to view balances and positions.

### Tasks

#### 6.1 Wallet Connection
- [ ] Add wallet address configuration
- [ ] Fetch account balances via Hyperliquid API
- [ ] Display account status in dashboard

#### 6.2 Position Monitoring
- [ ] Track user's current positions
- [ ] Compare with signal recommendations
- [ ] Show alignment/divergence indicator

#### 6.3 Paper Trading Mode
- [ ] Simulate trades based on signals
- [ ] Track hypothetical P&L
- [ ] Build confidence before live trading

---

## Phase 7: Automated Execution

### Goal
Execute trades automatically based on consensus signals (requires careful risk management).

### Prerequisites
- [ ] Phase 4 complete (risk management)
- [ ] Phase 5 complete (regime detection)
- [ ] Minimum 100 paper trades with positive expectancy
- [ ] User explicitly enables auto-trading

### Tasks

#### 7.1 Execution Engine
- [ ] Create `services/hl-exec` service
- [ ] Hyperliquid SDK integration for order placement
- [ ] Support limit and market orders
- [ ] Implement order timeout and retry logic

#### 7.2 Safety Controls
- [ ] Master kill switch (disable all trading)
- [ ] Per-symbol enable/disable
- [ ] Size limits enforced at execution layer
- [ ] Anomaly detection (unusual signal patterns)

#### 7.3 Execution Quality
- [ ] Track slippage per trade
- [ ] Measure execution latency
- [ ] Compare fill price vs signal price

---

## Technical Improvements

### Code Quality
- [ ] Unit tests for bandit algorithms
- [ ] Unit tests for Kelly calculator
- [ ] Integration tests for signal flow
- [ ] Circuit breakers for external APIs

### Performance
- [ ] Cache regime calculations
- [ ] Batch database writes
- [ ] Optimize position lookups

### Observability
- [ ] Prometheus metrics for signal quality
- [ ] Grafana dashboards for trader performance
- [ ] Alerting for system anomalies

---

## Configuration Reference

### Current Environment Variables
```bash
# Existing
OWNER_TOKEN=dev-owner
NATS_URL=nats://nats:4222
DATABASE_URL=postgresql://hlbot:hlbotpassword@postgres:5432/hlbot
LEADERBOARD_SELECT_COUNT=12
LEADERBOARD_ENRICH_COUNT=12

# Phase 2: Bandit
BANDIT_POOL_SIZE=50
BANDIT_SELECT_K=10
BANDIT_DECAY_FACTOR=0.95

# Phase 3: Consensus
CONSENSUS_MIN_TRADERS=3
CONSENSUS_TIME_WINDOW_S=300

# Phase 4: Risk
KELLY_FRACTION=0.25
MAX_POSITION_PCT=0.05
MAX_EXPOSURE_PCT=0.20
DAILY_DRAWDOWN_LIMIT=-0.10

# Phase 5: Regime
REGIME_UPDATE_INTERVAL_S=300
REGIME_LOOKBACK_PERIODS=50
```

---

## Milestones

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation (leaderboard, streaming, dashboard) | ✅ Complete |
| 2 | Trader Selection (multi-armed bandit) | 🔲 Not started |
| 3 | Consensus Signals | 🔲 Not started |
| 4 | Risk Management (Kelly criterion) | 🔲 Not started |
| 5 | Market Regime Detection | 🔲 Not started |
| 6 | Hyperliquid Read-Only Integration | 🔲 Not started |
| 7 | Automated Execution | 🔲 Not started |

---

## Research References

Key concepts incorporated from research:

1. **Multi-Armed Bandit for Portfolio Selection**
   - Thompson Sampling outperforms UCB in non-stationary environments
   - CVaR-based risk adjustment for tail risk management
   - Source: Royal Society Open Science, Springer

2. **Kelly Criterion for Position Sizing**
   - Fractional Kelly (0.25-0.5x) recommended for real trading
   - Daily rebalancing optimal for volatile assets
   - Source: QuantStart, academic literature

3. **Market Regime Detection**
   - Rule-based approaches work well as baseline
   - HMM and ML classifiers for advanced detection
   - Regime-specific parameter tuning critical
   - Source: MacroSynergy Research

---

## How to Resume Development

1. **Check this document** for current phase
2. **Review phase tasks** - pick next uncompleted item
3. **Run services**: `docker compose up -d`
4. **Dashboard**: http://localhost:4102/dashboard
5. **Logs**: `docker compose logs -f [service-name]`

### Key Files by Phase

**Phase 2 (Bandit)**:
- `services/hl-sage/app/bandit.py` (new)
- `docker/postgres-init/XXX_trader_performance.sql` (new)

**Phase 3 (Consensus)**:
- `services/hl-decide/app/consensus.py` (new)
- `services/hl-decide/app/main.py` (enhance)

**Phase 4 (Risk)**:
- `services/hl-decide/app/kelly.py` (new)
- `services/hl-decide/app/risk.py` (new)

**Phase 5 (Regime)**:
- `services/hl-sage/app/regime.py` (new)

---

*Last updated: December 2025*
