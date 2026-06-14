import { useRef } from "react";
import { Loader2, Mic, Square } from "lucide-react";

interface MicButtonProps {
  listening: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** Start listening. `autoStop=false` is push-to-talk (no silence auto-stop). */
  onStart: (autoStop: boolean) => void;
  onStop: () => void;
  /** Promote an in-progress push-to-talk session to hands-free (used for a quick tap). */
  onEnableAutoStop: () => void;
}

// Press longer than this = hold-to-talk; shorter = a tap → hands-free.
const HOLD_MS = 350;

/**
 * Tap = hands-free (auto-stops when you pause). Hold = push-to-talk (records until you
 * release). The press starts recording immediately; on release we decide which it was.
 */
export default function MicButton({
  listening,
  busy,
  disabled,
  onStart,
  onStop,
  onEnableAutoStop,
}: MicButtonProps) {
  const downAt = useRef(0);
  const active = useRef(false);

  const begin = () => {
    if (busy || disabled) return;
    if (listening) {
      onStop(); // tapping while listening stops/submits
      return;
    }
    active.current = true;
    downAt.current = Date.now();
    onStart(false); // start with silence disabled; a quick release re-enables it
  };

  const end = () => {
    if (!active.current) return;
    active.current = false;
    if (Date.now() - downAt.current < HOLD_MS) {
      onEnableAutoStop(); // it was a tap → hands-free
    } else {
      onStop(); // hold release → stop & submit
    }
  };

  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        begin();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        end();
      }}
      onPointerLeave={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (busy || disabled) return;
          listening ? onStop() : onStart(true);
        }
      }}
      disabled={busy || disabled}
      aria-label={listening ? "Stop listening" : "Start speaking (tap for hands-free, hold to talk)"}
      style={{ touchAction: "none" }}
      className="relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-200 disabled:opacity-50 active:scale-[0.96] select-none"
    >
      {listening && <span className="absolute inset-0 rounded-full bg-white/20 animate-ping" />}
      <span
        className={`relative flex items-center justify-center w-20 h-20 rounded-full ${
          listening ? "bg-white text-black" : "liquid-glass text-white"
        }`}
      >
        {busy ? (
          <Loader2 size={26} className="animate-spin" />
        ) : listening ? (
          <Square size={24} strokeWidth={2} />
        ) : (
          <Mic size={26} strokeWidth={1.75} />
        )}
      </span>
    </button>
  );
}
