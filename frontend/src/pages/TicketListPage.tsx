import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ticketsApi } from '../api/client';
import Badge from '../components/Badge';
import StatsPanel from '../components/StatsPanel';
import { useAISettings } from '../context/AISettingsContext';
import { aiUsageClasses, formatRelativeTime, getAiUsageSignal } from '../utils/ticketPresentation';
import {
  Priority,
  Queue,
  Status,
  Tag,
  type PriorityType,
  type QueueType,
  type StatusType,
  type TagType,
  type Ticket,
  type TicketFilters,
} from '../types';

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function snippet(text: string): string {
  if (text.length <= 140) {
    return text;
  }

  return `${text.slice(0, 137)}...`;
}

export default function TicketListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useAISettings();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  const queryState = searchParams.toString();

  const filters: TicketFilters = useMemo(
    () => ({
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: 20,
      queue: (searchParams.get('queue') as QueueType) || undefined,
      tag: (searchParams.get('tag') as TagType) || undefined,
      priority: (searchParams.get('priority') as PriorityType) || undefined,
      status: (searchParams.get('status') as StatusType) || undefined,
      search: searchParams.get('search') || undefined,
    }),
    [queryState],
  );

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ticketsApi.getAll(filters);
      setTickets(data.tickets);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const updateFilters = (next: Partial<TicketFilters>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    if (!Object.prototype.hasOwnProperty.call(next, 'page')) {
      params.set('page', '1');
    }

    setSearchParams(params);
  };

  const aiProviderName = settings?.activeProvider
    ? settings.providers.find((provider) => provider.provider === settings.activeProvider)?.displayName
    : null;

  const urgentCount = tickets.filter(
    (ticket) => ticket.aiAnalysis?.aiPriority === Priority.URGENT || ticket.aiAnalysis?.aiPriority === Priority.HIGH,
  ).length;

  return (
    <div className="space-y-4 pb-6">
      <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">AI-Assisted Support Triage</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900">Route every ticket with confidence</h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Incoming emails are classified by category, prioritized by urgency, and paired with an AI draft that agents can edit before sending.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">In queue</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{pagination.total}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-700">Urgent</p>
              <p className="mt-1 text-xl font-bold text-amber-900">{urgentCount}</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-700">AI Engine</p>
              <p className="mt-1 text-sm font-semibold text-sky-900">{aiProviderName || 'Not configured'}</p>
            </div>
          </div>
        </div>
      </section>

      <StatsPanel />

      <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Search</span>
            <input
              type="text"
              placeholder="Search subject, body, or customer"
              value={filters.search || ''}
              onChange={(event) => updateFilters({ search: event.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)]"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Queue</span>
            <select
              value={filters.queue || ''}
              onChange={(event) => updateFilters({ queue: (event.target.value as QueueType) || undefined })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)]"
            >
              <option value="">All queues</option>
              <option value={Queue.URGENT}>Urgent Queue</option>
              <option value={Queue.BILLING}>Billing Queue</option>
              <option value={Queue.TECHNICAL}>Technical Queue</option>
              <option value={Queue.SALES}>Sales Channel</option>
              <option value={Queue.MISC}>Misc</option>
              <option value={Queue.CLOSED}>Closed Tickets</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Category</span>
            <select
              value={filters.tag || ''}
              onChange={(event) => updateFilters({ tag: (event.target.value as TagType) || undefined })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)]"
            >
              <option value="">All categories</option>
              <option value={Tag.BILLING}>Billing</option>
              <option value={Tag.TECHNICAL}>Technical</option>
              <option value={Tag.SALES}>Sales</option>
              <option value={Tag.MISC}>Misc</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Priority</span>
            <select
              value={filters.priority || ''}
              onChange={(event) => updateFilters({ priority: (event.target.value as PriorityType) || undefined })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)]"
            >
              <option value="">All priorities</option>
              <option value={Priority.HIGH}>High</option>
              <option value={Priority.URGENT}>Urgent</option>
              <option value={Priority.MEDIUM}>Medium</option>
              <option value={Priority.LOW}>Low</option>
            </select>
          </label>

          <div className="grid gap-1">
            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Status</label>
            <div className="flex gap-2">
              <select
                value={filters.status || ''}
                onChange={(event) => updateFilters({ status: (event.target.value as StatusType) || undefined })}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)]"
              >
                <option value="">All</option>
                <option value={Status.OPEN}>Open</option>
                <option value={Status.CLOSED}>Closed</option>
              </select>
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams())}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadTickets()}
            className="mt-2 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Queue</h4>
            <p className="text-xs text-slate-600">Workspace / Queues / Tickets</p>
          </div>
          <p className="text-xs font-medium text-slate-600">{pagination.total} tickets</p>
        </div>

        <div role="list" aria-label="Tickets in current queue" className="divide-y divide-slate-200">
          {loading &&
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse px-5 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-2/3 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
              </div>
            ))}

          {!loading && tickets.length === 0 && (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-semibold text-slate-900">No tickets found for this queue.</p>
              <p className="mt-2 text-sm text-slate-600">
                Adjust filters or clear search to view more customer conversations.
              </p>
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams())}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Clear filters
              </button>
            </div>
          )}

          {!loading &&
            tickets.map((ticket) => {
              const isUrgent =
                ticket.aiAnalysis?.aiPriority === Priority.URGENT || ticket.aiAnalysis?.aiPriority === Priority.HIGH;
              const aiUsage = getAiUsageSignal(ticket);
              const aiTagLabel = ticket.aiAnalysis?.aiTag ? `${ticket.aiAnalysis.aiTag.toLowerCase()} category` : 'no category';
              const priorityLabel = ticket.aiAnalysis?.aiPriority
                ? `${ticket.aiAnalysis.aiPriority.toLowerCase()} priority`
                : 'priority pending';
              const statusLabel = ticket.status.toLowerCase();

              return (
                <div key={ticket.id} role="listitem">
                  <button
                    type="button"
                    aria-label={`${ticket.subject}. ${statusLabel}. ${priorityLabel}. ${aiTagLabel}. Open ticket details.`}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className={`group w-full border-l-4 px-5 py-4 text-left transition ${
                      isUrgent
                        ? 'border-l-rose-400 bg-rose-50/60 hover:bg-rose-50'
                        : 'border-l-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-950">{ticket.subject}</p>
                          <Badge type="status" value={ticket.status} />
                          {ticket.aiAnalysis ? (
                            <>
                              <Badge type="tag" value={ticket.aiAnalysis.aiTag} />
                              <Badge type="priority" value={ticket.aiAnalysis.aiPriority} />
                              {aiUsage && (
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${aiUsageClasses(aiUsage.kind)}`}
                                >
                                  {aiUsage.label}
                                </span>
                              )}
                              {ticket.aiAnalysis.needsReview && (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                                  Needs Review
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                              Pending AI
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-slate-600">{snippet(ticket.body)}</p>
                        <p className="mt-2 text-xs text-slate-600">
                          {ticket.customerName} ({ticket.customerEmail})
                        </p>
                      </div>

                      <div className="shrink-0 text-right text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">{formatRelativeTime(ticket.createdAt)}</p>
                        <time dateTime={ticket.createdAt} className="mt-1 block text-[11px] text-slate-600">
                          {formatDateTime(ticket.createdAt)}
                        </time>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">#{ticket.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
        </div>

        {!loading && tickets.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateFilters({ page: pagination.page - 1 })}
                disabled={pagination.page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.pages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
