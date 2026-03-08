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
  - Existing fields:
    - `overview`, `tags`, `priorities`, `aiPerformance`
  - New fields:
    - `kpis.ticketsClosed.total`
    - `kpis.ticketsClosed.last7Days`
    - `kpis.ticketsClosed.last30Days`
    - `kpis.aiDraftsCreated.total`
    - `kpis.aiDraftsCreated.last7Days`
    - `kpis.aiDraftsCreated.last30Days`
    - `dailyTickets[]` (`date`, `label`, `created`, `closed`, `synthetic`)
    - `dailyTicketsMeta.windowDays`
    - `dailyTicketsMeta.mode` (`simulated` or `actual`)
    - `dailyTicketsMeta.simulatedRange` (min/max daily volume in demo mode)
    - `queues` (ticket counts by queue: `URGENT`, `BILLING`, `TECHNICAL`, `SALES`, `MISC`, `CLOSED`)

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

When `DEMO_MODE=true` (or when `NODE_ENV` is not `production` and `DEMO_MODE` is unset), `GET /stats` returns a synthetic 30-day `dailyTickets` series.

- Created volume is deterministically simulated between **15 and 35 tickets/day**.
- Closed volume is pulled from real ticket close activity (`Ticket.status = CLOSED` by day).
- This keeps demo mode visually stable for intake while still reflecting real closure behavior.

## Demo Ticket Seed Data

Demo ticket fixtures live in:

- `backend/src/seedDemoTickets.ts`

Behavior:

- On API startup, demo tickets seed automatically **only if** no tickets exist.
- Startup also backfills AI analysis for tickets missing `TicketAIAnalysis`.
- A periodic background backfill also runs every `AUTO_CLASSIFY_INTERVAL_MS` (default 5 minutes) so newly ingested tickets are auto-classified without manual Analyze clicks.

Re-run options:

1. Keep existing data and skip re-seed (default): just start backend normally.
2. Force re-seed demo data:
   - Set `FORCE_RESEED_DEMO_TICKETS=true`
   - Start backend (`npm run dev` or `npm start`)
   - This clears existing tickets/analyses and reseeds from `seedDemoTickets.ts`

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
