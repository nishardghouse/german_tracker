import { useCallback, useEffect, useRef, useState } from "react";

function getRecognitionCtor(): { new (): SpeechRecognition } | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export const speechSupported = getRecognitionCtor() !== null;

interface DictationOptions {
  lang?: string;
  /** Stop automatically after this many ms with no new speech. */
  silenceMs?: number;
  onFinal: (text: string, confidence: number | null) => void;
  onInterim?: (text: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hands-free German dictation.
 *
 * Listens continuously and auto-stops after a pause in speech (silence
 * detection), then delivers the full transcript once via `onFinal`. This is the
 * "continuous / hands-free with auto-stop on silence" UX. Client-side only for
 * now; the backend /transcribe stub is the future server-side (Whisper) path.
 */
export function useDictation(opts: DictationOptions) {
  const { lang = "de-DE", silenceMs = 1600, onFinal, onInterim, onError } = opts;

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const finalTextRef = useRef("");
  const confidenceRef = useRef<number | null>(null);
  const finalizedRef = useRef(false);
  // When false, the silence timer is disabled (push-to-talk: stop only on explicit stop()).
  const autoStopRef = useRef(true);
  const armSilenceRef = useRef<(() => void) | null>(null);

  // Keep the latest callbacks without re-creating the recognition instance.
  const cbRef = useRef({ onFinal, onInterim, onError });
  useEffect(() => {
    cbRef.current = { onFinal, onInterim, onError };
  }, [onFinal, onInterim, onError]);

  const clearSilence = () => {
    if (silenceTimer.current !== null) {
      window.clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  };

  const stop = useCallback(() => {
    clearSilence();
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback((autoStopOnSilence = true) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      cbRef.current.onError?.("Speech recognition is not supported in this browser.");
      return;
    }
    // Reset per-session state.
    finalTextRef.current = "";
    confidenceRef.current = null;
    finalizedRef.current = false;
    autoStopRef.current = autoStopOnSilence;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    const armSilence = () => {
      clearSilence();
      silenceTimer.current = window.setTimeout(() => rec.stop(), silenceMs);
    };
    armSilenceRef.current = armSilence;

    rec.onstart = () => setListening(true);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        if (result.isFinal) {
          finalTextRef.current = `${finalTextRef.current} ${alt.transcript}`.trim();
          confidenceRef.current = alt.confidence ?? confidenceRef.current;
        } else {
          interim += alt.transcript;
        }
      }
      const preview = `${finalTextRef.current} ${interim}`.trim();
      if (preview) cbRef.current.onInterim?.(preview);
      if (autoStopRef.current) armSilence();
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        cbRef.current.onError?.(event.error);
      }
    };

    rec.onend = () => {
      clearSilence();
      setListening(false);
      if (!finalizedRef.current) {
        finalizedRef.current = true;
        const text = finalTextRef.current.trim();
        if (text) cbRef.current.onFinal(text, confidenceRef.current);
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      // start() throws if called while already running — ignore.
    }
  }, [lang, silenceMs]);

  /** Switch an in-progress push-to-talk session into hands-free (arm the silence timer). */
  const enableAutoStop = useCallback(() => {
    autoStopRef.current = true;
    armSilenceRef.current?.();
  }, []);

  useEffect(() => () => {
    clearSilence();
    recognitionRef.current?.abort();
  }, []);

  return { supported: speechSupported, listening, start, stop, enableAutoStop };
}

/** Speak German text aloud using the browser's TTS, preferring a German voice. */
export function speakGerman(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "de-DE";
  const german = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("de"));
  if (german) utter.voice = german;
  utter.rate = 0.95;
  synth.speak(utter);
}
