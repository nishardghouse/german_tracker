// Mirrors backend/app/schemas.py — keep in sync.

export type Grade = "correct" | "minor" | "wrong";

export type ErrorCategory =
  | "case"
  | "word-order"
  | "preposition"
  | "gender"
  | "verb-conjugation"
  | "adjective-ending"
  | "vocabulary"
  | "anglicism"
  | "spelling"
  | "other";

export interface ErrorInstance {
  category: ErrorCategory;
  span_de: string;
  correction: string;
  explanation: string;
}

export interface GradeRequest {
  prompt_en: string;
  spoken_de: string;
  target_de?: string | null;
  acceptable_de?: string[];
  asr_confidence?: number | null;
  context_note?: string | null;
}

export interface GradeResult {
  grade: Grade;
  is_acceptable_variant: boolean;
  likely_asr_error: boolean;
  errors: ErrorInstance[];
  coaching: string;
  better_phrasing?: string | null;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DrillSuggestion {
  prompt_en: string;
  target_de: string;
  tags: string[];
}

export interface ConversationReplyRequest {
  history: ConversationTurn[];
  user_message: string;
  scenario?: string | null;
}

export interface ConversationFeedbackRequest {
  user_message: string;
  scenario?: string | null;
  history: ConversationTurn[];
}

export interface ConversationFeedback {
  errors: ErrorInstance[];
  coaching?: string | null;
  drills: DrillSuggestion[];
}
