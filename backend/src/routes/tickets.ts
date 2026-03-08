import { Router, type Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { callAiForTicket, Priority, Tag } from '../ai/triage';
import {
  AIProvider,
  type AIProviderType,
  getApiKeyForProvider,
  isAiProvider,
  isProviderConfigured,
  validateApiKey,
} from '../ai/providers';
import {
  TICKET_QUEUE_VALUES,
  type TicketQueueType,
  buildQueueWhereClause,
  isNeedsReviewClassification,
  normalizePriority,
  normalizeTag,
  routeTicketQueue,
} from '../queueRouting';

const prisma = new PrismaClient();
const router = Router();

const canonicalTagValues = [Tag.BILLING, Tag.TECHNICAL, Tag.SALES, Tag.MISC] as const;
const legacyTagValues = ['ACCOUNT', 'GENERAL', 'URGENT'] as const;
const allTagValues = [...canonicalTagValues, ...legacyTagValues] as const;
const priorityValues = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT] as const;
const statusValues = ['OPEN', 'CLOSED'] as const;

const tagEnum = z.enum(canonicalTagValues);
const priorityEnum = z.enum(priorityValues);

const ticketQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  queue: z.string().optional(),
  tag: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

const replySchema = z.object({
  finalReply: z.string().min(1),
  acceptedAiSuggestion: z.boolean().optional(),
  aiTag: tagEnum.optional(),
  aiPriority: priorityEnum.optional(),
});

const DEMO_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DEMO_LIMIT_PER_HOUR = Math.max(1, Number.parseInt(process.env.DEMO_AI_LIMIT_PER_HOUR || '3', 10) || 3);
const aiRateBuckets = new Map<string, { count: number; resetAt: number }>();

function isQueue(value: string | undefined): value is TicketQueueType {
  return !!value && TICKET_QUEUE_VALUES.includes(value as TicketQueueType);
}

function isFilterTag(value: string | undefined): value is (typeof allTagValues)[number] {
  return !!value && allTagValues.includes(value as (typeof allTagValues)[number]);
}

function isPriority(value: string | undefined): value is (typeof priorityValues)[number] {
  return !!value && priorityValues.includes(value as (typeof priorityValues)[number]);
}

function getAiTagFilter(value: (typeof allTagValues)[number]): any {
  if (value === Tag.MISC) {
    return { aiTag: { in: [Tag.MISC, 'GENERAL', 'ACCOUNT'] } };
  }

  if (value === 'GENERAL' || value === 'ACCOUNT') {
    return { aiTag: { in: ['GENERAL', 'ACCOUNT', Tag.MISC] } };
  }

  if (value === 'URGENT') {
    return { aiTag: 'URGENT' };
  }

  return { aiTag: value };
}

function toPublicAnalysis(analysis: any) {
  if (!analysis) {
    return analysis;
  }

  const normalizedTag = normalizeTag(analysis.aiTag);
  const normalizedPriority = normalizePriority(analysis.aiPriority);

  return {
    ...analysis,
    aiTag: normalizedTag,
    aiPriority: normalizedPriority,
    needsReview: isNeedsReviewClassification(normalizedTag, analysis.aiProvider),
    queue: routeTicketQueue(normalizedTag, normalizedPriority),
  };
}

function toPublicTicket(ticket: any) {
  if (!ticket) {
    return ticket;
  }

  return {
    ...ticket,
    aiAnalysis: ticket.aiAnalysis ? toPublicAnalysis(ticket.aiAnalysis) : undefined,
    queue: routeTicketQueue(ticket.aiAnalysis?.aiTag, ticket.aiAnalysis?.aiPriority, ticket.status),
  };
}

async function getOrCreateAiConfig() {
  const existing = await prisma.aiConfig.findUnique({ where: { id: 1 } });

  if (existing) {
    return existing;
  }

  return prisma.aiConfig.create({
    data: {
      id: 1,
      activeProvider: null,
      openaiApiKey: null,
      geminiApiKey: null,
      kimiApiKey: null,
    },
  });
}

function getDemoOpenAiKey(): string | null {
  const candidate = process.env.OPENAI_API_KEY?.trim();
  if (!candidate) {
    return null;
  }

  return validateApiKey(AIProvider.OPENAI, candidate) ? candidate : null;
}

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }

  return req.ip || 'unknown';
}

function consumeAiQuota(req: Request): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const identifier = getClientIdentifier(req);
  const now = Date.now();
  const existing = aiRateBuckets.get(identifier);

  if (!existing || now >= existing.resetAt) {
    const nextBucket = {
      count: 1,
      resetAt: now + DEMO_LIMIT_WINDOW_MS,
    };

    aiRateBuckets.set(identifier, nextBucket);

    return {
      allowed: true,
      remaining: Math.max(0, DEMO_LIMIT_PER_HOUR - nextBucket.count),
      retryAfterSeconds: Math.ceil((nextBucket.resetAt - now) / 1000),
    };
  }

  if (existing.count >= DEMO_LIMIT_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: Math.max(0, DEMO_LIMIT_PER_HOUR - existing.count),
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  };
}

async function resolveAiProvider(): Promise<{
  provider: AIProviderType | null;
  apiKey: string | null;
  usedFallback: boolean;
}> {
  const config = await getOrCreateAiConfig();
  const demoOpenAiKey = getDemoOpenAiKey();

  if (!isAiProvider(config.activeProvider)) {
    if (demoOpenAiKey) {
      return {
        provider: AIProvider.OPENAI,
        apiKey: demoOpenAiKey,
        usedFallback: false,
      };
    }

    return {
      provider: null,
      apiKey: null,
      usedFallback: true,
    };
  }

  const provider = config.activeProvider;

  if (provider === AIProvider.OPENAI && demoOpenAiKey && !config.openaiApiKey) {
    return {
      provider: AIProvider.OPENAI,
      apiKey: demoOpenAiKey,
      usedFallback: false,
    };
  }

  if (!isProviderConfigured(config, provider)) {
    return {
      provider: null,
      apiKey: null,
      usedFallback: true,
    };
  }

  const apiKey = getApiKeyForProvider(config, provider);
  if (!apiKey) {
    return {
      provider: null,
      apiKey: null,
      usedFallback: true,
    };
  }

  if (!validateApiKey(provider, apiKey)) {
    return {
      provider: null,
      apiKey: null,
      usedFallback: true,
    };
  }

  return {
    provider,
    apiKey,
    usedFallback: false,
  };
}

router.get('/', async (req, res) => {
  try {
    const { page, limit, queue, tag, priority, status, search } = ticketQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where: any = {};
    const andFilters: any[] = [];

    if (status && statusValues.includes(status as (typeof statusValues)[number])) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isQueue(queue)) {
      andFilters.push(buildQueueWhereClause(queue));
    }

    if (isFilterTag(tag) || isPriority(priority)) {
      const aiAnalysisWhere: any = {};

      if (isFilterTag(tag)) {
        Object.assign(aiAnalysisWhere, getAiTagFilter(tag));
      }

      if (isPriority(priority)) {
        aiAnalysisWhere.aiPriority = priority;
      }

      andFilters.push({
        aiAnalysis: {
          is: aiAnalysisWhere,
        },
      });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          aiAnalysis: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({
      tickets: tickets.map(toPublicTicket),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(400).json({ error: 'Invalid query parameters' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        aiAnalysis: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(toPublicTicket(ticket));
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status === 'CLOSED') {
      return res.status(409).json({
        error: 'Closed tickets cannot be analyzed.',
        code: 'TICKET_CLOSED',
      });
    }

    const existingAnalysis = await prisma.ticketAIAnalysis.findUnique({
      where: { ticketId: id },
    });

    if (existingAnalysis) {
      return res.status(409).json({
        error: 'Analysis already exists for this ticket',
        analysis: toPublicAnalysis(existingAnalysis),
      });
    }

    const providerConfig = await resolveAiProvider();
    const shouldRateLimit = providerConfig.provider === AIProvider.OPENAI && !!providerConfig.apiKey;

    if (shouldRateLimit) {
      const quota = consumeAiQuota(req);

      if (!quota.allowed) {
        res.setHeader('Retry-After', String(quota.retryAfterSeconds));
        return res.status(429).json({
          error: `Demo AI rate limit reached. You can send up to ${DEMO_LIMIT_PER_HOUR} requests per hour.`,
          code: 'AI_RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: quota.retryAfterSeconds,
        });
      }

      res.setHeader('X-RateLimit-Limit', String(DEMO_LIMIT_PER_HOUR));
      res.setHeader('X-RateLimit-Remaining', String(quota.remaining));
    }

    const aiResult = await callAiForTicket(
      {
        id: ticket.id,
        subject: ticket.subject,
        body: ticket.body,
        customerName: ticket.customerName,
      },
      providerConfig.provider,
      { apiKey: providerConfig.apiKey ?? undefined },
    );

    const analysis = await prisma.ticketAIAnalysis.create({
      data: {
        ticketId: id,
        aiTag: aiResult.tag,
        aiPriority: aiResult.priority,
        aiSuggestedReply: aiResult.suggestedReply,
        aiProvider: aiResult.provider,
        aiModel: aiResult.needsReview ? `${aiResult.model} (Needs review)` : aiResult.model,
        acceptedByAgent: null,
        finalReply: null,
      },
    });

    const queue = routeTicketQueue(aiResult.tag, aiResult.priority);

    res.status(201).json({
      analysis: toPublicAnalysis(analysis),
      confidence: aiResult.confidence,
      usedFallback: providerConfig.usedFallback || aiResult.usedFallback,
      queue,
    });
  } catch (error) {
    console.error('Error analyzing ticket:', error);
    res.status(500).json({ error: 'Failed to analyze ticket' });
  }
});

router.post('/:id/regenerate', async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status === 'CLOSED') {
      return res.status(409).json({
        error: 'Closed tickets cannot be regenerated.',
        code: 'TICKET_CLOSED',
      });
    }

    const providerConfig = await resolveAiProvider();
    const shouldRateLimit = providerConfig.provider === AIProvider.OPENAI && !!providerConfig.apiKey;

    if (shouldRateLimit) {
      const quota = consumeAiQuota(req);

      if (!quota.allowed) {
        res.setHeader('Retry-After', String(quota.retryAfterSeconds));
        return res.status(429).json({
          error: `Demo AI rate limit reached. You can send up to ${DEMO_LIMIT_PER_HOUR} requests per hour.`,
          code: 'AI_RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: quota.retryAfterSeconds,
        });
      }

      res.setHeader('X-RateLimit-Limit', String(DEMO_LIMIT_PER_HOUR));
      res.setHeader('X-RateLimit-Remaining', String(quota.remaining));
    }

    const aiResult = await callAiForTicket(
      {
        id: ticket.id,
        subject: ticket.subject,
        body: ticket.body,
        customerName: ticket.customerName,
      },
      providerConfig.provider,
      { apiKey: providerConfig.apiKey ?? undefined },
    );

    const existingAnalysis = await prisma.ticketAIAnalysis.findUnique({
      where: { ticketId: id },
    });

    const analysis = existingAnalysis
      ? await prisma.ticketAIAnalysis.update({
          where: { ticketId: id },
          data: {
            aiTag: aiResult.tag,
            aiPriority: aiResult.priority,
            aiSuggestedReply: aiResult.suggestedReply,
            aiProvider: aiResult.provider,
            aiModel: aiResult.needsReview ? `${aiResult.model} (Needs review)` : aiResult.model,
            createdAt: new Date(),
            acceptedByAgent: null,
            finalReply: null,
          },
        })
      : await prisma.ticketAIAnalysis.create({
          data: {
            ticketId: id,
            aiTag: aiResult.tag,
            aiPriority: aiResult.priority,
            aiSuggestedReply: aiResult.suggestedReply,
            aiProvider: aiResult.provider,
            aiModel: aiResult.needsReview ? `${aiResult.model} (Needs review)` : aiResult.model,
            acceptedByAgent: null,
            finalReply: null,
          },
        });

    const queue = routeTicketQueue(aiResult.tag, aiResult.priority);

    res.json({
      analysis: toPublicAnalysis(analysis),
      confidence: aiResult.confidence,
      regenerated: !!existingAnalysis,
      usedFallback: providerConfig.usedFallback || aiResult.usedFallback,
      queue,
    });
  } catch (error) {
    console.error('Error regenerating analysis:', error);
    res.status(500).json({ error: 'Failed to regenerate AI output' });
  }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { finalReply, acceptedAiSuggestion, aiTag, aiPriority } = replySchema.parse(req.body);

    const ticket = await prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status === 'CLOSED') {
      return res.status(409).json({
        error: 'Ticket is already closed.',
        code: 'TICKET_CLOSED',
      });
    }

    const existingAnalysis = await prisma.ticketAIAnalysis.findUnique({
      where: { ticketId: id },
    });

    let updatedAnalysis;

    if (existingAnalysis) {
      updatedAnalysis = await prisma.ticketAIAnalysis.update({
        where: { ticketId: id },
        data: {
          finalReply,
          acceptedByAgent: acceptedAiSuggestion ?? false,
          aiTag: aiTag ?? normalizeTag(existingAnalysis.aiTag),
          aiPriority: aiPriority ?? normalizePriority(existingAnalysis.aiPriority),
        },
      });
    } else {
      if (!aiTag || !aiPriority) {
        return res.status(400).json({
          error: 'Manual replies require tag and priority when no AI analysis exists.',
          code: 'MANUAL_TAGS_REQUIRED',
        });
      }

      updatedAnalysis = await prisma.ticketAIAnalysis.create({
        data: {
          ticketId: id,
          aiTag,
          aiPriority,
          aiSuggestedReply: '',
          aiProvider: 'MANUAL',
          aiModel: 'Manual Agent',
          acceptedByAgent: acceptedAiSuggestion ?? false,
          finalReply,
        },
      });
    }

    await prisma.ticket.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    res.json(toPublicAnalysis(updatedAnalysis));
  } catch (error) {
    console.error('Error submitting reply:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: error.errors,
      });
    }

    res.status(500).json({ error: 'Failed to submit reply' });
  }
});

export default router;
