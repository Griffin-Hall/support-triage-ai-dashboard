import { Router, type Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { callAiForTicket, Tag, Priority } from '../ai/triage';
import {
  AIProvider,
  AI_PROVIDER_LABELS,
  type AIProviderType,
  getApiKeyForProvider,
  isAiProvider,
  isProviderConfigured,
  validateApiKey,
} from '../ai/providers';

const prisma = new PrismaClient();
const router = Router();

const tagValues = [Tag.BILLING, Tag.TECHNICAL, Tag.ACCOUNT, Tag.URGENT, Tag.GENERAL] as const;
const priorityValues = [Priority.LOW, Priority.MEDIUM, Priority.HIGH] as const;
const statusValues = ['OPEN', 'CLOSED'] as const;

const tagEnum = z.enum(tagValues);
const priorityEnum = z.enum(priorityValues);

const ticketQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(50).default(20),
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

async function resolveAiProvider(): Promise<
  | {
      ok: true;
      provider: AIProviderType;
      apiKey: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    }
> {
  const config = await getOrCreateAiConfig();
  const demoOpenAiKey = getDemoOpenAiKey();

  if (!isAiProvider(config.activeProvider)) {
    if (demoOpenAiKey) {
      return {
        ok: true,
        provider: AIProvider.OPENAI,
        apiKey: demoOpenAiKey,
      };
    }

    return {
      ok: false,
      status: 412,
      code: 'AI_NOT_CONFIGURED',
      error: 'AI not configured. Open AI Engine settings and choose a provider.',
    };
  }

  const provider = config.activeProvider;

  if (provider === AIProvider.OPENAI && demoOpenAiKey && !config.openaiApiKey) {
    return {
      ok: true,
      provider,
      apiKey: demoOpenAiKey,
    };
  }

  if (!isProviderConfigured(config, provider)) {
    return {
      ok: false,
      status: 412,
      code: 'AI_PROVIDER_KEY_MISSING',
      error: `No API key configured for ${AI_PROVIDER_LABELS[provider]}.`,
    };
  }

  const apiKey = getApiKeyForProvider(config, provider);

  if (!apiKey || !validateApiKey(provider, apiKey)) {
    return {
      ok: false,
      status: 400,
      code: 'AI_PROVIDER_KEY_INVALID',
      error: `Invalid API key configured for ${AI_PROVIDER_LABELS[provider]}.`,
    };
  }

  return {
    ok: true,
    provider,
    apiKey,
  };
}

router.get('/', async (req, res) => {
  try {
    const { page, limit, tag, priority, status, search } = ticketQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where: any = {};

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

    let tickets;
    let total;

    if ((tag && tagValues.includes(tag as (typeof tagValues)[number])) || (priority && priorityValues.includes(priority as (typeof priorityValues)[number]))) {
      const aiAnalysisWhere: any = {};

      if (tag && tagValues.includes(tag as (typeof tagValues)[number])) {
        aiAnalysisWhere.aiTag = tag;
      }

      if (priority && priorityValues.includes(priority as (typeof priorityValues)[number])) {
        aiAnalysisWhere.aiPriority = priority;
      }

      tickets = await prisma.ticket.findMany({
        where: {
          ...where,
          aiAnalysis: Object.keys(aiAnalysisWhere).length > 0 ? aiAnalysisWhere : undefined,
        },
        include: {
          aiAnalysis: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      total = await prisma.ticket.count({
        where: {
          ...where,
          aiAnalysis: Object.keys(aiAnalysisWhere).length > 0 ? aiAnalysisWhere : undefined,
        },
      });
    } else {
      tickets = await prisma.ticket.findMany({
        where,
        include: {
          aiAnalysis: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      total = await prisma.ticket.count({ where });
    }

    res.json({
      tickets,
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

    res.json(ticket);
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

    const existingAnalysis = await prisma.ticketAIAnalysis.findUnique({
      where: { ticketId: id },
    });

    if (existingAnalysis) {
      return res.status(409).json({
        error: 'Analysis already exists for this ticket',
        analysis: existingAnalysis,
      });
    }

    const providerConfig = await resolveAiProvider();

    if (!providerConfig.ok) {
      return res.status(providerConfig.status).json({
        error: providerConfig.error,
        code: providerConfig.code,
      });
    }

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

    const aiResult = await callAiForTicket(
      {
        id: ticket.id,
        subject: ticket.subject,
        body: ticket.body,
        customerName: ticket.customerName,
      },
      providerConfig.provider,
      { apiKey: providerConfig.apiKey },
    );

    const analysis = await prisma.ticketAIAnalysis.create({
      data: {
        ticketId: id,
        aiTag: aiResult.tag,
        aiPriority: aiResult.priority,
        aiSuggestedReply: aiResult.suggestedReply,
        aiProvider: aiResult.provider,
        aiModel: aiResult.model,
        acceptedByAgent: null,
        finalReply: null,
      },
    });

    res.status(201).json({
      analysis,
      confidence: aiResult.confidence,
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

    if (!providerConfig.ok) {
      return res.status(providerConfig.status).json({
        error: providerConfig.error,
        code: providerConfig.code,
      });
    }

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

    const aiResult = await callAiForTicket(
      {
        id: ticket.id,
        subject: ticket.subject,
        body: ticket.body,
        customerName: ticket.customerName,
      },
      providerConfig.provider,
      { apiKey: providerConfig.apiKey },
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
            aiModel: aiResult.model,
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
            aiModel: aiResult.model,
            acceptedByAgent: null,
            finalReply: null,
          },
        });

    res.json({
      analysis,
      confidence: aiResult.confidence,
      regenerated: !!existingAnalysis,
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
          aiTag: aiTag ?? existingAnalysis.aiTag,
          aiPriority: aiPriority ?? existingAnalysis.aiPriority,
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

    res.json(updatedAnalysis);
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
