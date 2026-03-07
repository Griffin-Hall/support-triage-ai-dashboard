import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, ticketsApi } from '../api/client';
import Badge from '../components/Badge';
import { useAISettings } from '../context/AISettingsContext';
import { Priority, Status, Tag, type PriorityType, type TagType, type Ticket } from '../types';

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

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useAISettings();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [finalReply, setFinalReply] = useState('');
  const [acceptedSuggestion, setAcceptedSuggestion] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagType>(Tag.GENERAL);
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
        setSelectedTag(data.aiAnalysis.aiTag);
        setSelectedPriority(data.aiAnalysis.aiPriority);
      } else {
        setFinalReply('');
        setAcceptedSuggestion(false);
        setSelectedTag(Tag.GENERAL);
        setSelectedPriority(Priority.MEDIUM);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalyzeOrRegenerate = async () => {
    if (!id || !ticket || ticket.status === Status.CLOSED) {
      return;
    }

    try {
      setAiLoading(true);
      setError(null);

      if (ticket.aiAnalysis) {
        await ticketsApi.regenerate(id);
      } else {
        await ticketsApi.analyze(id);
      }

      await loadTicket(id);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'AI_NOT_CONFIGURED' || err.code === 'AI_PROVIDER_KEY_MISSING') {
          setError('AI is not configured. Use the AI Engine button in the top bar to select a provider and add an API key.');
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate AI output');
      }
    } finally {
      setAiLoading(false);
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
          <Badge type="status" value={ticket.status} />
          <span className="text-xs font-mono text-slate-400">#{ticket.id.slice(0, 8)}</span>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {!aiConfigured && !hasAnalysis && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">AI not configured</p>
          <p className="mt-1">
            Configure an AI provider to auto-classify tickets and draft responses. Manual tagging and manual replies remain available.
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
          <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Original message</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{ticket.subject}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">{ticket.customerName}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{ticket.customerEmail}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Received {formatDate(ticket.createdAt)}</span>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {ticket.body}
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">AI analysis</p>
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
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value={Tag.BILLING}>Billing</option>
                  <option value={Tag.TECHNICAL}>Technical</option>
                  <option value={Tag.ACCOUNT}>Account</option>
                  <option value={Tag.URGENT}>Urgent</option>
                  <option value={Tag.GENERAL}>General</option>
                </select>
              </label>

              <label className="grid gap-1 text-sm text-slate-700">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Priority</span>
                <select
                  value={selectedPriority}
                  onChange={(event) => setSelectedPriority(event.target.value as PriorityType)}
                  disabled={isClosed}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value={Priority.HIGH}>High</option>
                  <option value={Priority.MEDIUM}>Medium</option>
                  <option value={Priority.LOW}>Low</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">AI Draft Reply</p>
              {!isClosed && (
                <button
                  type="button"
                  onClick={() => void triggerAnalyzeOrRegenerate()}
                  disabled={aiLoading || !aiConfigured}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {hasAnalysis ? 'Regenerate with AI' : 'Generate with AI'}
                </button>
              )}
            </div>

            {aiLoading ? (
              <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
              </div>
            ) : hasAnalysis && ticket.aiAnalysis?.aiSuggestedReply ? (
              <>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
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
              <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                {aiConfigured
                  ? 'No AI draft yet. Generate analysis to produce a suggested reply.'
                  : 'AI draft unavailable until a provider is configured. Continue with a manual reply below.'}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Final Reply</p>
              {!isClosed && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={acceptedSuggestion}
                    onChange={(event) => setAcceptedSuggestion(event.target.checked)}
                    className="rounded border-slate-300 text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                  />
                  Based on AI draft
                </label>
              )}
            </div>

            <textarea
              value={finalReply}
              onChange={(event) => setFinalReply(event.target.value)}
              disabled={isClosed}
              rows={8}
              placeholder="Write the response to the customer here..."
              className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:bg-slate-100"
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

        <aside className="space-y-4">
          <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ticket status</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge type="status" value={ticket.status} />
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span className="font-medium text-slate-900">{formatDate(ticket.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Updated</span>
                <span className="font-medium text-slate-900">{formatDate(ticket.updatedAt)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">AI actions</p>
            <p className="mt-2 text-sm text-slate-600">
              {hasAnalysis
                ? 'Re-run AI to refresh tags, priority, and draft based on the current ticket context.'
                : 'Generate AI analysis for category, urgency, and a suggested response.'}
            </p>
            <button
              type="button"
              onClick={() => void triggerAnalyzeOrRegenerate()}
              disabled={aiLoading || isClosed || !aiConfigured}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiLoading ? 'Generating...' : hasAnalysis ? 'Regenerate with AI' : 'Run AI Analysis'}
            </button>
            {!aiConfigured && (
              <button
                type="button"
                onClick={openAISettings}
                className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Configure AI Engine
              </button>
            )}
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Active AI engine</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{activeProviderInfo?.displayName || 'Not configured'}</p>
            <p className="mt-1 text-xs text-slate-500">
              The selected engine is used for both ticket classification and AI draft generation.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
