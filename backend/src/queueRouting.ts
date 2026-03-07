import { KEYWORD_FALLBACK_PROVIDER, Priority, Tag, type PriorityType, type TagType } from './ai/triage';

export const TicketQueue = {
  URGENT: 'URGENT',
  BILLING: 'BILLING',
  TECHNICAL: 'TECHNICAL',
  SALES: 'SALES',
  MISC: 'MISC',
} as const;

export type TicketQueueType = typeof TicketQueue[keyof typeof TicketQueue];

export const TICKET_QUEUE_VALUES: TicketQueueType[] = [
  TicketQueue.URGENT,
  TicketQueue.BILLING,
  TicketQueue.TECHNICAL,
  TicketQueue.SALES,
  TicketQueue.MISC,
];

const LEGACY_MISC_TAGS = new Set(['ACCOUNT', 'GENERAL']);

export function normalizeTag(value: string | null | undefined): TagType {
  if (!value) {
    return Tag.MISC;
  }

  const normalized = value.toUpperCase();

  if (LEGACY_MISC_TAGS.has(normalized)) {
    return Tag.MISC;
  }

  if (normalized === 'URGENT') {
    return Tag.MISC;
  }

  return (Object.values(Tag) as string[]).includes(normalized) ? (normalized as TagType) : Tag.MISC;
}

export function normalizePriority(value: string | null | undefined): PriorityType {
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

export function isUrgentClassification(tag: string | null | undefined, priority: string | null | undefined): boolean {
  const normalizedPriority = normalizePriority(priority);
  const rawTag = (tag || '').toUpperCase();

  return normalizedPriority === Priority.URGENT || normalizedPriority === Priority.HIGH || rawTag === 'URGENT';
}

// Primary queue routing rules:
// 1) Urgent queue: highest-priority tickets (URGENT/HIGH).
// 2) Billing queue: BILLING, non-urgent.
// 3) Technical queue: TECHNICAL, non-urgent.
// 4) Sales queue: SALES, non-urgent.
// 5) Misc queue: everything else.
export function routeTicketQueue(tag: string | null | undefined, priority: string | null | undefined): TicketQueueType {
  if (isUrgentClassification(tag, priority)) {
    return TicketQueue.URGENT;
  }

  const normalizedTag = normalizeTag(tag);

  if (normalizedTag === Tag.BILLING) {
    return TicketQueue.BILLING;
  }

  if (normalizedTag === Tag.TECHNICAL) {
    return TicketQueue.TECHNICAL;
  }

  if (normalizedTag === Tag.SALES) {
    return TicketQueue.SALES;
  }

  return TicketQueue.MISC;
}

export function isNeedsReviewClassification(
  tag: string | null | undefined,
  provider: string | null | undefined,
): boolean {
  const normalizedTag = normalizeTag(tag);
  return normalizedTag === Tag.MISC && (provider || '').toUpperCase() === KEYWORD_FALLBACK_PROVIDER;
}

function urgentAnalysisClause(): any {
  return {
    OR: [{ aiPriority: { in: [Priority.URGENT, Priority.HIGH] } }, { aiTag: 'URGENT' }],
  };
}

export function buildQueueWhereClause(queue: TicketQueueType): any {
  const urgentClause = urgentAnalysisClause();

  if (queue === TicketQueue.URGENT) {
    return { aiAnalysis: { is: urgentClause } };
  }

  if (queue === TicketQueue.BILLING) {
    return {
      aiAnalysis: {
        is: {
          AND: [{ aiTag: Tag.BILLING }, { NOT: urgentClause }],
        },
      },
    };
  }

  if (queue === TicketQueue.TECHNICAL) {
    return {
      aiAnalysis: {
        is: {
          AND: [{ aiTag: Tag.TECHNICAL }, { NOT: urgentClause }],
        },
      },
    };
  }

  if (queue === TicketQueue.SALES) {
    return {
      aiAnalysis: {
        is: {
          AND: [{ aiTag: Tag.SALES }, { NOT: urgentClause }],
        },
      },
    };
  }

  return {
    OR: [
      { aiAnalysis: { is: null } },
      {
        aiAnalysis: {
          is: {
            AND: [{ NOT: urgentClause }, { aiTag: { notIn: [Tag.BILLING, Tag.TECHNICAL, Tag.SALES] } }],
          },
        },
      },
    ],
  };
}
