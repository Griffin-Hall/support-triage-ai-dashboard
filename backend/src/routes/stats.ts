import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Priority, Tag } from '../ai/triage';
import { isDemoModeEnabled } from '../demoMode';
import { getDemoSessionId, getDemoTicketClosure } from '../demoSessionState';
import { normalizePriority, normalizeTag, routeTicketQueue, TicketQueue, type TicketQueueType } from '../queueRouting';

const prisma = new PrismaClient();
const router = Router();

const DAILY_WINDOW_DAYS = 67;
const DEMO_CREATED_AVERAGE = 20;
const DEMO_CLOSED_AVERAGE = 17;
const DEMO_CREATED_SPREAD = 5;
const DEMO_CLOSED_SPREAD = 4;

type PriorityType = typeof Priority[keyof typeof Priority];
type TagType = typeof Tag[keyof typeof Tag];

type TicketSnapshot = {
  id: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
  hasAnalysis: boolean;
  aiTag: string | null;
  aiPriority: string | null;
  aiSuggestedReply: string;
  aiAnalysisCreatedAt: Date | null;
  acceptedByAgent: boolean | null;
  queue: TicketQueueType;
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

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function deterministicOffset(seed: string, spread: number): number {
  const span = spread * 2 + 1;
  return (hashString(seed) % span) - spread;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function startOfDayDaysAgo(daysAgo: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function buildSyntheticDailySeries(dateWindow: string[]) {
  return dateWindow.map((dateKey) => {
    const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
    const weekdayCreatedDrift = weekday === 1 || weekday === 2 ? 1 : weekday === 0 || weekday === 6 ? -2 : 0;
    const weekdayClosedDrift = weekday === 1 ? 1 : weekday === 0 || weekday === 6 ? -1 : 0;

    const created = clamp(
      DEMO_CREATED_AVERAGE + deterministicOffset(`created-${dateKey}`, DEMO_CREATED_SPREAD) + weekdayCreatedDrift,
      11,
      33,
    );
    const rawClosed =
      DEMO_CLOSED_AVERAGE + deterministicOffset(`closed-${dateKey}`, DEMO_CLOSED_SPREAD) + weekdayClosedDrift;
    const closed = clamp(Math.min(rawClosed, created + 3), 8, 30);

    return {
      date: dateKey,
      label: formatDateLabel(dateKey),
      created,
      closed,
      synthetic: true,
    };
  });
}

function buildActualDailySeries(tickets: TicketSnapshot[], dateWindow: string[]) {
  const createdMap = new Map<string, number>();
  const closedMap = new Map<string, number>();
  const allowedDays = new Set(dateWindow);

  for (const ticket of tickets) {
    const createdDay = toDateKey(ticket.createdAt);
    if (allowedDays.has(createdDay)) {
      createdMap.set(createdDay, (createdMap.get(createdDay) ?? 0) + 1);
    }

    if (ticket.status === 'CLOSED') {
      const closedDay = toDateKey(ticket.updatedAt);
      if (allowedDays.has(closedDay)) {
        closedMap.set(closedDay, (closedMap.get(closedDay) ?? 0) + 1);
      }
    }
  }

  return dateWindow.map((dateKey) => ({
    date: dateKey,
    label: formatDateLabel(dateKey),
    created: createdMap.get(dateKey) ?? 0,
    closed: closedMap.get(dateKey) ?? 0,
    synthetic: false,
  }));
}

function toTicketSnapshot(ticket: any, demoSessionId: string | null): TicketSnapshot {
  const closure = demoSessionId ? getDemoTicketClosure(demoSessionId, ticket.id) : null;
  const effectiveStatus = closure ? 'CLOSED' : ticket.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
  const aiTag = closure?.aiTag ?? ticket.aiAnalysis?.aiTag ?? null;
  const aiPriority = closure?.aiPriority ?? ticket.aiAnalysis?.aiPriority ?? null;
  const acceptedByAgent = closure?.acceptedAiSuggestion ?? ticket.aiAnalysis?.acceptedByAgent ?? null;
  const hasAnalysis = !!ticket.aiAnalysis || !!closure;
  const aiSuggestedReply = ticket.aiAnalysis?.aiSuggestedReply || '';
  const aiAnalysisCreatedAt = ticket.aiAnalysis?.createdAt ?? (closure ? closure.closedAt : null);
  const updatedAt = closure?.closedAt ?? ticket.updatedAt;
  const queue = routeTicketQueue(aiTag, aiPriority, effectiveStatus);

  return {
    id: ticket.id,
    status: effectiveStatus,
    createdAt: ticket.createdAt,
    updatedAt,
    hasAnalysis,
    aiTag,
    aiPriority,
    aiSuggestedReply,
    aiAnalysisCreatedAt,
    acceptedByAgent,
    queue,
  };
}

/**
 * GET /stats
 * Return aggregated statistics about tickets and AI analysis
 */
router.get('/', async (req, res) => {
  try {
    const demoMode = isDemoModeEnabled();
    const demoSessionId = demoMode ? getDemoSessionId(req) : null;
    const dateWindow = buildDateWindow(DAILY_WINDOW_DAYS);
    const last7DaysStart = startOfDayDaysAgo(6);
    const last30DaysStart = startOfDayDaysAgo(29);

    const rawTickets = await prisma.ticket.findMany({
      include: {
        aiAnalysis: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const tickets = rawTickets.map((ticket) => toTicketSnapshot(ticket, demoSessionId));

    const totalTickets = tickets.length;
    const openTickets = tickets.filter((ticket) => ticket.status === 'OPEN').length;
    const closedTickets = totalTickets - openTickets;
    const ticketsWithAnalysis = tickets.filter((ticket) => ticket.hasAnalysis).length;
    const pendingAnalysis = totalTickets - ticketsWithAnalysis;

    const closedLast7Days = tickets.filter(
      (ticket) => ticket.status === 'CLOSED' && ticket.updatedAt >= last7DaysStart,
    ).length;
    const closedLast30Days = tickets.filter(
      (ticket) => ticket.status === 'CLOSED' && ticket.updatedAt >= last30DaysStart,
    ).length;

    const aiDraftsCreated = tickets.filter(
      (ticket) => ticket.hasAnalysis && ticket.aiSuggestedReply.trim().length > 0,
    ).length;
    const aiDraftsCreatedLast7Days = tickets.filter(
      (ticket) =>
        ticket.hasAnalysis &&
        ticket.aiSuggestedReply.trim().length > 0 &&
        !!ticket.aiAnalysisCreatedAt &&
        ticket.aiAnalysisCreatedAt >= last7DaysStart,
    ).length;
    const aiDraftsCreatedLast30Days = tickets.filter(
      (ticket) =>
        ticket.hasAnalysis &&
        ticket.aiSuggestedReply.trim().length > 0 &&
        !!ticket.aiAnalysisCreatedAt &&
        ticket.aiAnalysisCreatedAt >= last30DaysStart,
    ).length;

    const decidedAnalyses = tickets.filter((ticket) => ticket.hasAnalysis && ticket.acceptedByAgent !== null).length;
    const acceptedAnalyses = tickets.filter((ticket) => ticket.hasAnalysis && ticket.acceptedByAgent === true).length;
    const acceptanceRate = decidedAnalyses > 0 ? Math.round((acceptedAnalyses / decidedAnalyses) * 100) : 0;

    const queueCounts: Record<TicketQueueType, number> = {
      [TicketQueue.URGENT]: 0,
      [TicketQueue.BILLING]: 0,
      [TicketQueue.TECHNICAL]: 0,
      [TicketQueue.SALES]: 0,
      [TicketQueue.MISC]: 0,
      [TicketQueue.CLOSED]: 0,
    };

    for (const ticket of tickets) {
      queueCounts[ticket.queue] += 1;
    }

    const categoryMixOrder = [
      TicketQueue.URGENT,
      TicketQueue.BILLING,
      TicketQueue.TECHNICAL,
      TicketQueue.SALES,
      TicketQueue.MISC,
    ] as const;

    const tags = categoryMixOrder.map((queue) => ({
      tag: queue,
      count: queueCounts[queue],
    }));

    const closedByTag: Record<TagType, number> = {
      [Tag.BILLING]: 0,
      [Tag.TECHNICAL]: 0,
      [Tag.SALES]: 0,
      [Tag.MISC]: 0,
    };

    const priorityCounts: Record<PriorityType, number> = {
      [Priority.LOW]: 0,
      [Priority.MEDIUM]: 0,
      [Priority.HIGH]: 0,
      [Priority.URGENT]: 0,
    };

    for (const ticket of tickets) {
      const normalizedTag = normalizeTag(ticket.aiTag);
      const normalizedPriority = normalizePriority(ticket.aiPriority);

      if (ticket.status === 'CLOSED') {
        closedByTag[normalizedTag] += 1;
      }

      if (ticket.status === 'OPEN' && ticket.hasAnalysis) {
        priorityCounts[normalizedPriority] += 1;
      }
    }

    const priorities = [Priority.URGENT, Priority.HIGH, Priority.MEDIUM, Priority.LOW].map((priority) => ({
      priority,
      count: priorityCounts[priority],
    }));

    const dailyTickets = demoMode
      ? buildSyntheticDailySeries(dateWindow)
      : buildActualDailySeries(tickets, dateWindow);

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
              createdAverage: DEMO_CREATED_AVERAGE,
              closedAverage: DEMO_CLOSED_AVERAGE,
            }
          : null,
      },
      queues: queueCounts,
      closedByTag,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
