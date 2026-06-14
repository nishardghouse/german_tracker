import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Plus, RotateCcw, Send, Volume2 } from "lucide-react";

import ErrorList from "../components/ErrorList";
import MicButton from "../components/MicButton";
import { gradeTranslation } from "../lib/api";
import { speakGerman, useDictation } from "../lib/speech";
import {
  addManualCard,
  getDueCard,
  getStats,
  getTopErrorPatterns,
  recordAttempt,
  type Card,
} from "../lib/store";
import type { GradeResult } from "../lib/types";

const ERROR_CATEGORY_LABEL: Record<string, string> = {
  case: "Case",
  "word-order": "Word order",
  preposition: "Prepositions",
  gender: "Gender",
  "verb-conjugation": "Verb conjugation",
  "adjective-ending": "Adjective endings",
  vocabulary: "Vocabulary",
  anglicism: "Anglicisms",
  spelling: "Spelling",
  other: "Other",
};

const GRADE_STYLE: Record<string, string> = {
  correct: "text-emerald-300",
  minor: "text-amber-300",
  wrong: "text-red-300",
};
const GRADE_LABEL: Record<string, string> = {
  correct: "Correct",
  minor: "Almost",
  wrong: "Not quite",
};

export default function Translation() {
  const [card, setCard] = useState<Card | null>(null);
  const [spoken, setSpoken] = useState(""); // editable answer — filled by speech or typing
  const [result, setResult] = useState<GradeResult | null>(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [stats, setStats] = useState(getStats());
  const abortRef = useRef<AbortController | null>(null);
  const lastReqRef = useRef<{ text: string; conf: number | null } | null>(null);
  // Confidence only applies while the field still holds the unedited transcript.
  const recognizedRef = useRef<{ text: string; conf: number | null } | null>(null);

  const loadNext = useCallback(() => {
    abortRef.current?.abort();
    setCard(getDueCard(card?.id));
    setSpoken("");
    setResult(null);
    setError(null);
    setShowAnswer(false);
    lastReqRef.current = null;
    recognizedRef.current = null;
    setStats(getStats());
  }, [card?.id]);

  useEffect(() => {
    setCard(getDueCard());
    setStats(getStats());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    async (text: string, conf: number | null) => {
      if (!card) return;
      lastReqRef.current = { text, conf };
      abortRef.current?.abort(); // cancel any in-flight grade
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setGrading(true);
      setError(null);
      setResult(null);
      try {
        const res = await gradeTranslation(
          {
            prompt_en: card.prompt_en,
            spoken_de: text,
            target_de: card.target_de,
            acceptable_de: card.acceptable_de,
            asr_confidence: conf,
            context_note: card.context_note,
          },
          ctrl.signal,
        );
        setResult(res);
        recordAttempt({
          cardId: card.id,
          mode: "translation",
          spoken_de: text,
          grade: res.grade,
          errors: res.errors,
        });
        setStats(getStats());
      } catch (e) {
        if (ctrl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Grading failed.");
      } finally {
        if (abortRef.current === ctrl) {
          setGrading(false);
          abortRef.current = null;
        }
      }
    },
    [card],
  );

  const retry = useCallback(() => {
    const last = lastReqRef.current;
    if (last) void submit(last.text, last.conf);
  }, [submit]);

  // Submit the (possibly edited / typed) answer. Pass confidence only if untouched.
  const handleSend = useCallback(() => {
    const text = spoken.trim();
    if (!text || grading) return;
    const rec = recognizedRef.current;
    const conf = rec && rec.text === spoken ? rec.conf : null;
    void submit(text, conf);
  }, [spoken, grading, submit]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const dictation = useDictation({
    onInterim: (text) => setSpoken(text), // stream live into the editable field
    onError: (e) =>
      setError(
        e === "not-allowed"
          ? "Microphone permission denied. Allow mic access to speak."
          : `Speech error: ${e}`,
      ),
    onFinal: (text, conf) => {
      setSpoken(text);
      recognizedRef.current = { text, conf };
      // No auto-submit — leave it in the field so it can be edited, then Send.
    },
  });

  if (!card) {
    return (
      <CenteredCard>
        <p className="text-[15px] text-white/70">
          No cards yet. Add an English sentence you want to be able to say in German.
        </p>
        <AddSentence
          open
          onClose={() => {}}
          onAdded={() => {
            setCard(getDueCard());
            setStats(getStats());
          }}
        />
      </CenteredCard>
    );
  }

  return (
    <div className="relative z-20 mx-auto flex min-h-screen max-w-2xl flex-col px-6 pt-28 pb-12">
      <StatsBar stats={stats} />
      <TopMistakes key={stats.attempts} />

      {/* Prompt */}
      <div className="liquid-glass rounded-3xl px-7 py-8 mt-4">
        <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-white/45 mb-3">
          Translate into German
        </p>
        <p
          className="text-white"
          style={{ fontFamily: "'Inter', sans-serif", fontSize: "clamp(22px,3vw,30px)", lineHeight: 1.25 }}
        >
          {card.prompt_en}
        </p>
        {card.context_note && (
          <p className="text-[13px] text-white/45 mt-3">Context: {card.context_note}</p>
        )}
      </div>

      {/* Editable answer — filled by speech, then editable; or type directly */}
      {!result && (
        <div className="mt-5">
          <textarea
            value={spoken}
            onChange={(e) => setSpoken(e.target.value)}
            readOnly={dictation.listening}
            placeholder={dictation.listening ? "Listening…" : "Speak or type your German…"}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="w-full liquid-glass rounded-2xl px-4 py-3 text-[18px] text-white text-center outline-none resize-none placeholder:text-white/30"
          />
          <p className="mt-1 text-center text-[11px] text-white/35">
            Check the text and edit if needed, then send.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-center text-[14px] text-red-300/90">{error}</p>}

      {/* Result */}
      {result && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className={`text-[18px] font-semibold ${GRADE_STYLE[result.grade]}`}>
              {GRADE_LABEL[result.grade]}
            </span>
            {result.is_acceptable_variant && (
              <span className="text-[12px] text-white/50">(valid alternative phrasing)</span>
            )}
            {result.likely_asr_error && (
              <span className="text-[12px] text-amber-200/70">possible mishearing</span>
            )}
          </div>
          <p className="text-[15px] leading-relaxed text-white/85">{result.coaching}</p>
          <ErrorList errors={result.errors} />
          {result.better_phrasing && (
            <div className="liquid-glass rounded-2xl px-4 py-3">
              <p className="text-[11px] tracking-[0.12em] uppercase text-white/45 mb-1">
                More natural
              </p>
              <p className="text-[15px] text-white/90 flex items-center gap-2">
                {result.better_phrasing}
                <button
                  onClick={() => speakGerman(result.better_phrasing!)}
                  aria-label="Play"
                  className="text-white/60 hover:text-white"
                >
                  <Volume2 size={16} />
                </button>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="mt-auto pt-10 flex flex-col items-center gap-5">
        {!result ? (
          <>
            <div className="flex items-center gap-4">
              <MicButton
                listening={dictation.listening}
                busy={grading}
                disabled={!dictation.supported}
                onStart={(autoStop) => {
                  setError(null);
                  setSpoken("");
                  recognizedRef.current = null;
                  dictation.start(autoStop);
                }}
                onStop={dictation.stop}
                onEnableAutoStop={dictation.enableAutoStop}
              />
              <button
                onClick={handleSend}
                disabled={!spoken.trim() || grading || dictation.listening}
                className="bg-white text-black text-[15px] font-medium rounded-full px-7 py-3.5 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-40 disabled:hover:scale-100 flex items-center gap-2"
              >
                <Send size={16} /> Check
              </button>
            </div>
            <p className="text-[12px] text-white/45">
              {!dictation.supported
                ? "Speech recognition isn't supported here — type your answer instead."
                : dictation.listening
                  ? "Speak — release to stop, then edit or send."
                  : grading
                    ? "Grading…"
                    : "Tap for hands-free, hold to talk, or just type."}
            </p>
            {(grading || error) && lastReqRef.current && (
              <button
                onClick={retry}
                className="flex items-center gap-1.5 text-[12px] text-white/70 hover:text-white liquid-glass rounded-full px-4 py-2"
              >
                <RotateCcw size={14} /> {grading ? "Cancel & retry" : "Retry"}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={loadNext}
            className="bg-white text-black text-[15px] font-medium rounded-full px-8 py-3.5 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] flex items-center gap-2"
          >
            <RotateCcw size={16} /> Next sentence
          </button>
        )}

        <div className="flex items-center gap-5 text-white/55">
          <button
            onClick={() => setShowAnswer((s) => !s)}
            className="flex items-center gap-1.5 text-[12px] hover:text-white"
          >
            <Eye size={14} /> {showAnswer ? "Hide" : "Show"} answer
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-[12px] hover:text-white"
          >
            <Plus size={14} /> Add sentence
          </button>
        </div>

        {showAnswer && card.target_de && (
          <p className="text-[15px] text-white/75 flex items-center gap-2">
            {card.target_de}
            <button
              onClick={() => speakGerman(card.target_de!)}
              aria-label="Play"
              className="text-white/60 hover:text-white"
            >
              <Volume2 size={16} />
            </button>
          </p>
        )}
      </div>

      {showAdd && (
        <AddSentence
          open
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            setStats(getStats());
          }}
        />
      )}
    </div>
  );
}

function StatsBar({ stats }: { stats: ReturnType<typeof getStats> }) {
  return (
    <div className="flex items-center justify-center gap-6 text-[12px] text-white/55">
      <span>{stats.dueCount} due</span>
      <span>·</span>
      <span>{stats.totalCards} cards</span>
      <span>·</span>
      <span>{stats.attempts} attempts</span>
    </div>
  );
}

function TopMistakes() {
  const patterns = getTopErrorPatterns(3);
  if (patterns.length === 0) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
      <span className="text-[11px] tracking-[0.12em] uppercase text-white/40">Watch:</span>
      {patterns.map((p) => (
        <span key={p.category} className="text-[12px] text-white/65">
          {ERROR_CATEGORY_LABEL[p.category] ?? p.category}
          <span className="text-white/35"> {p.count}×</span>
        </span>
      ))}
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-20 mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      {children}
    </div>
  );
}

function AddSentence({
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [en, setEn] = useState("");
  const [de, setDe] = useState("");

  const submit = () => {
    if (!en.trim()) return;
    addManualCard({ prompt_en: en, target_de: de || null });
    setEn("");
    setDe("");
    onAdded();
  };

  const overlay = useMemo(
    () => (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-6"
        onClick={onClose}
      >
        <div
          className="liquid-glass w-full max-w-md rounded-3xl px-6 py-6 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[15px] font-semibold">Add a sentence to drill</p>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-white/55">English (required)</span>
            <input
              autoFocus
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder="The sentence you want to be able to say"
              className="bg-white/5 rounded-xl px-3 py-2 text-[15px] text-white outline-none placeholder:text-white/30 focus:bg-white/10"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-white/55">German reference (optional)</span>
            <input
              value={de}
              onChange={(e) => setDe(e.target.value)}
              placeholder="A known-good translation, if you have one"
              className="bg-white/5 rounded-xl px-3 py-2 text-[15px] text-white outline-none placeholder:text-white/30 focus:bg-white/10"
            />
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="text-[14px] text-white/60 hover:text-white px-3 py-2">
              Cancel
            </button>
            <button
              onClick={submit}
              className="bg-white text-black text-[14px] font-medium rounded-full px-5 py-2 active:scale-[0.97]"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    ),
    [en, de],
  );

  return overlay;
}
