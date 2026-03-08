import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { normalizePriority, normalizeTag, routeTicketQueue, TicketQueue } from '../queueRouting';

const prisma = new PrismaClient();
const router = Router();

const DAILY_WINDOW_DAYS = 30;
const DEMO_DAILY_MIN = 15;
const DEMO_DAILY_MAX = 35;

type DailyCountRow = {
  day: string;
  count: number | string | bigint;
};

type GroupByTagRow = {
  aiTag: string;
  _count: {
    aiTag: number;
  };
};

type GroupByPriorityRow = {
  aiPriority: string;
  _count: {
    aiPriority: number;
  };
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDateWindow(days: number): string[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return toDateKey(date);
  });
}

function formatDateLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function parseCount(value: number | string | bigint): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  return Number.parseInt(value, 10);
}

function toCountMap(rows: DailyCountRow[]): Map<string, number> {
  return new Map(
    rows.map((row) => {
      return [row.day, parseCount(row.count)];
    }),
  );
}

function aggregateTagCounts(rows: GroupByTagRow[]): Array<{ tag: string; count: number }> {
  const accumulator = new Map<string, number>();

  for (const row of rows) {
    const normalizedTag = normalizeTag(row.aiTag);
    const next = (accumulator.get(normalizedTag) ?? 0) + row._count.aiTag;
    accumulator.set(normalizedTag, next);
  }

  return Array.from(accumulator.entries()).map(([tag, count]) => ({ tag, count }));
}

function aggregatePriorityCounts(rows: GroupByPriorityRow[]): Array<{ priority: string; count: number }> {
  const accumulator = new Map<string, number>();

  for (const row of rows) {
    const normalizedPriority = normalizePriority(row.aiPriority);
    const next = (accumulator.get(normalizedPriority) ?? 0) + row._count.aiPriority;
    accumulator.set(normalizedPriority, next);
  }

  return Array.from(accumulator.entries()).map(([priority, count]) => ({ priority, count }));
}

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function deterministicRange(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (hashString(seed) % span);
}

function isDemoModeEnabled(): boolean {
  if (process.env.DEMO_MODE) {
    return ['1', 'true', 'yes'].includes(process.env.DEMO_MODE.trim().toLowerCase());
  }

  return process.env.NODE_ENV !== 'production';
}

/**
 * GET /stats
 * Return aggregated statistics about tickets and AI analysis
 */
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    const dateWindow = buildDateWindow(DAILY_WINDOW_DAYS);
    const dailyWindowStart = new Date(`${dateWindow[0]}T00:00:00.000Z`);

    const [
      totalTickets,
      openTickets,
      closedTickets,
      closedLast7Days,
      closedLast30Days,
      aiDraftsCreated,
      aiDraftsCreatedLast7Days,
      aiDraftsCreatedLast30Days,
      tagCounts,
      priorityCounts,
      ticketsWithAnalysis,
      decidedAnalyses,
      acceptedAnalyses,
      createdByDayRows,
      closedByDayRows,
      openTicketsForQueue,
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'OPEN' } }),
      prisma.ticket.count({ where: { status: 'CLOSED' } }),
      prisma.ticket.count({ where: { status: 'CLOSED', updatedAt: { gte: last7Days } } }),
      prisma.ticket.count({ where: { status: 'CLOSED', updatedAt: { gte: last30Days } } }),
      prisma.ticketAIAnalysis.count({ where: { aiSuggestedReply: { not: '' } } }),
      prisma.ticketAIAnalysis.count({
        where: { aiSuggestedReply: { not: '' }, createdAt: { gte: last7Days } },
      }),
      prisma.ticketAIAnalysis.count({
        where: { aiSuggestedReply: { not: '' }, createdAt: { gte: last30Days } },
      }),
      prisma.ticketAIAnalysis.groupBy({
        by: ['aiTag'],
        _count: {
          aiTag: true,
        },
      }),
      prisma.ticketAIAnalysis.groupBy({
        by: ['aiPriority'],
        _count: {
          aiPriority: true,
        },
      }),
      prisma.ticketAIAnalysis.count(),
      prisma.ticketAIAnalysis.count({
        where: {
          acceptedByAgent: { not: null },
        },
      }),
      prisma.ticketAIAnalysis.count({
        where: {
          acceptedByAgent: true,
        },
      }),
      prisma.$queryRaw<DailyCountRow[]>`
        SELECT date("createdAt") AS day, COUNT(*) AS count
        FROM "Ticket"
        WHERE "createdAt" >= ${dailyWindowStart}
        GROUP BY date("createdAt")
        ORDER BY day ASC
      `,
      prisma.$queryRaw<DailyCountRow[]>`
        SELECT date("updatedAt") AS day, COUNT(*) AS count
        FROM "Ticket"
        WHERE "status" = 'CLOSED' AND "updatedAt" >= ${dailyWindowStart}
        GROUP BY date("updatedAt")
        ORDER BY day ASC
      `,
      prisma.ticket.findMany({
        where: { status: 'OPEN' },
        select: {
          aiAnalysis: {
            select: {
              aiTag: true,
              aiPriority: true,
            },
          },
        },
      }),
    ]);

    const acceptanceRate = decidedAnalyses > 0 ? Math.round((acceptedAnalyses / decidedAnalyses) * 100) : 0;
    const pendingAnalysis = totalTickets - ticketsWithAnalysis;

    const tags = aggregateTagCounts(tagCounts as GroupByTagRow[]);
    const priorities = aggregatePriorityCounts(priorityCounts as GroupByPriorityRow[]);

    const queues = {
      [TicketQueue.URGENT]: 0,
      [TicketQueue.BILLING]: 0,
      [TicketQueue.TECHNICAL]: 0,
      [TicketQueue.SALES]: 0,
      [TicketQueue.MISC]: 0,
      [TicketQueue.CLOSED]: closedTickets,
    };

    for (const ticket of openTicketsForQueue) {
      const queue = routeTicketQueue(ticket.aiAnalysis?.aiTag, ticket.aiAnalysis?.aiPriority, 'OPEN');
      queues[queue] += 1;
    }

    const createdByDay = toCountMap(createdByDayRows);
    const closedByDay = toCountMap(closedByDayRows);
    const demoMode = isDemoModeEnabled();

    // In demo mode we synthesize created intake (15-35/day) but keep CLOSED series data-driven.
    const dailyTickets = dateWindow.map((dateKey) => {
      if (demoMode) {
        const created = deterministicRange(`created-${dateKey}`, DEMO_DAILY_MIN, DEMO_DAILY_MAX);
        const closed = closedByDay.get(dateKey) ?? 0;

        return {
          date: dateKey,
          label: formatDateLabel(dateKey),
          created,
          closed,
          synthetic: true,
        };
      }

      return {
        date: dateKey,
        label: formatDateLabel(dateKey),
        created: createdByDay.get(dateKey) ?? 0,
        closed: closedByDay.get(dateKey) ?? 0,
        synthetic: false,
      };
    });

    res.json({
      overview: {
        totalTickets,
        openTickets,
        closedTickets,
        ticketsWithAnalysis,
        pendingAnalysis,
      },
      tags,
      priorities,
      aiPerformance: {
        decidedAnalyses,
        acceptedAnalyses,
        rejectedAnalyses: decidedAnalyses - acceptedAnalyses,
        acceptanceRate,
      },
      kpis: {
        ticketsClosed: {
          total: closedTickets,
          last7Days: closedLast7Days,
          last30Days: closedLast30Days,
        },
        aiDraftsCreated: {
          total: aiDraftsCreated,
          last7Days: aiDraftsCreatedLast7Days,
          last30Days: aiDraftsCreatedLast30Days,
        },
      },
      dailyTickets,
      dailyTicketsMeta: {
        windowDays: DAILY_WINDOW_DAYS,
        mode: demoMode ? 'simulated' : 'actual',
        simulatedRange: demoMode
          ? {
              min: DEMO_DAILY_MIN,
              max: DEMO_DAILY_MAX,
            }
          : null,
      },
      queues,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
