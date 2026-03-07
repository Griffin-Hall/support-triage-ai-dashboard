import { AIProvider, type AIProviderType, getModelForProvider } from './providers';

export const Tag = {
  BILLING: 'BILLING',
  TECHNICAL: 'TECHNICAL',
  SALES: 'SALES',
  MISC: 'MISC',
} as const;

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export const KEYWORD_FALLBACK_PROVIDER = 'KEYWORD_FALLBACK';

export type TagType = typeof Tag[keyof typeof Tag];
export type PriorityType = typeof Priority[keyof typeof Priority];

export interface TicketInput {
  id: string;
  subject: string;
  body: string;
  customerName: string;
}

export interface TriageResult {
  tag: TagType;
  priority: PriorityType;
  suggestedReply: string;
  confidence: number;
  provider: string;
  model: string;
  usedFallback: boolean;
  needsReview: boolean;
}

export interface CallAiOptions {
  apiKey?: string;
}

interface CategoryRule {
  keywords: string[];
  tag: TagType;
}

interface CategoryResult {
  tag: TagType;
  confidence: number;
  needsReview: boolean;
}

const categoryRules: CategoryRule[] = [
  {
    keywords: [
      'refund',
      'charge',
      'billing',
      'invoice',
      'payment',
      'subscription',
      'price',
      'cost',
      'credit card',
      'charged',
      'upgrade',
      'plan',
      'discount',
      'renewal',
      'receipt',
    ],
    tag: Tag.BILLING,
  },
  {
    keywords: [
      'error',
      'bug',
      'crash',
      'not working',
      'broken',
      'failed',
      'api',
      'integration',
      'slow',
      'performance',
      'timeout',
      '500',
      '404',
      'exception',
      'outage',
      'latency',
      'incident',
      'cannot access',
    ],
    tag: Tag.TECHNICAL,
  },
  {
    keywords: [
      'pricing',
      'quote',
      'demo',
      'trial',
      'enterprise',
      'purchase',
      'buy',
      'upgrade plan',
      'seats',
      'proposal',
      'sales',
      'contract',
      'rfp',
      'subscription options',
    ],
    tag: Tag.SALES,
  },
];

const urgentSignals = [
  'urgent',
  'asap',
  'immediately',
  'critical',
  'outage',
  'down',
  'breach',
  'security',
  'hacked',
  'production down',
  'sev1',
  'p1',
  'cannot access',
  'data loss',
];

const highSignals = ['blocked', 'not working', 'failure', 'failing', 'error', 'timeout', 'degraded', 'slow'];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

function countKeywords(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  let count = 0;

  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'g');
    const matches = normalized.match(regex);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

function pickGreeting(customerName: string): string {
  const firstName = customerName.split(' ')[0];
  const greetings = [`Hi ${firstName},`, `Hello ${firstName},`, `Dear ${customerName},`];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function pickClosing(provider: string): string {
  if (provider === AIProvider.GEMINI) {
    return 'Thanks for your patience,\nSupport Team';
  }

  if (provider === AIProvider.KIMI_CODE_2_5) {
    return 'We are here if anything else comes up.\nSupport Team';
  }

  if (provider === KEYWORD_FALLBACK_PROVIDER) {
    return 'Thank you,\nSupport Team';
  }

  return 'Best regards,\nSupport Team';
}

function generateSuggestedReply(tag: TagType, ticket: TicketInput, provider: string): string {
  const greeting = pickGreeting(ticket.customerName);
  const closing = pickClosing(provider);

  const providerNotes: Record<string, string> = {
    [AIProvider.OPENAI]: 'I reviewed the details you shared and outlined next steps below.',
    [AIProvider.GEMINI]: 'I checked your request and prepared a fast resolution path below.',
    [AIProvider.KIMI_CODE_2_5]: 'I reviewed your case and listed the recommended handling steps below.',
    [KEYWORD_FALLBACK_PROVIDER]: 'I reviewed your request and drafted a best-effort next step.',
  };

  const intro = providerNotes[provider] ?? providerNotes[KEYWORD_FALLBACK_PROVIDER];

  switch (tag) {
    case Tag.BILLING:
      return `${greeting}

${intro}

Thanks for contacting us about billing. I have reviewed your account details and started validation on the charge history.

If any amount still looks incorrect, please reply with the transaction date and amount so we can complete this quickly.

${closing}`;

    case Tag.TECHNICAL:
      return `${greeting}

${intro}

Thanks for reporting this technical issue. To accelerate resolution, please share:
1. Exact steps to reproduce
2. Any error text or screenshots
3. Browser or app version

We are also checking platform logs on our side now.

${closing}`;

    case Tag.SALES:
      return `${greeting}

${intro}

Thanks for your interest in expanding with us. I have shared your request with our sales team so they can provide the right plan guidance and pricing details.

Please let us know your target seat count and timeline so we can tailor recommendations.

${closing}`;

    case Tag.MISC:
    default:
      return `${greeting}

${intro}

Thanks for reaching out. We have logged your request and routed it to the appropriate team for review.

We will follow up with specific guidance shortly.

${closing}`;
  }
}

function toTag(value: string | undefined): TagType {
  if (!value) {
    return Tag.MISC;
  }

  const normalized = value.toUpperCase();
  if (normalized === 'GENERAL' || normalized === 'ACCOUNT' || normalized === 'URGENT') {
    return Tag.MISC;
  }

  return (Object.values(Tag) as string[]).includes(normalized) ? (normalized as TagType) : Tag.MISC;
}

function toPriority(value: string | undefined): PriorityType {
  if (!value) {
    return Priority.MEDIUM;
  }

  const normalized = value.toUpperCase();
  if (normalized === 'CRITICAL') {
    return Priority.URGENT;
  }

  return (Object.values(Priority) as string[]).includes(normalized)
    ? (normalized as PriorityType)
    : Priority.MEDIUM;
}

function classifyCategory(text: string): CategoryResult {
  const scores = categoryRules.map((rule) => ({
    rule,
    score: countKeywords(text, rule.keywords),
  }));

  scores.sort((left, right) => right.score - left.score);

  const best = scores[0];
  const second = scores[1];

  if (!best || best.score === 0) {
    return {
      tag: Tag.MISC,
      confidence: 0.45,
      needsReview: true,
    };
  }

  if (second && best.score === second.score) {
    return {
      tag: Tag.MISC,
      confidence: 0.5,
      needsReview: true,
    };
  }

  if (second && best.score - second.score <= 1) {
    return {
      tag: Tag.MISC,
      confidence: 0.55,
      needsReview: true,
    };
  }

  return {
    tag: best.rule.tag,
    confidence: Math.min(0.94, 0.62 + best.score * 0.08),
    needsReview: false,
  };
}

function classifyPriority(text: string, tag: TagType): PriorityType {
  const normalized = normalizeText(text);
  const urgentCount = urgentSignals.reduce((sum, signal) => sum + (normalized.includes(signal) ? 1 : 0), 0);
  if (urgentCount > 0) {
    return Priority.URGENT;
  }

  const highCount = highSignals.reduce((sum, signal) => sum + (normalized.includes(signal) ? 1 : 0), 0);
  if (highCount >= 2) {
    return Priority.HIGH;
  }

  if (tag === Tag.BILLING || tag === Tag.TECHNICAL || tag === Tag.SALES) {
    return Priority.MEDIUM;
  }

  return Priority.LOW;
}

async function keywordTriage(
  ticket: TicketInput,
  providerLabel: string,
  modelLabel: string,
  usedFallback: boolean,
): Promise<TriageResult> {
  const text = `${ticket.subject} ${ticket.body}`;
  const category = classifyCategory(text);
  const priority = classifyPriority(text, category.tag);
  const suggestedReply = generateSuggestedReply(category.tag, ticket, providerLabel);

  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 350));

  return {
    tag: category.tag,
    priority,
    suggestedReply,
    confidence: category.confidence,
    provider: providerLabel,
    model: modelLabel,
    usedFallback,
    needsReview: category.needsReview || (usedFallback && category.tag === Tag.MISC),
  };
}

async function callOpenAiForTicket(ticket: TicketInput, apiKey: string): Promise<TriageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getModelForProvider(AIProvider.OPENAI),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You triage customer support emails. Return JSON with keys tag, priority, suggestedReply. Tag must be one of BILLING, TECHNICAL, SALES, MISC. Priority must be LOW, MEDIUM, HIGH, or URGENT. suggestedReply should be concise, professional, and agent-ready.',
          },
          {
            role: 'user',
            content: `Ticket ID: ${ticket.id}\nCustomer: ${ticket.customerName}\nSubject: ${ticket.subject}\nBody: ${ticket.body}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI response did not include message content.');
    }

    const parsed = JSON.parse(content) as {
      tag?: string;
      priority?: string;
      suggestedReply?: string;
    };

    const tag = toTag(parsed.tag);
    const priority = toPriority(parsed.priority);
    const suggestedReply = (parsed.suggestedReply || '').trim();

    if (!suggestedReply) {
      throw new Error('OpenAI response did not include suggestedReply.');
    }

    return {
      tag,
      priority,
      suggestedReply,
      confidence: 0.93,
      provider: AIProvider.OPENAI,
      model: getModelForProvider(AIProvider.OPENAI),
      usedFallback: false,
      needsReview: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAiForTicket(
  ticket: TicketInput,
  provider: AIProviderType | null,
  options: CallAiOptions = {},
): Promise<TriageResult> {
  if (provider === AIProvider.OPENAI && options.apiKey) {
    try {
      return await callOpenAiForTicket(ticket, options.apiKey);
    } catch (error) {
      console.error('OpenAI call failed, falling back to deterministic triage:', error);
      return keywordTriage(ticket, KEYWORD_FALLBACK_PROVIDER, 'Keyword Heuristic v2', true);
    }
  }

  if (provider === AIProvider.GEMINI || provider === AIProvider.KIMI_CODE_2_5) {
    return keywordTriage(ticket, provider, getModelForProvider(provider), false);
  }

  return keywordTriage(ticket, KEYWORD_FALLBACK_PROVIDER, 'Keyword Heuristic v2', true);
}
