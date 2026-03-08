import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ticketsApi } from '../api/client';
import Badge from '../components/Badge';
import { useAISettings } from '../context/AISettingsContext';
import { Priority, Status, Tag, type PriorityType, type TagType, type Ticket } from '../types';
import { aiUsageClasses, formatRelativeTime, getAiUsageSignal } from '../utils/ticketPresentation';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function prettifyProvider(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  if (value === 'MANUAL') {
    return 'Manual Agent';
  }

  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeTag(value: string | null | undefined): TagType {
  if (!value) {
    return Tag.MISC;
  }

  const normalized = value.toUpperCase();

  if (normalized === 'GENERAL' || normalized === 'ACCOUNT' || normalized === 'URGENT') {
    return Tag.MISC;
  }

  return [Tag.BILLING, Tag.TECHNICAL, Tag.SALES, Tag.MISC].includes(normalized as TagType)
    ? (normalized as TagType)
    : Tag.MISC;
}

function normalizePriority(value: string | null | undefined): PriorityType {
  if (!value) {
    return Priority.MEDIUM;
  }

  const normalized = value.toUpperCase();
  if (normalized === 'CRITICAL') {
    return Priority.URGENT;
  }

  return [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT].includes(normalized as PriorityType)
    ? (normalized as PriorityType)
    : Priority.MEDIUM;
}

function emitTicketsUpdated() {
  window.dispatchEvent(new Event('tickets-updated'));
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useAISettings();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [finalReply, setFinalReply] = useState('');
  const [acceptedSuggestion, setAcceptedSuggestion] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagType>(Tag.MISC);
  const [selectedPriority, setSelectedPriority] = useState<PriorityType>(Priority.MEDIUM);

  const activeProviderInfo = settings?.activeProvider
    ? settings.providers.find((provider) => provider.provider === settings.activeProvider)
    : null;
  const aiConfigured = !!(settings?.activeProvider && activeProviderInfo?.configured);

  useEffect(() => {
    if (id) {
      void loadTicket(id);
    }
  }, [id]);

  const loadTicket = async (ticketId: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await ticketsApi.getById(ticketId);
      setTicket(data);

      if (data.aiAnalysis) {
        setFinalReply(data.aiAnalysis.finalReply || data.aiAnalysis.aiSuggestedReply || '');
        setAcceptedSuggestion(data.aiAnalysis.acceptedByAgent || false);
        setSelectedTag(normalizeTag(data.aiAnalysis.aiTag));
        setSelectedPriority(normalizePriority(data.aiAnalysis.aiPriority));
      } else {
        setFinalReply('');
        setAcceptedSuggestion(false);
        setSelectedTag(Tag.MISC);
        setSelectedPriority(Priority.MEDIUM);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!id || !finalReply.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await ticketsApi.reply(id, {
        finalReply: finalReply.trim(),
        acceptedAiSuggestion: acceptedSuggestion,
        aiTag: selectedTag,
        aiPriority: selectedPriority,
      });

      await loadTicket(id);
      emitTicketsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const openAISettings = () => {
    window.dispatchEvent(new Event('open-ai-settings'));
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-sm backdrop-blur">
        <p className="animate-pulse text-sm text-slate-500">Loading ticket workspace...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
        <p className="text-sm text-rose-700">Ticket not found.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const isClosed = ticket.status === Status.CLOSED;
  const hasAnalysis = !!ticket.aiAnalysis;
  const aiUsage = getAiUsageSignal(ticket);
  const hasDraftInProgress = !isClosed && finalReply.trim().length > 0;
  const queueLabel = ticket.queue || ticket.aiAnalysis?.queue || null;

  const providerLabel =
    ticket.aiAnalysis?.aiProvider && ticket.aiAnalysis.aiProvider !== 'MANUAL'
      ? settings?.providers.find((provider) => provider.provider === ticket.aiAnalysis?.aiProvider)?.displayName ||
        prettifyProvider(ticket.aiAnalysis.aiProvider)
      : prettifyProvider(ticket.aiAnalysis?.aiProvider);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to queue
        </button>
        <div className="flex items-center gap-2">
          {aiUsage && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${aiUsageClasses(aiUsage.kind)}`}>
              {aiUsage.label}
            </span>
          )}
          {hasDraftInProgress && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
              Draft
            </span>
          )}
          <Badge type="status" value={ticket.status} />
          <span className="text-xs font-mono text-slate-400">#{ticket.id.slice(0, 8)}</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!aiConfigured && !hasAnalysis && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">AI provider not configured</p>
          <p className="mt-1">
            Configure an AI provider to enable draft generation and classification controls for this ticket.
          </p>
          <button
            type="button"
            onClick={openAISettings}
            className="mt-3 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-amber-100"
          >
            Open AI Engine settings
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <section
            aria-labelledby="ticket-original-message-heading"
            className="original-message-card rounded-3xl p-5 shadow-sm backdrop-blur"
          >
            <div className="flex items-center gap-2">
              <h2
                id="ticket-original-message-heading"
                className="original-message-label text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Original message
              </h2>
              <span className="original-message-meta-chip rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Customer Message
              </span>
            </div>
            <h1 className="original-message-heading mt-2 text-2xl font-bold">{ticket.subject}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="original-message-meta-chip rounded-full px-3 py-1">{ticket.customerName}</span>
              <span className="original-message-meta-chip rounded-full px-3 py-1">{ticket.customerEmail}</span>
              <span className="original-message-meta-chip rounded-full px-3 py-1">Received {formatRelativeTime(ticket.createdAt)}</span>
              <time dateTime={ticket.createdAt} className="original-message-meta-chip rounded-full px-3 py-1">
                {formatDate(ticket.createdAt)}
              </time>
            </div>
            <div className="original-message-body mt-4 rounded-2xl p-4 text-sm leading-6">
              {ticket.body}
            </div>
          </section>

          <section aria-labelledby="ticket-ai-analysis-heading" className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="ticket-ai-analysis-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                  AI analysis
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  AI suggested these tags and drafted this reply; you can edit everything before sending.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Powered by: {hasAnalysis ? providerLabel : activeProviderInfo?.displayName || 'Not configured'}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-slate-700">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Category</span>
                <select
                  value={selectedTag}
                  onChange={(event) => setSelectedTag(event.target.value as TagType)}
                  disabled={isClosed}
                  className="app-field rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value={Tag.BILLING}>Billing</option>
                  <option value={Tag.TECHNICAL}>Technical</option>
                  <option value={Tag.SALES}>Sales</option>
                  <option value={Tag.MISC}>Misc</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm text-slate-700">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Priority</span>
                <select
                  value={selectedPriority}
                  onChange={(event) => setSelectedPriority(event.target.value as PriorityType)}
                  disabled={isClosed}
                  className="app-field rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value={Priority.URGENT}>Urgent</option>
                  <option value={Priority.HIGH}>High</option>
                  <option value={Priority.MEDIUM}>Medium</option>
                  <option value={Priority.LOW}>Low</option>
                </select>
              </label>
            </div>
            {ticket.aiAnalysis?.needsReview && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
                Needs review
              </div>
            )}
          </section>

          <section aria-labelledby="ticket-ai-draft-heading" className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="ticket-ai-draft-heading" className="text-sm font-semibold text-slate-900">
                AI Draft Reply
              </h2>
            </div>

            {hasAnalysis && ticket.aiAnalysis?.aiSuggestedReply ? (
              <>
                <div className="app-readonly-surface mt-3 rounded-2xl border border-slate-200 p-4 text-sm leading-6">
                  {ticket.aiAnalysis.aiSuggestedReply}
                </div>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => {
                      setFinalReply(ticket.aiAnalysis?.aiSuggestedReply || '');
                      setAcceptedSuggestion(true);
                    }}
                    className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Apply draft as reply
                  </button>
                )}
              </>
            ) : (
              <div className="app-readonly-surface mt-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                {aiConfigured
                  ? 'No AI draft available for this ticket yet.'
                  : 'No provider configured for AI draft generation.'}
              </div>
            )}
          </section>

          <section aria-labelledby="ticket-final-reply-heading" className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 id="ticket-final-reply-heading" className="text-sm font-semibold text-slate-900">
                Final Reply
              </h2>
              {!isClosed && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={acceptedSuggestion}
                    onChange={(event) => setAcceptedSuggestion(event.target.checked)}
                    className="app-checkbox h-4 w-4 rounded border-slate-300"
                  />
                  Based on AI draft
                </label>
              )}
            </div>

            <textarea
              id="ticket-final-reply-input"
              aria-label="Final reply to customer"
              value={finalReply}
              onChange={(event) => setFinalReply(event.target.value)}
              disabled={isClosed}
              rows={8}
              placeholder="Write the response to the customer here..."
              className="app-field mt-3 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            {!isClosed ? (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">Tag, priority, and final response are saved when you send.</p>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={submitting || !finalReply.trim()}
                  className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs font-semibold text-emerald-700">Ticket is closed. Reply was already sent.</p>
            )}
          </section>
        </div>

        <aside aria-label="Ticket metadata and actions" className="space-y-4">
          <section aria-labelledby="ticket-status-heading" className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
            <h2 id="ticket-status-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
              Ticket status
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {queueLabel && (
                <div className="flex items-center justify-between">
                  <span>Queue</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {queueLabel}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge type="status" value={ticket.status} />
              </div>
              {aiUsage && (
                <div className="flex items-center justify-between">
                  <span>AI usage</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${aiUsageClasses(aiUsage.kind)}`}>
                    {aiUsage.label}
                  </span>
                </div>
              )}
              {ticket.aiAnalysis?.needsReview && (
                <div className="flex items-center justify-between">
                  <span>Classification</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                    Needs Review
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Created</span>
                <time dateTime={ticket.createdAt} className="text-right">
                  <span className="block font-semibold text-slate-900">{formatRelativeTime(ticket.createdAt)}</span>
                  <span className="block text-[11px] text-slate-600">{formatDate(ticket.createdAt)}</span>
                </time>
              </div>
              <div className="flex items-center justify-between">
                <span>Updated</span>
                <time dateTime={ticket.updatedAt} className="text-right">
                  <span className="block font-semibold text-slate-900">{formatRelativeTime(ticket.updatedAt)}</span>
                  <span className="block text-[11px] text-slate-600">{formatDate(ticket.updatedAt)}</span>
                </time>
              </div>
            </div>
          </section>

          <section aria-labelledby="ticket-active-engine-heading" className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
            <h2 id="ticket-active-engine-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
              Active AI engine
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-900">{activeProviderInfo?.displayName || 'Not configured'}</p>
            <p className="mt-1 text-xs text-slate-600">
              The selected engine is used for both ticket classification and AI draft generation.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
