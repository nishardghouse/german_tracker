import type {
  ConversationFeedback,
  ConversationFeedbackRequest,
  ConversationReplyRequest,
  GradeRequest,
  GradeResult,
} from "./types";
import type { Attempt, Card, ErrorPattern } from "./store";

// In dev, Vite proxies /api/* → http://localhost:8000 (see vite.config.ts).
const BASE = "/api";

const TOKEN_KEY = "sprachheld_token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function postJSON<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }
  return res.json() as Promise<T>;
}

/** For 204 / no-content mutation endpoints. */
async function send(path: string, method: "POST" | "PUT", body: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }
}

// ── LLM endpoints ──────────────────────────────────────────────────────────

export function gradeTranslation(req: GradeRequest, signal?: AbortSignal): Promise<GradeResult> {
  return postJSON<GradeResult>("/grade", req, signal);
}

/** Stream the German reply, calling onDelta with each chunk. Resolves with the full text. */
export async function conversationReplyStream(
  req: ConversationReplyRequest,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${BASE}/conversation/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onDelta(chunk);
  }
  return full;
}

export function conversationFeedback(
  req: ConversationFeedbackRequest,
  signal?: AbortSignal,
): Promise<ConversationFeedback> {
  return postJSON<ConversationFeedback>("/conversation/feedback", req, signal);
}

// ── Persistence endpoints ────────────────────────────────────────────────────
// Wire shapes match the store types; fsrs Dates serialize to ISO strings and are
// revived on load by the store.

export interface StateDTO {
  cards: Card[];
  attempts: Attempt[];
  error_patterns: ErrorPattern[];
}

export function fetchState(): Promise<StateDTO> {
  return fetch(`${BASE}/state`, { headers: authHeaders() }).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<StateDTO>;
  });
}

export function createCard(card: Card): Promise<void> {
  return send("/cards", "POST", card);
}

export function updateCard(card: Card): Promise<void> {
  return send(`/cards/${encodeURIComponent(card.id)}`, "PUT", card);
}

export function createCards(cards: Card[]): Promise<void> {
  return send("/cards/bulk", "POST", cards);
}

export function createAttempt(attempt: Attempt): Promise<void> {
  return send("/attempts", "POST", attempt);
}

export function putErrorPattern(pattern: ErrorPattern): Promise<void> {
  return send(`/error-patterns/${encodeURIComponent(pattern.category)}`, "PUT", pattern);
}

export function translateSentence(text: string): Promise<{ translation: string }> {
  return postJSON("/translate", { text });
}
