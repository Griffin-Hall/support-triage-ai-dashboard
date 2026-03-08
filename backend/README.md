# Support Triage Backend

Customer Support AI Triage Dashboard API built with Node.js, Express, Prisma, and SQLite.

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migration (creates SQLite file)
npm run db:migrate

# Seed database with fake tickets
npm run db:seed

# Start development server
npm run dev
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with fake tickets |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

## API Endpoints

### Tickets
- `GET /tickets` - List tickets (paginated, with filters)
  - Query params: `page`, `limit`, `queue`, `tag`, `priority`, `status`, `search`
  - `queue` values: `URGENT`, `BILLING`, `TECHNICAL`, `SALES`, `MISC`, `CLOSED`
- `GET /tickets/:id` - Get single ticket with AI analysis
- `POST /tickets/:id/analyze` - Run AI triage on ticket
- `POST /tickets/:id/reply` - Submit final reply
  - Body: `{ finalReply: string, acceptedAiSuggestion: boolean }`

### Stats
- `GET /stats` - Get aggregated statistics and KPI/chart data
  - Key fields:
    - `overview`, `tags`, `priorities`, `aiPerformance`
    - `kpis.ticketsClosed.*` and `kpis.aiDraftsCreated.*`
    - `dailyTickets[]` (`date`, `label`, `created`, `closed`, `synthetic`)
    - `dailyTicketsMeta.windowDays` (67-day window)
    - `dailyTicketsMeta.mode` (`simulated` or `actual`)
    - `dailyTicketsMeta.simulatedRange` (`createdAverage`, `closedAverage`)
    - `queues` (counts by `URGENT`, `BILLING`, `TECHNICAL`, `SALES`, `MISC`, `CLOSED`)
    - `closedByTag` (closed-ticket category counts for sidebar filters)

### Health
- `GET /health` - Health check

## Environment Variables

Create a `.env` file with:

```
DATABASE_URL="file:./dev.db"
PORT=3001
FRONTEND_URL=http://localhost:5173
DEMO_MODE=true
AUTO_CLASSIFY_INTERVAL_MS=300000
```

## Demo Daily Ticket Simulation

When demo mode is enabled (`DEMO_MODE=true`; default if unset), `GET /stats` returns a synthetic 67-day `dailyTickets` series.

- Created volume is deterministic and centered around **~20/day**.
- Closed volume is deterministic and centered around **~17/day**.
- This is display-only demo backfill so chart/KPI trends are non-zero and realistic even before agents interact with the app.

## Demo Ticket Seed Data

Demo ticket fixtures live in:

- `backend/src/seedDemoTickets.ts`

Behavior:

- On API startup, demo tickets seed automatically **only if** no tickets exist.
- Seed creates ~50 realistic tickets (currently 52), all `OPEN`, with pre-created AI analysis and timestamps spread across recent days.
- Startup also backfills AI analysis for any later tickets missing `TicketAIAnalysis`.
- A periodic background backfill also runs every `AUTO_CLASSIFY_INTERVAL_MS` (default 5 minutes) so newly ingested tickets are auto-classified without manual Analyze clicks.
- In demo mode, close actions are session-scoped (tracked in-memory per `X-Demo-Session-Id`) and are not persisted to the database.

Re-run options:

1. Keep existing data and skip re-seed (default): just start backend normally.
2. Force re-seed demo data:
   - Set `FORCE_RESEED_DEMO_TICKETS=true`, then start backend (`npm run dev` or `npm start`)
   - Or run `npm run db:seed` (forces reseed automatically)
   - Both options clear existing tickets/analyses and reseed from `seedDemoTickets.ts`

## Queue Routing Rules

Tickets are routed into one primary queue using category + priority:

1. `CLOSED` queue: any ticket with status `CLOSED`
2. `URGENT` queue: status `OPEN` + priority `URGENT` or `HIGH`
3. `BILLING` queue: status `OPEN` + category `BILLING` and not urgent
4. `TECHNICAL` queue: status `OPEN` + category `TECHNICAL` and not urgent
5. `SALES` queue: status `OPEN` + category `SALES` and not urgent
6. `MISC` queue: remaining `OPEN` tickets

If AI is not configured, API key validation fails, or provider classification fails, the backend automatically uses keyword fallback classification. Ambiguous fallback cases route to `MISC` and are marked as `needsReview`.

## AI Triage Module

The AI triage logic is in `src/ai/triage.ts`. It currently uses deterministic keyword-based rules to simulate AI analysis. The module is designed so you can easily replace it with a real AI provider (OpenAI, etc.) by keeping the same interface.
