import type { Request } from 'express';
import { normalizePriority, normalizeTag } from './queueRouting';

const DEMO_SESSION_HEADER = 'x-demo-session-id';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_SESSION_ID_LENGTH = 80;

type DemoClosureInput = {
  ticketId: string;
  finalReply: string;
  acceptedAiSuggestion: boolean;
  aiTag: string;
  aiPriority: string;
  closedAt?: Date;
};

export type DemoTicketClosure = {
  ticketId: string;
  finalReply: string;
  acceptedAiSuggestion: boolean;
  aiTag: string;
  aiPriority: string;
  closedAt: Date;
};

type DemoSessionState = {
  lastSeenAt: number;
  closures: Map<string, DemoTicketClosure>;
};

const sessions = new Map<string, DemoSessionState>();

function sanitizeSessionId(raw: string | undefined | null): string | null {
  if (!raw) {
    return null;
  }

  const value = raw.trim();
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_SESSION_ID_LENGTH);
  return normalized.length > 0 ? normalized : null;
}

function fallbackSessionId(req: Request): string {
  const ipSource = (req.ip || 'anonymous').replace(/[^a-zA-Z0-9]/g, '');
  return `ip_${ipSource || 'anonymous'}`;
}

function touchSession(sessionId: string): DemoSessionState {
  const now = Date.now();
  const existing = sessions.get(sessionId);

  if (existing) {
    existing.lastSeenAt = now;
    return existing;
  }

  const created: DemoSessionState = {
    lastSeenAt: now,
    closures: new Map<string, DemoTicketClosure>(),
  };

  sessions.set(sessionId, created);
  return created;
}

function cleanupExpiredSessions(referenceTime: number) {
  for (const [sessionId, session] of sessions.entries()) {
    if (referenceTime - session.lastSeenAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

export function getDemoSessionId(req: Request): string {
  const headerValue = req.header(DEMO_SESSION_HEADER);
  const sessionId = sanitizeSessionId(headerValue) ?? fallbackSessionId(req);

  cleanupExpiredSessions(Date.now());
  touchSession(sessionId);

  return sessionId;
}

export function markDemoTicketClosed(sessionId: string, input: DemoClosureInput): DemoTicketClosure {
  const session = touchSession(sessionId);
  const closure: DemoTicketClosure = {
    ticketId: input.ticketId,
    finalReply: input.finalReply,
    acceptedAiSuggestion: input.acceptedAiSuggestion,
    aiTag: normalizeTag(input.aiTag),
    aiPriority: normalizePriority(input.aiPriority),
    closedAt: input.closedAt ?? new Date(),
  };

  session.closures.set(input.ticketId, closure);
  return closure;
}

export function getDemoTicketClosure(sessionId: string, ticketId: string): DemoTicketClosure | null {
  const session = touchSession(sessionId);
  return session.closures.get(ticketId) ?? null;
}

export function isDemoTicketClosed(sessionId: string, ticketId: string): boolean {
  return !!getDemoTicketClosure(sessionId, ticketId);
}

export function getClosedTicketIdsForSession(sessionId: string): Set<string> {
  const session = touchSession(sessionId);
  return new Set(session.closures.keys());
}
