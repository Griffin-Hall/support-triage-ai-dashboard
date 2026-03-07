import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ticketsRouter from './routes/tickets';
import statsRouter from './routes/stats';
import aiSettingsRouter from './routes/aiSettings';
import { backfillMissingTicketAnalyses, ensureDemoTickets } from './seedDemoTickets';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/tickets', ticketsRouter);
app.use('/stats', statsRouter);
app.use('/ai', aiSettingsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    await ensureDemoTickets();
  } catch (error) {
    console.error('Failed to seed demo tickets:', error);
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);

    void backfillMissingTicketAnalyses()
      .then((count) => {
        if (count > 0) {
          console.log(`Auto-classified ${count} tickets without AI analysis.`);
        }
      })
      .catch((error) => {
        console.error('Failed to auto-classify tickets:', error);
      });
  });
}

void startServer();
