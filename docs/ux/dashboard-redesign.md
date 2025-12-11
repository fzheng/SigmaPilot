# SigmaPilot Dashboard Redesign

*Phase 3e UX Specification - December 2025*

---

## 1. Executive Summary

This document specifies a comprehensive dashboard redesign for SigmaPilot, transforming it from a signal-monitoring tool into a complete trading intelligence platform with:

- **Unified P&L tracking** across exchanges
- **Live position management** with real-time unrealized P&L
- **AI decision logs** with human-readable reasoning
- **Multi-exchange support** (Hyperliquid + Binance initially)
- **Auto-trade controls** with per-exchange toggles

---

## 2. User Stories

### Primary Persona: Power Trader

> "As a crypto trader, I want to see all my positions and P&L in one place, understand why SigmaPilot generates each signal, and optionally auto-execute with configurable limits."

### User Stories

| ID | Story | Priority |
|----|-------|----------|
| US-1 | As a user, I want to see my total portfolio value and P&L at a glance | P0 |
| US-2 | As a user, I want to view all open positions with entry, mark, P&L, and liquidation | P0 |
| US-3 | As a user, I want to understand why each signal was generated (reasoning) | P0 |
| US-4 | As a user, I want to toggle auto-trade on/off per exchange | P1 |
| US-5 | As a user, I want to set max position size and leverage per exchange | P1 |
| US-6 | As a user, I want to filter decision logs by symbol, result, and time | P1 |
| US-7 | As a user, I want to see which traders contributed to each signal | P1 |
| US-8 | As a user, I want real-time price updates without page refresh | P0 |
| US-9 | As a user, I want the dashboard to work on mobile | P1 |
| US-10 | As a user, I want to see historical performance (win rate, total P&L) | P2 |

---

## 3. Navigation Structure

### Top-Level Navigation

```
┌─────────────────────────────────────────────────────────────────┐
│  SigmaPilot    [Overview] [Positions] [Signals] [Decisions] [Traders] [Settings]  │
└─────────────────────────────────────────────────────────────────┘
```

### Page Hierarchy

```
/dashboard
├── /overview          # Portfolio summary, P&L, risk exposure
├── /positions         # Live positions table, all exchanges
├── /signals           # Active signals, auto-trade status
├── /decisions         # AI decision log with reasoning
├── /traders           # Alpha Pool, trader performance
└── /settings          # Exchange config, risk limits
```

---

## 4. Page Specifications

### 4.1 Overview Page (`/dashboard/overview`)

**Purpose**: At-a-glance portfolio health and key metrics

#### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│                         HEADER (shared)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Total Equity│  │ Unrealized  │  │  Realized   │  │  Risk   │ │
│  │   $45,230   │  │   +$1,234   │  │   +$5,678   │  │  12.5%  │ │
│  │  +2.3% 24h  │  │   +2.7%     │  │   Today     │  │ Exposure│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  EQUITY BY EXCHANGE              │  ACTIVE POSITIONS            │
│  ┌────────────────────────────┐  │  ┌─────────────────────────┐ │
│  │ Hyperliquid    $32,450     │  │  │ BTC Long  +$890  +2.1% │ │
│  │ ████████████████░░░░  72%  │  │  │ ETH Short +$344  +1.8% │ │
│  │ Binance        $12,780     │  │  │                         │ │
│  │ ██████░░░░░░░░░░░░░░  28%  │  │  │ [View All Positions →]  │ │
│  └────────────────────────────┘  │  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  RECENT SIGNALS                  │  AUTO-TRADE STATUS           │
│  ┌────────────────────────────┐  │  ┌─────────────────────────┐ │
│  │ 🟢 BTC Long 68% conf 2m ago│  │  │ Hyperliquid  [ON]       │ │
│  │ ⚪ ETH Skip (low effK) 15m │  │  │ Binance      [OFF]      │ │
│  │ 🟢 ETH Short 72% conf 1h   │  │  │                         │ │
│  │ [View All Decisions →]     │  │  │ [Configure →]           │ │
│  └────────────────────────────┘  │  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### Data Requirements

| Field | Source | Update Frequency |
|-------|--------|------------------|
| Total Equity | Sum of exchange balances | 5s polling |
| Unrealized P&L | Sum of position unrealized | 5s polling |
| Realized P&L | Database (closed positions today) | 30s polling |
| Risk Exposure | Sum of position notional / equity | 5s polling |
| Per-Exchange Equity | Exchange adapter `getBalance()` | 5s polling |
| Active Positions | Exchange adapter `getPositions()` | 5s polling |
| Recent Signals | `/api/decisions?limit=5` | WebSocket |
| Auto-Trade Status | `/api/settings/autotrade` | On change |

---

### 4.2 Positions Page (`/dashboard/positions`)

**Purpose**: Unified view of all open positions across exchanges

#### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│  LIVE POSITIONS                              [Refresh] [Export] │
├─────────────────────────────────────────────────────────────────┤
│  Exchange │ Symbol │ Side  │ Size    │ Entry   │ Mark    │ Unr P&L │ Margin │ Liq    │
│  ─────────┼────────┼───────┼─────────┼─────────┼─────────┼─────────┼────────┼────────│
│  HL       │ BTC    │ LONG  │ 0.5     │ 42,500  │ 43,200  │ +$350   │ 5.2%   │ 38,100 │
│  HL       │ ETH    │ SHORT │ 5.0     │ 2,650   │ 2,620   │ +$150   │ 3.1%   │ 2,890  │
│  Binance  │ BTC    │ LONG  │ 0.25    │ 42,480  │ 43,200  │ +$180   │ 2.8%   │ 37,800 │
├─────────────────────────────────────────────────────────────────┤
│  Total Unrealized: +$680 (+1.5%)        Total Margin: 11.1%     │
└─────────────────────────────────────────────────────────────────┘
```

#### Mobile Layout (Card-Based)

```
┌─────────────────────────────────┐
│  BTC LONG                   HL  │
│  ─────────────────────────────  │
│  Size: 0.5  Leverage: 5x        │
│  Entry: $42,500  Mark: $43,200  │
│  ───────────────────────────────│
│  Unrealized: +$350 (+1.6%)      │
│  Liq Price: $38,100             │
│  [Close] [Set SL/TP]            │
└─────────────────────────────────┘
```

#### Data Requirements

| Field | Source | Update |
|-------|--------|--------|
| Exchange | Position metadata | Static |
| Symbol | Position data | Static |
| Side | Position data | Static |
| Size | Position data | 5s |
| Entry Price | Position data | Static |
| Mark Price | `getMarkPrice()` | 1s WebSocket |
| Unrealized P&L | Calculated | 1s |
| Margin % | Position notional / equity | 5s |
| Liquidation | Position data | Static |

#### Interactions

- **Click row**: Expand to show linked decision log entry
- **Close button**: Opens confirmation modal with P&L preview
- **Set SL/TP**: Opens order entry modal

---

### 4.3 Signals Page (`/dashboard/signals`)

**Purpose**: Real-time signal feed with auto-trade controls

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ACTIVE SIGNALS                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🟢 BTC LONG                                    2 min ago    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Confidence: 68%  |  EV: +0.38R  |  Traders: 7/10 agree      ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Gates: ✅ Majority ✅ EffK ✅ Fresh ✅ Price ✅ EV            ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Auto-Trade: [HL: Executed @ $43,150] [Binance: Skipped]     ││
│  │                                              [View Details] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚪ ETH SKIP                                    15 min ago   ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ Reason: Effective-K too low (1.8 < 2.0 required)            ││
│  │ Traders: 4/10 agree, but high correlation reduced effK      ││
│  │                                              [View Details] ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  AUTO-TRADE CONFIGURATION                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Exchange     │ Enabled │ Max Leverage │ Max Position │      │ │
│  │ ────────────┼─────────┼──────────────┼──────────────┤      │ │
│  │ Hyperliquid │  [ON]   │     5x       │     2%       │ Edit │ │
│  │ Binance     │  [OFF]  │     3x       │     1%       │ Edit │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Decisions Page (`/dashboard/decisions`)

**Purpose**: Queryable log of all AI decisions with reasoning

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  AI DECISION LOG                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Filters: [Symbol ▼] [Result ▼] [Exchange ▼] [Date Range]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🟢 BTC LONG EXECUTED                      Dec 10, 14:32 UTC ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ REASONING SUMMARY                                           ││
│  │ "7 of 10 Alpha Pool traders increased BTC long exposure     ││
│  │ within the last 15 minutes. Effective-K = 3.2 (low          ││
│  │ correlation). Expected value +0.38R after fees. Price       ││
│  │ within 0.12R of consensus entry. All risk limits passed."   ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ [▼ Expand Details]                                          ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ INPUTS                                                   │ ││
│  │ │ Traders agreeing: 7  |  Agreement: 70%  |  EffK: 3.2    │ ││
│  │ │ Avg confidence: 68%  |  EV estimate: +0.38R             │ ││
│  │ │                                                          │ ││
│  │ │ GATE RESULTS                                             │ ││
│  │ │ ✅ Supermajority: 70% ≥ 70% required                    │ ││
│  │ │ ✅ Effective-K: 3.2 ≥ 2.0 required                      │ ││
│  │ │ ✅ Freshness: 12s old ≤ 300s max                        │ ││
│  │ │ ✅ Price Band: 0.12R drift ≤ 0.25R max                  │ ││
│  │ │ ✅ EV Gate: 0.38R ≥ 0.20R required                      │ ││
│  │ │                                                          │ ││
│  │ │ EXECUTION                                                │ ││
│  │ │ Hyperliquid: Filled 0.5 BTC @ $43,150 (5x leverage)     │ ││
│  │ │ Order ID: 0x7a8b...  |  Fill time: 1.2s                 │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚪ ETH SKIP                                Dec 10, 14:15 UTC ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ REASONING SUMMARY                                           ││
│  │ "4 traders opened ETH short, but correlation analysis       ││
│  │ shows they follow similar patterns (pairwise ρ > 0.6).      ││
│  │ Effective-K = 1.8, below 2.0 threshold. Signal skipped."    ││
│  │ ─────────────────────────────────────────────────────────── ││
│  │ [▼ Expand Details]                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [Load More]                                                     │
└─────────────────────────────────────────────────────────────────┘
```

#### Filters

| Filter | Options | Default |
|--------|---------|---------|
| Symbol | All, BTC, ETH | All |
| Result | All, Executed, Skipped | All |
| Exchange | All, Hyperliquid, Binance | All |
| Date Range | Today, 7d, 30d, Custom | Today |

---

### 4.5 Traders Page (`/dashboard/traders`)

**Purpose**: Alpha Pool overview with performance metrics

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ALPHA POOL (50 Traders)                    [Refresh Pool]      │
├─────────────────────────────────────────────────────────────────┤
│  Sort: [Rank ▼]  Filter: [Active Only ☑]                        │
├─────────────────────────────────────────────────────────────────┤
│  Rank │ Address    │ μ (avg R) │ κ (precision) │ Win Rate │ Activity │
│  ─────┼────────────┼───────────┼───────────────┼──────────┼──────────│
│  1    │ 0x7a8b...  │ +0.85R    │ 12.4          │ 68%      │ 2h ago   │
│  2    │ 0x3c2d...  │ +0.72R    │ 8.7           │ 62%      │ 45m ago  │
│  3    │ 0x9f1e...  │ +0.68R    │ 15.2          │ 71%      │ 1h ago   │
│  ...                                                             │
├─────────────────────────────────────────────────────────────────┤
│  POOL STATISTICS                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Avg μ       │ │ Avg Win Rate│ │ Correlation │ │ Last Refresh││
│  │ +0.45R      │ │ 58%         │ │ 0.28 avg    │ │ 6h ago      ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.6 Settings Page (`/dashboard/settings`)

**Purpose**: Configuration for exchanges, risk limits, and auto-trade

#### Sections

1. **Exchange Connections**
   - Add/remove exchange API keys (encrypted storage)
   - Test connection button
   - Show connected status

2. **Auto-Trade Settings**
   - Global enable/disable
   - Per-exchange toggles
   - Per-exchange limits (leverage, position size)

3. **Risk Limits**
   - Max position size (% of equity)
   - Max total exposure (% of equity)
   - Max daily loss (% of equity)
   - Signal cooldown (seconds)

4. **Consensus Parameters** (Advanced)
   - Min traders required
   - Agreement threshold
   - Effective-K minimum
   - EV threshold

---

## 5. Component Library

### Shared Components

| Component | Description |
|-----------|-------------|
| `<MetricCard>` | Display single metric with label, value, delta |
| `<PositionRow>` | Table row for position with P&L calculation |
| `<DecisionCard>` | Expandable card with reasoning summary |
| `<GateIndicator>` | ✅/❌ indicator with tooltip explanation |
| `<ExchangeBadge>` | Exchange icon + name badge |
| `<AutoTradeToggle>` | Switch with confirmation for enable/disable |
| `<TraderRow>` | Row with address, NIG params, activity |

---

## 6. API Endpoints Required

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/portfolio/summary` | GET | Total equity, P&L, exposure |
| `/api/portfolio/positions` | GET | All positions, all exchanges |
| `/api/decisions` | GET | Paginated decision log with filters |
| `/api/decisions/:id` | GET | Single decision with full details |
| `/api/settings/autotrade` | GET/PUT | Auto-trade configuration |
| `/api/settings/exchanges` | GET/POST/DELETE | Exchange connections |
| `/api/settings/risk` | GET/PUT | Risk limit configuration |

### WebSocket Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `position:update` | Position object | Real-time position changes |
| `price:tick` | { symbol, price } | Mark price updates |
| `signal:new` | Decision summary | New signal notification |
| `execution:complete` | Execution result | Trade filled notification |

---

## 7. Migration Plan

### Phase 1: Foundation (Week 1-2)
- Create new React app in `services/hl-stream/web/`
- Implement component library
- Set up API proxy to existing endpoints
- Basic routing and navigation

### Phase 2: Core Views (Week 3-4)
- Overview page with metrics
- Positions page with live data
- Decision log with basic filters

### Phase 3: Advanced Features (Week 5-6)
- Auto-trade configuration
- Exchange adapter integration
- Settings page

### Phase 4: Polish (Week 7-8)
- Mobile optimization
- Dark/light theme
- Performance optimization
- E2E tests

---

## 8. Technical Requirements

### Frontend Stack
- **Framework**: React 18 + TypeScript
- **State**: Zustand (lightweight)
- **Styling**: Tailwind CSS
- **Charts**: Lightweight Charts (TradingView)
- **Build**: Vite

### Real-Time Updates
- WebSocket for: positions, prices, signals
- Polling fallback: 5s for positions, 30s for decisions

### Responsive Breakpoints
- Mobile: < 768px (card-based layout)
- Tablet: 768px - 1024px (hybrid)
- Desktop: > 1024px (table layout)

---

*This specification guides the Phase 3e dashboard implementation.*
