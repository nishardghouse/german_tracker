/**
 * Unified store — the "things I struggle with" store from the design. Cards are the
 * spaced-repetition unit (scheduled with FSRS); Attempts are an append-only log;
 * ErrorPatterns aggregate recurring grammar mistakes for the dashboard.
 *
 * Persistence lives in the backend (SQLite). This module keeps an in-memory cache
 * hydrated once via `initStore()`, so reads stay synchronous for the UI; mutations
 * update the cache and persist to the backend in the background.
 */

import { createEmptyCard, fsrs, Rating, type Card as FsrsCard } from "ts-fsrs";

import * as api from "./api";
import { SEED_SENTENCES } from "./seed";
import type { DrillSuggestion, ErrorCategory, ErrorInstance, Grade } from "./types";

const scheduler = fsrs();

export type CardType = "vocab" | "sentence";
export type CardSource = "manual" | "conversation" | "generated" | "seed" | "inbox";

export interface Card {
  id: string;
  type: CardType;
  source: CardSource;
  prompt_en: string;
  target_de: string | null;
  acceptable_de: string[];
  context_note?: string;
  tags: string[];
  createdAt: string;
  archived: boolean;
  fsrs: FsrsCard;
}

export interface Attempt {
  id: string;
  cardId: string;
  timestamp: string;
  mode: "translation" | "conversation";
  spoken_de: string;
  grade: Grade;
  errorCount: number;
}

export interface ErrorPattern {
  category: ErrorCategory;
  count: number;
  lastSeen: string;
  examples: { span_de: string; correction: string }[];
}

interface StoreData {
  cards: Card[];
  attempts: Attempt[];
  errorPatterns: Record<string, ErrorPattern>;
}

let cache: StoreData = { cards: [], attempts: [], errorPatterns: {} };
let ready = false;

// ── helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Revive a stored fsrs blob into a real ts-fsrs Card. Cards inserted server-side (e.g.
 * sheet imports) may carry a minimal shape, so we merge over a fresh empty card to
 * guarantee every field the scheduler needs is present, then fix up the Date fields.
 */
function normalizeFsrs(stored: FsrsCard): FsrsCard {
  const base = createEmptyCard(new Date());
  const merged = { ...base, ...stored } as FsrsCard;
  merged.due = new Date(stored.due ?? base.due);
  merged.last_review = stored.last_review ? new Date(stored.last_review) : undefined;
  return merged;
}

function normPrompt(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Fire-and-forget persistence — surface failures in the console without blocking the UI. */
function persist(p: Promise<unknown>): void {
  p.catch((e) => console.error("[store] persist failed:", e));
}

function buildSeedCards(): Card[] {
  const now = new Date();
  return SEED_SENTENCES.map((s) => ({
    id: uid(),
    type: "sentence" as const,
    source: "seed" as const,
    prompt_en: s.prompt_en,
    target_de: s.target_de,
    acceptable_de: s.acceptable_de,
    context_note: s.context_note,
    tags: s.tags,
    createdAt: now.toISOString(),
    archived: false,
    fsrs: createEmptyCard(now),
  }));
}

// ── init ───────────────────────────────────────────────────────────────────

async function hydrate(): Promise<void> {
  const state = await api.fetchState();
  cache = {
    cards: state.cards.map((c) => ({ ...c, fsrs: normalizeFsrs(c.fsrs) })),
    attempts: state.attempts,
    errorPatterns: Object.fromEntries(state.error_patterns.map((p) => [p.category, p])),
  };
}

export async function initStore(): Promise<void> {
  if (ready) return;
  await hydrate();

  if (cache.cards.length === 0) {
    const seeds = buildSeedCards();
    cache.cards = seeds;
    await api.createCards(seeds);
  }
  ready = true;
}

// ── reads (synchronous, off the cache) ───────────────────────────────────────

export function getCards(): Card[] {
  return cache.cards.filter((c) => !c.archived);
}

/** The next card to drill: the most-overdue, else the soonest-due. */
export function getDueCard(excludeId?: string): Card | null {
  const cards = getCards().filter((c) => c.id !== excludeId);
  if (cards.length === 0) return null;
  const now = Date.now();
  const due = cards
    .filter((c) => c.fsrs.due.getTime() <= now)
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());
  if (due.length > 0) return due[0];
  return cards.sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())[0];
}

export function getTopErrorPatterns(limit = 3): ErrorPattern[] {
  return Object.values(cache.errorPatterns)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface Stats {
  totalCards: number;
  dueCount: number;
  attempts: number;
}

export function getStats(): Stats {
  const now = Date.now();
  const active = cache.cards.filter((c) => !c.archived);
  return {
    totalCards: active.length,
    dueCount: active.filter((c) => c.fsrs.due.getTime() <= now).length,
    attempts: cache.attempts.length,
  };
}

// ── mutations (update cache + persist) ───────────────────────────────────────

export function addManualCard(input: {
  prompt_en: string;
  target_de?: string | null;
  acceptable_de?: string[];
  context_note?: string;
}): Card {
  const now = new Date();
  const card: Card = {
    id: uid(),
    type: "sentence",
    source: "manual",
    prompt_en: input.prompt_en.trim(),
    target_de: input.target_de?.trim() || null,
    acceptable_de: input.acceptable_de ?? [],
    context_note: input.context_note,
    tags: [],
    createdAt: now.toISOString(),
    archived: false,
    fsrs: createEmptyCard(now),
  };
  cache.cards.push(card);
  persist(api.createCard(card));
  return card;
}

/**
 * Closes the conversation→drills loop: turn drill suggestions into spaced-repetition
 * cards, skipping any whose English prompt already exists. Returns how many were added.
 */
export function addConversationCards(drills: DrillSuggestion[]): number {
  if (drills.length === 0) return 0;
  const existing = new Set(cache.cards.map((c) => normPrompt(c.prompt_en)));
  const now = new Date();
  const added: Card[] = [];

  for (const d of drills) {
    const prompt = d.prompt_en.trim();
    if (!prompt || !d.target_de.trim()) continue;
    const key = normPrompt(prompt);
    if (existing.has(key)) continue;
    existing.add(key);
    added.push({
      id: uid(),
      type: "sentence",
      source: "conversation",
      prompt_en: prompt,
      target_de: d.target_de.trim(),
      acceptable_de: [d.target_de.trim()],
      tags: d.tags ?? [],
      createdAt: now.toISOString(),
      archived: false,
      fsrs: createEmptyCard(now),
    });
  }

  if (added.length > 0) {
    cache.cards.push(...added);
    persist(api.createCards(added));
  }
  return added.length;
}

// RecordLog is keyed by the non-Manual ratings, so exclude Manual here.
const GRADE_TO_RATING: Record<Grade, Exclude<Rating, Rating.Manual>> = {
  correct: Rating.Good,
  minor: Rating.Hard,
  wrong: Rating.Again,
};

/** Record an attempt: reschedule the card via FSRS and fold errors into patterns. */
export function recordAttempt(input: {
  cardId: string;
  mode: "translation" | "conversation";
  spoken_de: string;
  grade: Grade;
  errors: ErrorInstance[];
}): void {
  const card = cache.cards.find((c) => c.id === input.cardId);
  const now = new Date();

  if (card) {
    const rating = GRADE_TO_RATING[input.grade];
    card.fsrs = scheduler.repeat(card.fsrs, now)[rating].card;
    persist(api.updateCard(card));
  }

  const attempt: Attempt = {
    id: uid(),
    cardId: input.cardId,
    timestamp: now.toISOString(),
    mode: input.mode,
    spoken_de: input.spoken_de,
    grade: input.grade,
    errorCount: input.errors.length,
  };
  cache.attempts.push(attempt);
  persist(api.createAttempt(attempt));

  const updated = foldErrors(input.errors, now);
  updated.forEach((p) => persist(api.putErrorPattern(p)));
}

export function archiveCard(id: string): void {
  const card = cache.cards.find((c) => c.id === id);
  if (!card) return;
  card.archived = true;
  persist(api.updateCard(card));
}

export function editCard(
  id: string,
  fields: { prompt_en?: string; target_de?: string | null; context_note?: string },
): void {
  const card = cache.cards.find((c) => c.id === id);
  if (!card) return;
  if (fields.prompt_en !== undefined) card.prompt_en = fields.prompt_en;
  if ("target_de" in fields) card.target_de = fields.target_de ?? null;
  if ("context_note" in fields) card.context_note = fields.context_note;
  persist(api.updateCard(card));
}

/** Aggregate conversation errors into patterns without touching FSRS scheduling. */
export function recordErrors(errors: ErrorInstance[]): void {
  if (errors.length === 0) return;
  const updated = foldErrors(errors, new Date());
  updated.forEach((p) => persist(api.putErrorPattern(p)));
}

function foldErrors(errors: ErrorInstance[], now: Date): ErrorPattern[] {
  const touched = new Map<string, ErrorPattern>();
  for (const err of errors) {
    const pattern = (cache.errorPatterns[err.category] ??= {
      category: err.category,
      count: 0,
      lastSeen: now.toISOString(),
      examples: [],
    });
    pattern.count += 1;
    pattern.lastSeen = now.toISOString();
    pattern.examples.unshift({ span_de: err.span_de, correction: err.correction });
    pattern.examples = pattern.examples.slice(0, 5);
    touched.set(pattern.category, pattern);
  }
  return [...touched.values()];
}
