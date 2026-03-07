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

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
    return fetchApi('/stats');
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
