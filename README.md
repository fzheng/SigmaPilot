# HyperMind

![Coverage](badges/coverage.svg) [![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-brightgreen.svg?style=flat-square)](https://polyformproject.org/licenses/noncommercial/1.0.0/)

**HyperMind** is a collective intelligence trading system that learns from the best traders on Hyperliquid. Instead of relying on traditional technical analysis or blindly copy-trading single wallets, HyperMind aggregates wisdom from top-performing traders and generates consensus-based trading signals.

> "Be as smart as the smartest traders by learning from their collective behavior"

## Key Features

- **Leaderboard Scanning**: Continuously scans top 1000+ traders on Hyperliquid
- **Smart Scoring**: Composite ranking by win rate, PnL efficiency, and consistency
- **Real-time Monitoring**: Live position and fill tracking for top performers
- **Consensus Signals**: AI-generated signals when multiple top traders align (coming soon)
- **Self-Learning**: System improves by analyzing past signal performance (coming soon)

## Architecture

```
services/
  hl-scout   TypeScript  — Leaderboard scanning + trader scoring
  hl-stream  TypeScript  — Real-time feeds + dashboard + WebSocket
  hl-sage    Python      — Score computation + ranking API
  hl-decide  Python      — Signal generation + outcome tracking
contracts/              — JSON Schema + generated Zod & Pydantic bindings
docker/postgres-init    — SQL migrations (auto-run on fresh Postgres)
```

## Quick Start

```bash
npm install
cp .env.example .env          # Configure OWNER_TOKEN etc
docker compose up --build
```

Dashboard: http://localhost:4102/dashboard

## Service Endpoints

| Service   | Port | Role |
|-----------|------|------|
| hl-scout  | 4101 | Leaderboard scanning + trader scoring |
| hl-stream | 4102 | Real-time feeds + dashboard |
| hl-sage   | 4103 | Score computation |
| hl-decide | 4104 | Signal generation |
| Postgres  | 5432 | Data persistence |
| NATS      | 4222 | Message bus |

### API Documentation
- hl-scout: http://localhost:4101/docs
- hl-stream: http://localhost:4102/docs
- hl-sage: http://localhost:4103/docs
- hl-decide: http://localhost:4104/docs

## Dashboard Features

The operator dashboard at http://localhost:4102/dashboard provides:

- **Live Clock**: Real-time clock with BTC/ETH price ticker
- **TradingView Charts**: BTC/ETH charts with toggle
- **AI Trade Signals**: Consensus-based signals (mock data currently)
- **Top Performance**: Ranked traders with win rate, PnL, and 30-day curves
- **Live Fills**: Real-time trade feed with smart aggregation
- **Custom Tracking**: Monitor up to 3 custom addresses

## Development

### Local Development
```bash
npm run dev:scout      # Watch mode for hl-scout
npm run dev:stream     # Watch mode for hl-stream
```

### Docker Commands
```bash
npm run docker:rebuild # Full rebuild with fresh images
npm run docker:up      # Start containers
npm run docker:down    # Stop containers
npm run docker:logs    # Follow container logs
npm run docker:ps      # Check status
```

### Testing
```bash
npm test               # Run all tests
npm run test:coverage  # With coverage report
npm run e2e-smoke      # End-to-end smoke test
```

## Message Flow

| Topic            | Publisher → Consumer |
|------------------|----------------------|
| `a.candidates.v1`| hl-scout → hl-sage   |
| `b.scores.v1`    | hl-sage → hl-decide  |
| `c.fills.v1`     | hl-stream → hl-decide |
| `d.signals.v1`   | hl-decide → persist  |
| `d.outcomes.v1`  | hl-decide → persist  |

## Configuration

Key environment variables (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `OWNER_TOKEN` | HTTP auth token for admin endpoints |
| `NATS_URL` | NATS connection string |
| `DATABASE_URL` | Postgres connection string |
| `LEADERBOARD_TOP_N` | Number of traders to scan (default: 1000) |
| `LEADERBOARD_SELECT_COUNT` | Traders to actively track (default: 12) |
| `LEADERBOARD_REFRESH_MS` | Scan interval in ms (default: 86400000) |

## Database

Postgres schema is auto-initialized from `docker/postgres-init/` on first run. To reset:

```bash
docker compose down -v && docker compose up --build
```

To apply a new migration to existing data:
```bash
docker compose exec postgres psql -U hlbot -d hlbot -f /docker-entrypoint-initdb.d/XXX_migration.sql
```

## Development Roadmap

See [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) for the complete development plan including:

- **Phase 2**: Consensus Signal Engine (MVP)
- **Phase 3**: Performance Feedback Loop
- **Phase 4**: AI Learning Layer
- **Phase 5**: Advanced Intelligence

## Documentation

- [DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) - Product vision, phases, and open questions
- [CLAUDE.md](CLAUDE.md) - Development guidance for AI assistants
- [CODE_REVIEW_FIXES.md](docs/CODE_REVIEW_FIXES.md) - Security and performance improvements

## License

PolyForm Noncommercial 1.0.0 – free for personal/non-commercial use. For commercial licensing, please reach out.
