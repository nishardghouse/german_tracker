import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Volume2 } from "lucide-react";

import ErrorList from "../components/ErrorList";
import MicButton from "../components/MicButton";
import { conversationFeedback, conversationReplyStream } from "../lib/api";
import { speakGerman, useDictation } from "../lib/speech";
import { addConversationCards, recordErrors } from "../lib/store";
import type { ConversationTurn, ErrorInstance } from "../lib/types";

interface DisplayTurn {
  role: "user" | "assistant";
  content: string;
  errors?: ErrorInstance[];
  coaching?: string | null;
}

const SCENARIOS = [
  { label: "Free chat", value: "" },
  { label: "Complaining to a landlord", value: "The user is complaining to their landlord about a broken heater." },
  { label: "At the doctor", value: "The user is describing a medical symptom to a doctor." },
  { label: "Job interview", value: "The user is in a job interview for a role they want." },
];

export default function Conversation() {
  const [scenario, setScenario] = useState("");
  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [draft, setDraft] = useState(""); // editable message — filled by speech or typing
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedToast, setAddedToast] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastSentRef = useRef<{ message: string; history: ConversationTurn[] } | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, draft, thinking]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const dispatch = useCallback(
    async (message: string, history: ConversationTurn[], isRetry: boolean) => {
      setError(null);
      setThinking(true);
      abortRef.current?.abort(); // cancel any in-flight request
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Add the user turn (unless retrying) and a fresh assistant placeholder to stream into.
      setTurns((prev) => {
        let next = [...prev];
        if (!isRetry) next.push({ role: "user", content: message });
        if (next.length && next[next.length - 1].role === "assistant") next = next.slice(0, -1);
        next.push({ role: "assistant", content: "" });
        return next;
      });

      const setAssistant = (content: string) =>
        setTurns((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant") {
              next[i] = { ...next[i], content };
              break;
            }
          }
          return next;
        });

      try {
        // 1) Fast streamed reply — appears as it generates.
        let full = "";
        await conversationReplyStream(
          { history, user_message: message, scenario: scenario || null },
          (chunk) => {
            full += chunk;
            setAssistant(full);
          },
          ctrl.signal,
        );
        if (ctrl.signal.aborted) return;
        setThinking(false);
        speakGerman(full);

        // 2) Background feedback — corrections + drills fill in a moment later.
        conversationFeedback(
          { user_message: message, scenario: scenario || null, history },
          ctrl.signal,
        )
          .then((fb) => {
            if (ctrl.signal.aborted) return;
            setTurns((prev) => {
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].role === "user") {
                  next[i] = { ...next[i], errors: fb.errors, coaching: fb.coaching };
                  break;
                }
              }
              return next;
            });
            recordErrors(fb.errors);
            const added = addConversationCards(fb.drills ?? []);
            if (added > 0) {
              setAddedToast(added);
              window.setTimeout(() => setAddedToast(null), 4000);
            }
          })
          .catch((e) => {
            if (!ctrl.signal.aborted) console.error("[conversation] feedback failed:", e);
          });
      } catch (e) {
        if (ctrl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Conversation failed.");
        setThinking(false);
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [scenario],
  );

  const send = useCallback(
    (message: string) => {
      const history: ConversationTurn[] = turns.map((t) => ({ role: t.role, content: t.content }));
      lastSentRef.current = { message, history };
      void dispatch(message, history, false);
    },
    [turns, dispatch],
  );

  const retry = useCallback(() => {
    const last = lastSentRef.current;
    if (last) void dispatch(last.message, last.history, true);
  }, [dispatch]);

  const dictation = useDictation({
    onInterim: (text) => setDraft(text), // stream live into the editable field
    onError: (e) =>
      setError(
        e === "not-allowed"
          ? "Microphone permission denied. Allow mic access to speak."
          : `Speech error: ${e}`,
      ),
    onFinal: (text) => setDraft(text), // no auto-send — edit then Send
  });

  const handleSend = useCallback(() => {
    const message = draft.trim();
    if (!message || thinking || dictation.listening) return;
    setDraft("");
    send(message);
  }, [draft, thinking, dictation.listening, send]);

  return (
    <div className="relative z-20 mx-auto flex min-h-screen max-w-2xl flex-col px-6 pt-24 pb-40">
      {/* Scenario picker (only before the conversation starts) */}
      {turns.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-4">
          <p className="text-[15px] text-white/70 text-center">
            Pick a situation and start speaking German. I'll reply and quietly note any
            mistakes for you to review.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.label}
                onClick={() => setScenario(s.value)}
                className={`rounded-full px-4 py-2 text-[12px] tracking-[0.06em] transition-colors ${
                  scenario === s.value ? "bg-white text-black" : "liquid-glass text-white/85"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 flex flex-col gap-5 mt-6 overflow-y-auto">
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "self-end max-w-[85%]" : "self-start max-w-[85%]"}>
            <div
              className={`rounded-2xl px-4 py-3 ${
                turn.role === "user" ? "bg-white text-black" : "liquid-glass text-white"
              }`}
            >
              <p className="text-[15px] leading-relaxed flex items-start gap-2">
                {turn.content || (turn.role === "assistant" ? "…" : "")}
                {turn.role === "assistant" && turn.content && (
                  <button
                    onClick={() => speakGerman(turn.content)}
                    aria-label="Play"
                    className="text-white/55 hover:text-white mt-0.5 shrink-0"
                  >
                    <Volume2 size={15} />
                  </button>
                )}
              </p>
            </div>
            {turn.role === "user" && turn.errors && (
              <div className="mt-2 flex flex-col gap-2">
                {turn.coaching && (
                  <p className="text-[13px] text-amber-200/80 px-1">{turn.coaching}</p>
                )}
                {turn.errors.length > 0 && <ErrorList errors={turn.errors} />}
              </div>
            )}
          </div>
        ))}

      </div>

      {error && <p className="text-center text-[14px] text-red-300/90 mt-3">{error}</p>}

      {/* "added to drills" toast */}
      {addedToast !== null && (
        <div className="fixed bottom-32 left-0 right-0 z-30 flex justify-center">
          <span className="liquid-glass rounded-full px-4 py-2 text-[12px] text-white/85">
            +{addedToast} {addedToast === 1 ? "drill" : "drills"} added from this turn →
            practice in Translate
          </span>
        </div>
      )}

      {/* Mic dock */}
      <div className="fixed bottom-8 left-0 right-0 z-30 flex flex-col items-center gap-3 px-6">
        {(thinking || error) && lastSentRef.current && (
          <button
            onClick={retry}
            className="flex items-center gap-1.5 text-[12px] text-white/70 hover:text-white liquid-glass rounded-full px-4 py-2"
          >
            <RotateCcw size={14} /> {thinking ? "Cancel & retry" : "Retry"}
          </button>
        )}
        <div className="flex items-end gap-3 w-full max-w-2xl">
          <MicButton
            listening={dictation.listening}
            busy={thinking}
            disabled={!dictation.supported}
            onStart={(autoStop) => {
              setError(null);
              setDraft("");
              dictation.start(autoStop);
            }}
            onStop={dictation.stop}
            onEnableAutoStop={dictation.enableAutoStop}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={dictation.listening}
            placeholder={dictation.listening ? "Listening…" : "Speak or type, then send…"}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 liquid-glass rounded-2xl px-4 py-3 text-[15px] text-white outline-none resize-none placeholder:text-white/30"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || thinking || dictation.listening}
            aria-label="Send"
            className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-black transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] disabled:opacity-40 disabled:hover:scale-100 shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[12px] text-white/45">
          {!dictation.supported
            ? "Speech recognition isn't supported here — type your message instead."
            : dictation.listening
              ? "Speak — release to stop, then edit or send."
              : "Tap for hands-free, hold to talk, or just type."}
        </p>
      </div>
    </div>
  );
}
