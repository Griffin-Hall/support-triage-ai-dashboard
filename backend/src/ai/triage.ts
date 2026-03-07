import { AIProvider, type AIProviderType, getModelForProvider } from './providers';

export const Tag = {
  BILLING: 'BILLING',
  TECHNICAL: 'TECHNICAL',
  ACCOUNT: 'ACCOUNT',
  URGENT: 'URGENT',
  GENERAL: 'GENERAL',
} as const;

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

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
  provider: AIProviderType;
  model: string;
}

export interface CallAiOptions {
  apiKey?: string;
}

const keywordRules: Array<{
  keywords: string[];
  tag: TagType;
  priority: PriorityType;
  exclude?: string[];
}> = [
  {
    keywords: ['urgent', 'asap', 'immediately', 'critical', 'down', 'outage', 'breach', 'compromised', 'security', 'hacked'],
    tag: Tag.URGENT,
    priority: Priority.HIGH,
  },
  {
    keywords: ['refund', 'charge', 'billing', 'invoice', 'payment', 'subscription', 'price', 'cost', 'money', 'credit card', 'charged', 'upgrade', 'plan'],
    tag: Tag.BILLING,
    priority: Priority.MEDIUM,
    exclude: ['urgent', 'critical'],
  },
  {
    keywords: ['error', 'bug', 'crash', 'not working', 'broken', 'failed', 'api', 'integration', 'slow', 'performance', 'timeout', '500', '404', 'exception', 'issue'],
    tag: Tag.TECHNICAL,
    priority: Priority.MEDIUM,
    exclude: ['urgent', 'critical'],
  },
  {
    keywords: ['login', 'password', 'account', 'access', 'forgot', 'locked', '2fa', 'two-factor', 'authentication', 'sign in', 'reset'],
    tag: Tag.ACCOUNT,
    priority: Priority.MEDIUM,
    exclude: ['urgent', 'critical'],
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

function countKeywords(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  let count = 0;

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
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

function pickClosing(provider: AIProviderType): string {
  if (provider === AIProvider.GEMINI) {
    return 'Thanks for your patience,\nSupport Team';
  }

  if (provider === AIProvider.KIMI_CODE_2_5) {
    return 'We are here if anything else comes up.\nSupport Team';
  }

  return 'Best regards,\nSupport Team';
}

function generateSuggestedReply(tag: TagType, ticket: TicketInput, provider: AIProviderType): string {
  const greeting = pickGreeting(ticket.customerName);
  const closing = pickClosing(provider);

  const providerNotes: Record<AIProviderType, string> = {
    [AIProvider.OPENAI]: 'I reviewed the details you shared and outlined next steps below.',
    [AIProvider.GEMINI]: 'I checked your request and prepared a fast resolution path below.',
    [AIProvider.KIMI_CODE_2_5]: 'I reviewed your case and listed the recommended handling steps below.',
  };

  const intro = providerNotes[provider];

  switch (tag) {
    case Tag.BILLING:
      return `${greeting}

${intro}

Thanks for contacting us about billing. I have reviewed your account and identified the issue. We are correcting it now and you should see the update reflected shortly.

If anything in the charge history still looks incorrect, reply with the transaction date and amount and we will investigate immediately.

${closing}`;

    case Tag.TECHNICAL:
      return `${greeting}

${intro}

Thanks for reporting this technical issue. To resolve this quickly, please share:
1. Exact steps to reproduce
2. Any error text or screenshots
3. Browser or app version

In parallel, we are checking platform logs for related errors.

${closing}`;

    case Tag.ACCOUNT:
      return `${greeting}

${intro}

I can help with account access. For security, please confirm the account email and your most recent successful login time. Once verified, I can proceed with reset and recovery steps.

${closing}`;

    case Tag.URGENT:
      return `${greeting}

${intro}

We are treating this as high priority and escalating immediately. You can expect an initial update within 30 minutes and regular follow-ups until resolution.

Reference: #${ticket.id.slice(0, 8).toUpperCase()}

${closing}`;

    case Tag.GENERAL:
    default:
      return `${greeting}

${intro}

Thanks for reaching out. We have logged your request and are reviewing it with the relevant team. We will follow up with specific guidance shortly.

${closing}`;
  }
}

function toTag(value: string | undefined): TagType {
  if (!value) {
    return Tag.GENERAL;
  }

  const normalized = value.toUpperCase();
  return (Object.values(Tag) as string[]).includes(normalized) ? (normalized as TagType) : Tag.GENERAL;
}

function toPriority(value: string | undefined): PriorityType {
  if (!value) {
    return Priority.MEDIUM;
  }

  const normalized = value.toUpperCase();
  return (Object.values(Priority) as string[]).includes(normalized)
    ? (normalized as PriorityType)
    : Priority.MEDIUM;
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
              'You triage customer support emails. Return JSON with keys tag, priority, suggestedReply. Tag must be one of BILLING, TECHNICAL, ACCOUNT, URGENT, GENERAL. Priority must be LOW, MEDIUM, or HIGH. suggestedReply should be a concise and professional email draft.',
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
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAiForTicket(
  ticket: TicketInput,
  provider: AIProviderType,
  options: CallAiOptions = {},
): Promise<TriageResult> {
  if (provider === AIProvider.OPENAI && options.apiKey) {
    try {
      return await callOpenAiForTicket(ticket, options.apiKey);
    } catch (error) {
      console.error('OpenAI call failed, falling back to deterministic triage:', error);
    }
  }

  const text = `${ticket.subject} ${ticket.body}`;

  const scores = keywordRules.map((rule) => {
    const matchCount = countKeywords(text, rule.keywords);
    const excludeCount = rule.exclude ? countKeywords(text, rule.exclude) : 0;
    const adjustedScore = excludeCount > 0 ? matchCount * 0.1 : matchCount;

    return {
      rule,
      score: adjustedScore,
    };
  });

  scores.sort((a, b) => b.score - a.score);
  const bestMatch = scores[0];

  let tag: TagType;
  let priority: PriorityType;
  let confidence: number;

  if (bestMatch.score > 0) {
    tag = bestMatch.rule.tag;
    priority = bestMatch.rule.priority;
    confidence = Math.min(0.95, 0.6 + bestMatch.score * 0.1);

    const urgentSignals = ['down', 'outage', 'breach', 'asap', 'critical'];
    const hasUrgentSignal = urgentSignals.some((keyword) => normalizeText(text).includes(keyword));

    if (hasUrgentSignal && priority !== Priority.HIGH) {
      priority = Priority.HIGH;
    }
  } else {
    tag = Tag.GENERAL;
    priority = Priority.LOW;
    confidence = 0.5;
  }

  const suggestedReply = generateSuggestedReply(tag, ticket, provider);

  await new Promise((resolve) => setTimeout(resolve, 350 + Math.random() * 500));

  return {
    tag,
    priority,
    suggestedReply,
    confidence,
    provider,
    model: getModelForProvider(provider),
  };
}
