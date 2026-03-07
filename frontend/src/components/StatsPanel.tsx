import { useEffect, useState } from 'react';
import { statsApi } from '../api/client';
import type { Stats } from '../types';

const accentByMetric: Record<string, string> = {
  total: 'from-slate-900 to-slate-700',
  open: 'from-sky-700 to-sky-500',
  analyzed: 'from-emerald-700 to-emerald-500',
  pending: 'from-amber-700 to-amber-500',
};

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await statsApi.getAll();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white/80" />
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        <p>{error || 'Failed to load statistics.'}</p>
        <button
          type="button"
          onClick={() => void loadStats()}
          className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          Retry
        </button>
      </div>
    );
  }

  const metrics = [
    { key: 'total', label: 'Total Tickets', value: stats.overview.totalTickets },
    { key: 'open', label: 'Open Queue', value: stats.overview.openTickets },
    { key: 'analyzed', label: 'AI Analyzed', value: stats.overview.ticketsWithAnalysis },
    { key: 'pending', label: 'Awaiting AI', value: stats.overview.pendingAnalysis },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.key} className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</div>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-3xl font-bold text-slate-900">{metric.value}</p>
              <span className={`h-2 w-16 rounded-full bg-gradient-to-r ${accentByMetric[metric.key]}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
          <h3 className="text-sm font-semibold text-slate-900">Category Mix</h3>
          <div className="mt-3 space-y-2">
            {stats.tags.length === 0 && <p className="text-xs text-slate-500">No analyzed tickets yet.</p>}
            {stats.tags.map((entry) => (
              <div key={entry.tag} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-600">{entry.tag}</span>
                <span className="text-sm font-semibold text-slate-900">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
          <h3 className="text-sm font-semibold text-slate-900">Priority Distribution</h3>
          <div className="mt-3 space-y-2">
            {stats.priorities.length === 0 && <p className="text-xs text-slate-500">No analyzed tickets yet.</p>}
            {stats.priorities.map((entry) => (
              <div key={entry.priority} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-600">{entry.priority}</span>
                <span className="text-sm font-semibold text-slate-900">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
          <h3 className="text-sm font-semibold text-slate-900">AI Suggestion Quality</h3>
          <p className="mt-1 text-xs text-slate-500">How often agents accept suggested drafts.</p>

          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Acceptance rate</span>
              <span className="font-semibold text-slate-900">{stats.aiPerformance.acceptanceRate}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${stats.aiPerformance.acceptanceRate}%` }}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
              Accepted: <span className="font-semibold">{stats.aiPerformance.acceptedAnalyses}</span>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
              Decided: <span className="font-semibold">{stats.aiPerformance.decidedAnalyses}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
