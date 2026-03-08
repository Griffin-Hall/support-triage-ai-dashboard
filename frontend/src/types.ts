export const Status = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

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

export const Queue = {
  URGENT: 'URGENT',
  BILLING: 'BILLING',
  TECHNICAL: 'TECHNICAL',
  SALES: 'SALES',
  MISC: 'MISC',
  CLOSED: 'CLOSED',
} as const;

export const AIProvider = {
  KIMI_CODE_2_5: 'KIMI_CODE_2_5',
  GEMINI: 'GEMINI',
  OPENAI: 'OPENAI',
} as const;

export type StatusType = typeof Status[keyof typeof Status];
export type TagType = typeof Tag[keyof typeof Tag];
export type PriorityType = typeof Priority[keyof typeof Priority];
export type QueueType = typeof Queue[keyof typeof Queue];
export type AIProviderType = typeof AIProvider[keyof typeof AIProvider];

export interface Ticket {
  id: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  body: string;
  status: StatusType;
  createdAt: string;
  updatedAt: string;
  queue?: QueueType;
  aiAnalysis?: TicketAIAnalysis;
}

export interface TicketAIAnalysis {
  id: string;
  ticketId: string;
  aiTag: TagType;
  aiPriority: PriorityType;
  aiSuggestedReply: string;
  aiProvider: string | null;
  aiModel: string | null;
  acceptedByAgent: boolean | null;
  finalReply: string | null;
  needsReview?: boolean;
  queue?: QueueType;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTickets {
  tickets: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Stats {
  overview: {
    totalTickets: number;
    openTickets: number;
    closedTickets: number;
    ticketsWithAnalysis: number;
    pendingAnalysis: number;
  };
  tags: { tag: TagType; count: number }[];
  priorities: { priority: PriorityType; count: number }[];
  aiPerformance: {
    decidedAnalyses: number;
    acceptedAnalyses: number;
    rejectedAnalyses: number;
    acceptanceRate: number;
  };
  kpis: {
    ticketsClosed: {
      total: number;
      last7Days: number;
      last30Days: number;
    };
    aiDraftsCreated: {
      total: number;
      last7Days: number;
      last30Days: number;
    };
  };
  dailyTickets: Array<{
    date: string;
    label: string;
    created: number;
    closed: number;
    synthetic: boolean;
  }>;
  dailyTicketsMeta: {
    windowDays: number;
    mode: 'simulated' | 'actual';
    simulatedRange: {
      min: number;
      max: number;
    } | null;
  };
  queues: Record<QueueType, number>;
}

export interface TicketFilters {
  page?: number;
  limit?: number;
  queue?: QueueType;
  tag?: TagType;
  priority?: PriorityType;
  status?: StatusType;
  search?: string;
}

export interface AIProviderInfo {
  provider: AIProviderType;
  displayName: string;
  configured: boolean;
  maskedKey: string | null;
}

export interface AISettings {
  activeProvider: AIProviderType | null;
  providers: AIProviderInfo[];
  hasAnyConfigured: boolean;
  updatedAt: string;
}

export interface AISettingsSaveResponse {
  settings: AISettings;
  warnings: string[];
}

export interface AIConnectionTestResponse {
  success: boolean;
  provider: AIProviderType;
  displayName: string;
  model: string;
  testedAt: string;
  message: string;
}

export interface ReplyPayload {
  finalReply: string;
  acceptedAiSuggestion?: boolean;
  aiTag?: TagType;
  aiPriority?: PriorityType;
}

export interface ApiErrorPayload {
  error?: string;
  code?: string;
}
