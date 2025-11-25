# BTC/ETH Trade Filtering Rule

## Overview

The leaderboard ranking system applies an additional filtering rule to ensure selected accounts have significant exposure to BTC and ETH trading. This filter ensures we track traders who actively trade major cryptocurrencies rather than only altcoins.

## Implementation Location

- **Service**: `hl-scout`
- **File**: `services/hl-scout/src/leaderboard.ts`
- **Functions**:
  - `analyzeBtcEthTrades()` - Fetches and analyzes BTC/ETH trades
  - `filterBtcEthQualified()` - Applies filtering rules to ranked candidates

## API Endpoint

The filter uses the Hyperbot completed trades API:

```
GET https://hyperbot.network/api/leaderboard/smart/completed-trades/{address}?take=2000
```

**Response Structure**:
```json
{
  "data": [
    {
      "address": "0x71cfa5e263e866f7961091e01ebc5a2d11616c20",
      "coin": "BTC",
      "marginMode": "cross",
      "direction": "long",
      "size": 0.30000000,
      "entryPrice": 111521.95000000,
      "startTime": "2025-10-16T04:25:44.639",
      "endTime": "2025-10-16T04:25:46.848",
      "closePrice": 111521.00000000,
      "totalFee": 28.90636300,
      "pnl": -29.17636300
    }
  ]
}
```

## Filtering Rules

### Rule 1: Negative BTC+ETH PnL
**Condition**: `btcPnl + ethPnl < 0`
**Action**: Skip account
**Reason**: Account has losing performance on major cryptocurrencies

### Rule 2: Insufficient BTC+ETH Contribution
**Condition**: `(btcPnl + ethPnl) / totalPnl < 0.10` (less than 10%)
**Action**: Skip account
**Reason**: Account's profits are not significantly derived from BTC/ETH trading

### Rule 3: Qualified Accounts
**Condition**: `(btcPnl + ethPnl) / totalPnl >= 0.10` AND `btcPnl + ethPnl >= 0`
**Action**: Include account
**Result**: Account trades BTC/ETH profitably with significant contribution to total PnL

## Process Flow

1. **Initial Ranking**: Accounts are scored and ranked using the existing composite performance formula:
   - Stability Score (50%)
   - Win Rate (25%)
   - Trade Frequency (15%)
   - Realized PnL (10%)

2. **Enrichment**: Top N accounts (configured via `LEADERBOARD_ENRICH_COUNT`) are enriched with:
   - Detailed stats from Hyperbot API
   - Portfolio series from Hyperliquid
   - **BTC/ETH trade analysis** (NEW)

3. **Filtering**: The system iterates through ranked candidates:
   - Checks each account's BTC/ETH trading performance
   - Continues until `LEADERBOARD_SELECT_COUNT` qualified accounts are found
   - Checks up to 5x the target count to ensure enough qualified candidates

4. **Publishing**: Only qualified accounts are published as `CandidateEvent` to NATS

## Custom Accounts

**Custom accounts bypass this filter**. Accounts added via the custom accounts API:
```bash
POST /custom-accounts
{
  "address": "0x...",
  "nickname": "Optional Name"
}
```

These accounts are automatically included in the qualified list regardless of BTC/ETH trading activity.

## Configuration

Environment variables controlling this feature:

- `LEADERBOARD_SELECT_COUNT`: Target number of qualified accounts (default: 12, but typically want 10)
- `LEADERBOARD_ENRICH_COUNT`: Number of candidates to enrich/analyze (default: same as SELECT_COUNT)

## Data Storage

BTC/ETH analysis results are stored in the `hl_leaderboard_entries.metrics` JSONB column:

```json
{
  "btcEthAnalysis": {
    "btcPnl": 1234.56,
    "ethPnl": 789.12,
    "btcEthPnl": 2023.68,
    "btcEthRatio": 0.67,
    "qualified": true
  }
}
```

## Logging

The system logs filtering decisions:

**Qualified Account**:
```json
{
  "level": "info",
  "event": "btc_eth_qualified",
  "address": "0x...",
  "rank": 5,
  "btcEthRatio": "0.67",
  "btcPnl": "1234.56",
  "ethPnl": "789.12"
}
```

**Filtered Account**:
```json
{
  "level": "info",
  "event": "btc_eth_filtered",
  "address": "0x...",
  "rank": 8,
  "reason": "btc_eth_insufficient_contribution",
  "btcEthRatio": "0.05",
  "btcPnl": "50.00",
  "ethPnl": "30.00"
}
```

**Insufficient Qualified Accounts**:
```json
{
  "level": "warn",
  "event": "btc_eth_insufficient_qualified",
  "qualified": 7,
  "target": 10,
  "checked": 50
}
```

## Error Handling

If the API call to fetch completed trades fails:
- The account is marked as **not qualified** (conservative approach)
- Reason: `"api_fetch_failed"`
- This prevents including accounts with unknown trading patterns

## Performance Considerations

- API calls are made sequentially during filtering (not batched)
- Each API call fetches up to 2000 trades
- Typical latency: 200-500ms per account
- For 10 qualified accounts from 50 candidates: ~10-25 seconds total
- Filtering only runs during leaderboard refresh (controlled by `LEADERBOARD_REFRESH_MS`)

## Example Scenarios

### Scenario 1: Qualified Account
- Total PnL: $10,000
- BTC PnL: $5,000
- ETH PnL: $2,000
- BTC+ETH Ratio: 70%
- **Result**: ✅ Qualified (>10% contribution, positive PnL)

### Scenario 2: Altcoin-Only Trader
- Total PnL: $10,000
- BTC PnL: $200
- ETH PnL: $300
- BTC+ETH Ratio: 5%
- **Result**: ❌ Filtered (insufficient contribution)

### Scenario 3: Losing on Majors
- Total PnL: $10,000
- BTC PnL: -$500
- ETH PnL: -$300
- BTC+ETH Ratio: -8%
- **Result**: ❌ Filtered (negative BTC+ETH PnL)

### Scenario 4: Custom Account
- Total PnL: $1,000
- BTC PnL: $0
- ETH PnL: $0
- BTC+ETH Ratio: 0%
- **Result**: ✅ Qualified (custom accounts bypass filter)

## Testing

To test the filtering manually:

```bash
# Check completed trades for an address
curl "https://hyperbot.network/api/leaderboard/smart/completed-trades/0x71cfa5e263e866f7961091e01ebc5a2d11616c20?take=2000"

# Monitor filtering in logs
docker compose logs -f hl-scout | grep "btc_eth"
```

## Future Enhancements

Potential improvements (not currently implemented):

1. **Bonus Scoring**: Apply 1.2-1.5x multiplier to accounts with >80% BTC+ETH contribution
2. **Configurable Thresholds**: Make 10% threshold configurable via environment variable
3. **Batch API Calls**: Fetch trades for multiple accounts in parallel
4. **Caching**: Cache trade analysis results to reduce API calls
5. **Dashboard Display**: Show BTC/ETH contribution ratio in the dashboard UI
