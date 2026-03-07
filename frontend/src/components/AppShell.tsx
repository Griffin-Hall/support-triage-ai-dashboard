import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import AISettingsModal from './AISettingsModal';
import { useAISettings } from '../context/AISettingsContext';
import { statsApi } from '../api/client';
import { Queue, type QueueType } from '../types';

function navLinkClasses(active: boolean): string {
  return `flex items-center rounded-xl px-3 py-2 text-sm font-medium transition ${
    active
      ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]'
      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
  }`;
}

function matchesQueue(search: string, expected: Record<string, string>): boolean {
  const params = new URLSearchParams(search);

  return Object.entries(expected).every(([key, value]) => params.get(key) === value);
}

export default function AppShell() {
  const location = useLocation();
  const { settings } = useAISettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLElement | null>(null);
  const [queueCounts, setQueueCounts] = useState<Record<QueueType, number>>({
    [Queue.URGENT]: 0,
    [Queue.BILLING]: 0,
    [Queue.TECHNICAL]: 0,
    [Queue.SALES]: 0,
    [Queue.MISC]: 0,
  });

  const openSettingsModal = useCallback(() => {
    const activeElement = document.activeElement;
    settingsTriggerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    setSettingsOpen(true);
  }, []);

  const closeSettingsModal = useCallback(() => {
    setSettingsOpen(false);

    window.requestAnimationFrame(() => {
      settingsTriggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const handleOpenSettings = () => openSettingsModal();
    window.addEventListener('open-ai-settings', handleOpenSettings);

    return () => {
      window.removeEventListener('open-ai-settings', handleOpenSettings);
    };
  }, [openSettingsModal]);

  const loadQueueCounts = useCallback(async () => {
    try {
      const stats = await statsApi.getAll();
      setQueueCounts(stats.queues);
    } catch (error) {
      // Keep the previous counts when stats refresh fails.
    }
  }, []);

  useEffect(() => {
    void loadQueueCounts();

    const interval = window.setInterval(() => {
      void loadQueueCounts();
    }, 10000);

    const handleTicketsUpdated = () => {
      void loadQueueCounts();
    };

    window.addEventListener('tickets-updated', handleTicketsUpdated);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('tickets-updated', handleTicketsUpdated);
    };
  }, [loadQueueCounts]);

  const providerMap = useMemo(() => {
    return new Map(settings?.providers.map((provider) => [provider.provider, provider]));
  }, [settings]);

  const activeProviderInfo = settings?.activeProvider ? providerMap.get(settings.activeProvider) : null;
  const aiConfigured = !!(settings?.activeProvider && activeProviderInfo?.configured);

  const isTicketWorkspace = location.pathname.startsWith('/tickets/');
  const isStatsPage = location.pathname === '/stats';

  const pageHeading = isTicketWorkspace ? 'Ticket Workspace' : isStatsPage ? 'KPI & Stats' : 'Triage Dashboard';
  const pageSubheading = isTicketWorkspace
    ? 'Review customer context, AI analysis, and finalize a response.'
    : isStatsPage
      ? 'Track closure throughput, AI draft usage, and daily intake trends.'
      : 'Smart inbox for support teams that triage and respond faster with AI assistance.';

  return (
    <div className="min-h-screen bg-app-surface">
      <a
        href="#main-content"
        className="sr-only absolute left-4 top-4 z-[60] rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white focus:not-sr-only"
      >
        Skip to main content
      </a>
      <div className="pointer-events-none fixed inset-0 bg-app-gradient" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen max-w-[1520px] gap-6 px-4 py-5 md:px-6">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-white/60 bg-white/85 p-5 shadow-lg backdrop-blur lg:block">
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Workspace</p>
            <h1 className="mt-2 text-lg font-bold">Support Triage Cloud</h1>
            <p className="mt-1 text-xs text-slate-300">AI-assisted inbox for revenue-critical support operations.</p>
          </div>

          <nav className="mt-6 space-y-5">
            <div>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Navigation</p>
              <ul className="space-y-1">
                <li>
                  <NavLink to="/" end className={({ isActive }) => navLinkClasses(isActive)}>
                    Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/stats" className={({ isActive }) => navLinkClasses(isActive)}>
                    Stats
                  </NavLink>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Queues</p>
              <ul className="space-y-1">
                <li>
                  <Link
                    className={`${navLinkClasses(matchesQueue(location.search, { queue: Queue.URGENT, status: 'OPEN' }))} justify-between`}
                    to={`/?queue=${Queue.URGENT}&status=OPEN`}
                  >
                    <span>Urgent Queue</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {queueCounts[Queue.URGENT]}
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    className={`${navLinkClasses(matchesQueue(location.search, { queue: Queue.BILLING, status: 'OPEN' }))} justify-between`}
                    to={`/?queue=${Queue.BILLING}&status=OPEN`}
                  >
                    <span>Billing Queue</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {queueCounts[Queue.BILLING]}
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    className={`${navLinkClasses(matchesQueue(location.search, { queue: Queue.TECHNICAL, status: 'OPEN' }))} justify-between`}
                    to={`/?queue=${Queue.TECHNICAL}&status=OPEN`}
                  >
                    <span>Technical Queue</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {queueCounts[Queue.TECHNICAL]}
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    className={`${navLinkClasses(matchesQueue(location.search, { queue: Queue.SALES, status: 'OPEN' }))} justify-between`}
                    to={`/?queue=${Queue.SALES}&status=OPEN`}
                  >
                    <span>Sales Channel</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {queueCounts[Queue.SALES]}
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    className={`${navLinkClasses(matchesQueue(location.search, { queue: Queue.MISC, status: 'OPEN' }))} justify-between`}
                    to={`/?queue=${Queue.MISC}&status=OPEN`}
                  >
                    <span>Misc</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {queueCounts[Queue.MISC]}
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">How it works</p>
            <p className="mt-1">
              AI classifies incoming tickets, suggests urgency, and drafts a reply. Agents review, edit, and send.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-3xl border border-white/60 bg-white/90 px-5 py-4 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Support Workspace</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">{pageHeading}</h2>
                <p className="mt-1 text-sm text-slate-600">{pageSubheading}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    aiConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {aiConfigured
                    ? `AI: ${activeProviderInfo?.displayName ?? settings?.activeProvider}`
                    : 'AI not configured'}
                </span>
                <button
                  type="button"
                  onClick={openSettingsModal}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                >
                  AI Engine
                </button>
              </div>
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>

      <AISettingsModal open={settingsOpen} onClose={closeSettingsModal} />
    </div>
  );
}
