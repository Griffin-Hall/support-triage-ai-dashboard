import type {
  Ticket,
  PaginatedTickets,
  TicketFilters,
  Stats,
  TicketAIAnalysis,
  ReplyPayload,
  AISettings,
  AISettingsSaveResponse,
  AIProviderType,
  AIConnectionTestResponse,
  ApiErrorPayload,
} from '../types';
import { Queue, Tag } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const DEMO_SESSION_STORAGE_KEY = 'support-triage-demo-session-id';

const DEFAULT_QUEUE_COUNTS: Record<string, number> = {
  [Queue.URGENT]: 0,
  [Queue.BILLING]: 0,
  [Queue.TECHNICAL]: 0,
  [Queue.SALES]: 0,
  [Queue.MISC]: 0,
  [Queue.CLOSED]: 0,
};

const DEFAULT_CLOSED_BY_TAG: Record<string, number> = {
  [Tag.BILLING]: 0,
  [Tag.TECHNICAL]: 0,
  [Tag.SALES]: 0,
  [Tag.MISC]: 0,
};

function buildDemoSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function getDemoSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const existing = window.sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const next = buildDemoSessionId();
    window.sessionStorage.setItem(DEMO_SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    // Storage can be disabled in some browser/privacy contexts; continue without session header.
    return null;
  }
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function normalizeStatsPayload(raw: any): Stats {
  const queues = {
    ...DEFAULT_QUEUE_COUNTS,
    ...(raw?.queues || {}),
  };

  const closedByTag = {
    ...DEFAULT_CLOSED_BY_TAG,
    ...(raw?.closedByTag || {}),
  };

  const simulatedRangeRaw = raw?.dailyTicketsMeta?.simulatedRange;
  let simulatedRange: { createdAverage: number; closedAverage: number } | null = null;
  if (simulatedRangeRaw) {
    if (
      typeof simulatedRangeRaw.createdAverage === 'number' ||
      typeof simulatedRangeRaw.closedAverage === 'number'
    ) {
      simulatedRange = {
        createdAverage: toNumber(simulatedRangeRaw.createdAverage, 20),
        closedAverage: toNumber(simulatedRangeRaw.closedAverage, 17),
      };
    } else if (typeof simulatedRangeRaw.min === 'number' || typeof simulatedRangeRaw.max === 'number') {
      const min = toNumber(simulatedRangeRaw.min, 15);
      const max = toNumber(simulatedRangeRaw.max, 35);
      const createdAverage = Math.round((min + max) / 2);
      simulatedRange = {
        createdAverage,
        closedAverage: Math.max(0, createdAverage - 3),
      };
    }
  }

  return {
    overview: {
      totalTickets: toNumber(raw?.overview?.totalTickets),
      openTickets: toNumber(raw?.overview?.openTickets),
      closedTickets: toNumber(raw?.overview?.closedTickets),
      ticketsWithAnalysis: toNumber(raw?.overview?.ticketsWithAnalysis),
      pendingAnalysis: toNumber(raw?.overview?.pendingAnalysis),
    },
    tags: Array.isArray(raw?.tags)
      ? raw.tags.map((entry: any) => ({
          tag: String(entry?.tag || Tag.MISC) as any,
          count: toNumber(entry?.count),
        }))
      : [],
    priorities: Array.isArray(raw?.priorities)
      ? raw.priorities.map((entry: any) => ({
          priority: String(entry?.priority || 'MEDIUM') as any,
          count: toNumber(entry?.count),
        }))
      : [],
    aiPerformance: {
      decidedAnalyses: toNumber(raw?.aiPerformance?.decidedAnalyses),
      acceptedAnalyses: toNumber(raw?.aiPerformance?.acceptedAnalyses),
      rejectedAnalyses: toNumber(raw?.aiPerformance?.rejectedAnalyses),
      acceptanceRate: toNumber(raw?.aiPerformance?.acceptanceRate),
    },
    kpis: {
      ticketsClosed: {
        total: toNumber(raw?.kpis?.ticketsClosed?.total),
        last7Days: toNumber(raw?.kpis?.ticketsClosed?.last7Days),
        last30Days: toNumber(raw?.kpis?.ticketsClosed?.last30Days),
      },
      aiDraftsCreated: {
        total: toNumber(raw?.kpis?.aiDraftsCreated?.total),
        last7Days: toNumber(raw?.kpis?.aiDraftsCreated?.last7Days),
        last30Days: toNumber(raw?.kpis?.aiDraftsCreated?.last30Days),
      },
    },
    dailyTickets: Array.isArray(raw?.dailyTickets)
      ? raw.dailyTickets.map((entry: any) => ({
          date: String(entry?.date || ''),
          label: String(entry?.label || ''),
          created: toNumber(entry?.created),
          closed: toNumber(entry?.closed),
          synthetic: Boolean(entry?.synthetic),
        }))
      : [],
    dailyTicketsMeta: {
      windowDays: toNumber(raw?.dailyTicketsMeta?.windowDays, 30),
      mode: raw?.dailyTicketsMeta?.mode === 'simulated' ? 'simulated' : 'actual',
      simulatedRange,
    },
    queues: queues as Stats['queues'],
    closedByTag: closedByTag as Stats['closedByTag'],
  };
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const demoSessionId = getDemoSessionId();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(demoSessionId ? { 'X-Demo-Session-Id': demoSessionId } : {}),
      ...options?.headers,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;

  if (!response.ok) {
    throw new ApiError(payload.error || `HTTP ${response.status}`, response.status, payload.code);
  }

  return payload as T;
}

export const ticketsApi = {
  getAll: (filters: TicketFilters = {}): Promise<PaginatedTickets> => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });

    return fetchApi(`/tickets?${params.toString()}`);
  },

  getById: (id: string): Promise<Ticket> => {
    return fetchApi(`/tickets/${id}`);
  },

  analyze: (id: string): Promise<{ analysis: TicketAIAnalysis; confidence: number }> => {
    return fetchApi(`/tickets/${id}/analyze`, { method: 'POST' });
  },

  regenerate: (id: string): Promise<{ analysis: TicketAIAnalysis; confidence: number; regenerated: boolean }> => {
    return fetchApi(`/tickets/${id}/regenerate`, { method: 'POST' });
  },

  reply: (id: string, payload: ReplyPayload): Promise<TicketAIAnalysis> => {
    return fetchApi(`/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const statsApi = {
  getAll: (): Promise<Stats> => {
    return fetchApi<any>('/stats').then(normalizeStatsPayload);
  },
};

export const aiApi = {
  getSettings: (): Promise<AISettings> => {
    return fetchApi('/ai/settings');
  },

  saveSettings: (payload: {
    activeProvider?: AIProviderType | null;
    keys?: Partial<Record<AIProviderType, string>>;
  }): Promise<AISettingsSaveResponse> => {
    return fetchApi('/ai/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  testConnection: (provider?: AIProviderType): Promise<AIConnectionTestResponse> => {
    return fetchApi('/ai/settings/test', {
      method: 'POST',
      body: JSON.stringify(provider ? { provider } : {}),
    });
  },
};
