import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /stats
 * Return aggregated statistics about tickets and AI analysis
 */
router.get('/', async (req, res) => {
  try {
    // Total tickets count
    const totalTickets = await prisma.ticket.count();
    const openTickets = await prisma.ticket.count({
      where: { status: 'OPEN' },
    });
    const closedTickets = await prisma.ticket.count({
      where: { status: 'CLOSED' },
    });

    // Count by tag
    const tagCounts = await prisma.ticketAIAnalysis.groupBy({
      by: ['aiTag'],
      _count: {
        aiTag: true,
      },
    });

    // Count by priority
    const priorityCounts = await prisma.ticketAIAnalysis.groupBy({
      by: ['aiPriority'],
      _count: {
        aiPriority: true,
      },
    });

    // Tickets with analysis
    const ticketsWithAnalysis = await prisma.ticketAIAnalysis.count();

    // Acceptance rate calculation
    // acceptedByAgent can be: null (undecided), true (accepted), false (rejected)
    const decidedAnalyses = await prisma.ticketAIAnalysis.count({
      where: {
        acceptedByAgent: { not: null },
      },
    });

    const acceptedAnalyses = await prisma.ticketAIAnalysis.count({
      where: {
        acceptedByAgent: true,
      },
    });

    const acceptanceRate = decidedAnalyses > 0
      ? Math.round((acceptedAnalyses / decidedAnalyses) * 100)
      : 0;

    // Pending AI analysis (tickets without analysis)
    const pendingAnalysis = totalTickets - ticketsWithAnalysis;

    // Format tag counts
    const tags = tagCounts.map(t => ({
      tag: t.aiTag,
      count: t._count.aiTag,
    }));

    // Format priority counts
    const priorities = priorityCounts.map(p => ({
      priority: p.aiPriority,
      count: p._count.aiPriority,
    }));

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
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
