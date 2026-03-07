import { Status, type Ticket } from '../types';

export type AiUsageKind = 'assisted' | 'accepted' | 'edited' | 'ignored' | 'manual';

export interface AiUsageSignal {
  kind: AiUsageKind;
  label: string;
}

export function formatRelativeTime(dateStr: string): string {
  const target = new Date(dateStr).getTime();
  const now = Date.now();

  const diffMs = Math.max(0, now - target);
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function getAiUsageSignal(ticket: Ticket): AiUsageSignal | null {
  const analysis = ticket.aiAnalysis;
  if (!analysis) {
    return null;
  }

  if ((analysis.aiProvider || '').toUpperCase() === 'MANUAL') {
    return {
      kind: 'manual',
      label: 'Manual Reply',
    };
  }

  if (ticket.status === Status.CLOSED) {
    if (analysis.acceptedByAgent === true) {
      return {
        kind: 'accepted',
        label: 'AI Accepted',
      };
    }

    if (analysis.acceptedByAgent === false) {
      const finalReply = (analysis.finalReply || '').trim();
      const draftReply = (analysis.aiSuggestedReply || '').trim();

      if (finalReply.length > 0 && draftReply.length > 0 && finalReply !== draftReply) {
        return {
          kind: 'edited',
          label: 'AI Edited',
        };
      }

      return {
        kind: 'ignored',
        label: 'AI Ignored',
      };
    }
  }

  return {
    kind: 'assisted',
    label: 'AI Assisted',
  };
}

export function aiUsageClasses(kind: AiUsageKind): string {
  if (kind === 'accepted') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (kind === 'edited') {
    return 'bg-sky-100 text-sky-700';
  }

  if (kind === 'ignored') {
    return 'bg-slate-200 text-slate-700';
  }

  if (kind === 'manual') {
    return 'bg-teal-100 text-teal-700';
  }

  return 'bg-blue-100 text-blue-700';
}
