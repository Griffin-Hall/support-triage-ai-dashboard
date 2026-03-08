# Support Triage Frontend

React + TypeScript + Vite + Tailwind CSS frontend for the Customer Support AI Triage Dashboard.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at http://localhost:5173 and is configured to proxy API requests to the backend at http://localhost:3001.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Project Structure

```
src/
├── api/
│   └── client.ts      # API client functions
├── components/
│   ├── Badge.tsx      # Reusable badge component
│   └── StatsPanel.tsx # Dashboard stats display
├── pages/
│   ├── TicketListPage.tsx    # Ticket list with filters
│   └── TicketDetailPage.tsx  # Ticket detail + AI interaction
├── types.ts           # TypeScript types (shared with backend)
├── App.tsx            # Main app with routing
├── main.tsx           # Entry point
└── index.css          # Tailwind imports + custom styles
```

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing

## Features

- View and filter tickets by tag, priority, status, or search
- Queue-aware filtering and routing (`Urgent`, `Billing`, `Technical`, `Sales`, `Misc`, `Closed Tickets`)
- Live queue counts in left navigation (auto-refresh + ticket update events)
- Run AI triage on tickets to get auto-tags and suggested replies
- Accept or modify AI suggestions when replying
- Dashboard stats showing ticket distribution and AI acceptance rate
- Dedicated `/stats` KPI page with:
  - Tickets Closed (total, last 7 days, last 30 days)
  - AI Drafts Created (total, last 7 days, last 30 days)
  - Daily Tickets chart (created vs closed) powered by `GET /stats`
