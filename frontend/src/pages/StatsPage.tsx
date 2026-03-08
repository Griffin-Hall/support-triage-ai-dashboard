import { useEffect, useMemo, useState } from 'react';
import { statsApi } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import type { Stats } from '../types';

type TrendDirection = 'up' | 'down' | 'flat';

interface TrendIndicator {
  direction: TrendDirection;
  deltaPercent: number;
  label: string;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function computeTrend(current: number, previous: number): TrendIndicator {
  if (current === previous) {
    return {
      direction: 'flat',
      deltaPercent: 0,
      label: 'No change',
    };
  }

  if (previous <= 0) {
    return {
      direction: current > 0 ? 'up' : 'flat',
      deltaPercent: current > 0 ? 100 : 0,
      label: current > 0 ? 'Up from 0' : 'No change',
    };
  }

  const delta = current - previous;
  const deltaPercent = Math.round((Math.abs(delta) / previous) * 100);

  return {
    direction: delta > 0 ? 'up' : 'down',
    deltaPercent,
    label: `${delta > 0 ? '+' : '-'}${deltaPercent}%`,
  };
}

function trendClasses(direction: TrendDirection): string {
  if (direction === 'up') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (direction === 'down') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-slate-100 text-slate-600';
}

function trendArrow(direction: TrendDirection): string {
  if (direction === 'up') {
    return '^';
  }

  if (direction === 'down') {
    return 'v';
  }

  return '-';
}

function DailyTicketsChart({
  points,
  theme,
}: {
  points: Stats['dailyTickets'];
  theme: 'light' | 'dark';
}) {
  const width = 980;
  const height = 310;
  const margin = { top: 16, right: 16, bottom: 44, left: 44 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const palette =
    theme === 'dark'
      ? {
          grid: '#334155',
          axis: '#94a3b8',
          created: '#38bdf8',
          closed: '#34d399',
        }
      : {
          grid: '#e2e8f0',
          axis: '#64748b',
          created: '#0ea5e9',
          closed: '#10b981',
        };

  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.created, point.closed)));
  const step = points.length > 0 ? innerWidth / points.length : innerWidth;
  const barWidth = Math.min(14, Math.max(5, step * 0.45));

  const yAt = (value: number): number => {
    return margin.top + innerHeight - (value / maxValue) * innerHeight;
  };

  const xAt = (index: number): number => {
    return margin.left + index * step + step / 2;
  };

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    return Math.round((maxValue / 4) * index);
  }).reverse();

  const labelInterval = Math.max(1, Math.ceil(points.length / 10));
  const closedPath = points
    .map((point, index) => {
      const x = xAt(index);
      const y = yAt(point.closed);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-sky-500" />
          Tickets Created
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
          Tickets Closed
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[780px]">
        {yTicks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke={palette.grid} strokeWidth="1" />
              <text x={margin.left - 8} y={y + 4} fontSize="10" textAnchor="end" fill={palette.axis}>
                {tick}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
          const x = xAt(index);
          const createdY = yAt(point.created);
          const barHeight = margin.top + innerHeight - createdY;
          const showLabel = index % labelInterval === 0 || index === points.length - 1;

          return (
            <g key={point.date}>
              <rect x={x - barWidth / 2} y={createdY} width={barWidth} height={barHeight} rx={2} fill={palette.created} fillOpacity="0.75" />
              {showLabel && (
                <text x={x} y={height - 16} fontSize="10" textAnchor="middle" fill={palette.axis}>
                  {point.label}
                </text>
              )}
            </g>
          );
        })}

        {points.length > 1 && (
          <path d={closedPath} fill="none" stroke={palette.closed} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map((point, index) => {
          const x = xAt(index);
          const y = yAt(point.closed);

          return <circle key={`${point.date}-closed`} cx={x} cy={y} r="2.5" fill={palette.closed} />;
        })}
      </svg>
    </div>
  );
}

export default function StatsPage() {
  const { theme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const next = await statsApi.getAll();
      setStats(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const derived = useMemo(() => {
    if (!stats) {
      return null;
    }

    const recentClosed = stats.dailyTickets.slice(-7).reduce((sum, point) => sum + point.closed, 0);
    const previousClosed = stats.dailyTickets.slice(-14, -7).reduce((sum, point) => sum + point.closed, 0);

    const aiLast7 = stats.kpis.aiDraftsCreated.last7Days;
    const priorAiWindowTotal = Math.max(stats.kpis.aiDraftsCreated.last30Days - aiLast7, 0);
    const priorAiWeeklyBaseline = Math.round((priorAiWindowTotal / 23) * 7);

    return {
      closedTrend: computeTrend(recentClosed, previousClosed),
      aiDraftTrend: computeTrend(aiLast7, priorAiWeeklyBaseline),
    };
  }, [stats]);

  if (loading) {
    return (
      <div className="grid gap-4 pb-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white/80" />
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <p>{error || 'Failed to load stats.'}</p>
        <button
          type="button"
          onClick={() => void loadStats()}
          className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">KPI Snapshot</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900">Operational performance</h3>
            <p className="mt-2 text-sm text-slate-600">
              Track closure throughput, AI-draft usage, and daily intake trends.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStats()}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Tickets Closed</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(stats.kpis.ticketsClosed.total)}</p>
          <p className="mt-2 text-xs text-slate-600">
            7d: {formatNumber(stats.kpis.ticketsClosed.last7Days)} | 30d: {formatNumber(stats.kpis.ticketsClosed.last30Days)}
          </p>
          {derived && (
            <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${trendClasses(derived.closedTrend.direction)}`}>
              {trendArrow(derived.closedTrend.direction)} {derived.closedTrend.label} vs previous 7d
            </span>
          )}
        </article>

        <article className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">AI Drafts Created</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(stats.kpis.aiDraftsCreated.total)}</p>
          <p className="mt-2 text-xs text-slate-600">
            7d: {formatNumber(stats.kpis.aiDraftsCreated.last7Days)} | 30d: {formatNumber(stats.kpis.aiDraftsCreated.last30Days)}
          </p>
          {derived && (
            <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${trendClasses(derived.aiDraftTrend.direction)}`}>
              {trendArrow(derived.aiDraftTrend.direction)} {derived.aiDraftTrend.label} vs baseline week
            </span>
          )}
        </article>

        <article className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Open Tickets</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(stats.overview.openTickets)}</p>
          <p className="mt-2 text-xs text-slate-600">Current workload in active queues.</p>
        </article>

        <article className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">AI Acceptance Rate</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.aiPerformance.acceptanceRate}%</p>
          <p className="mt-2 text-xs text-slate-600">
            Accepted: {formatNumber(stats.aiPerformance.acceptedAnalyses)} / Decided:{' '}
            {formatNumber(stats.aiPerformance.decidedAnalyses)}
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Daily Tickets ({stats.dailyTicketsMeta.windowDays} days)</h4>
            <p className="mt-1 text-xs text-slate-600">Created vs closed ticket volume by day.</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              stats.dailyTicketsMeta.mode === 'simulated'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {stats.dailyTicketsMeta.mode === 'simulated'
              ? `Demo synthetic trend (~${stats.dailyTicketsMeta.simulatedRange?.createdAverage}/day created, ~${stats.dailyTicketsMeta.simulatedRange?.closedAverage}/day closed)`
              : 'Production data'}
          </span>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <DailyTicketsChart points={stats.dailyTickets} theme={theme} />
        </div>
      </section>
    </div>
  );
}
