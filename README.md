# Customer Support / AI Triage Dashboard

A professional full-stack portfolio project demonstrating a customer support console with AI-assisted ticket triage.

## Overview

This application simulates a real-world customer support system where AI helps agents by:
- Auto-tagging tickets (billing, technical, account, urgent, general)
- Suggesting priority levels (low, medium, high)
- Drafting first-response messages

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite + Prisma ORM |
| AI | Deterministic rules (easily swappable for OpenAI/Kimi) |

## Project Structure

```
AI-Application-Portfolio/
├── backend/           # Express API + Prisma
│   ├── prisma/        # Schema + seed script
│   └── src/
│       ├── ai/        # AI triage wrapper
│       └── routes/    # API endpoints
└── frontend/          # React + Vite app
    └── src/
        ├── components/
        ├── pages/
        └── api/
```

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install

# Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# Seed with fake tickets (~40 tickets)
npm run db:seed

# Start dev server
npm run dev
```

The backend will run on http://localhost:3001

### 2. Frontend Setup

```bash
cd frontend
npm install

# Start dev server
npm run dev
```

The frontend will run on http://localhost:5173

## Features

### Dashboard
- Overview stats (total tickets, open/closed, AI analyzed)
- Distribution by tag and priority
- AI suggestion acceptance rate

### Ticket List
- Paginated table view
- Filters: tag, priority, status, search
- Quick view of AI analysis status

### Ticket Detail
- Full ticket view with customer info
- AI analysis panel with suggested tags/priority
- AI-generated reply suggestion
- Edit and submit final reply
- Track AI suggestion acceptance

### AI Triage
The AI module (`backend/src/ai/triage.ts`) uses keyword-based rules for now. To switch to a real AI provider like OpenAI:

1. Install the provider SDK: `npm install openai`
2. Replace the `callAiForTicket` function implementation
3. Keep the same interface: `(ticket) => Promise<{tag, priority, suggestedReply, confidence}>`

See the commented example in `triage.ts` for OpenAI integration.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/tickets` | List tickets (paginated, filtered) |
| GET | `/tickets/:id` | Get single ticket |
| POST | `/tickets/:id/analyze` | Run AI triage |
| POST | `/tickets/:id/reply` | Submit reply |
| GET | `/stats` | Get dashboard stats |

## Environment Variables

### Backend (.env)
```
DATABASE_URL="file:./dev.db"
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Frontend
Uses Vite's built-in proxy (configured in `vite.config.ts`) to forward `/api` to the backend.


## License

MIT - Built for portfolio and educational purposes.
