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
  - Query params: `page`, `limit`, `tag`, `priority`, `status`, `search`
- `GET /tickets/:id` - Get single ticket with AI analysis
- `POST /tickets/:id/analyze` - Run AI triage on ticket
- `POST /tickets/:id/reply` - Submit final reply
  - Body: `{ finalReply: string, acceptedAiSuggestion: boolean }`

### Stats
- `GET /stats` - Get aggregated statistics

### Health
- `GET /health` - Health check

## Environment Variables

Create a `.env` file with:

```
DATABASE_URL="file:./dev.db"
PORT=3001
FRONTEND_URL=http://localhost:5173
```

## AI Triage Module

The AI triage logic is in `src/ai/triage.ts`. It currently uses deterministic keyword-based rules to simulate AI analysis. The module is designed so you can easily replace it with a real AI provider (OpenAI, etc.) by keeping the same interface.
