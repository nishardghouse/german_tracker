import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

/** The provided design landing page (visual template). */
export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* Hero headline */}
      <div
        className={`fixed left-0 right-0 z-20 text-center transition-all duration-1000 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
        style={{ top: "120px" }}
      >
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
            fontSize: "clamp(40px, 5.4vw, 72px)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          <span className="block text-white">Venture without edges.</span>
          <span className="block" style={{ color: "rgba(255,255,255,0.55)" }}>
            Uncover with keen instinct.
          </span>
        </h1>
      </div>

      {/* Bottom block */}
      <div
        className={`fixed bottom-14 left-0 right-0 z-20 flex flex-col items-center gap-6 transition-all duration-1000 delay-300 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <p className="max-w-[620px] text-[15px] leading-relaxed text-center px-6">
          <span className="text-white">
            Our smart itineraries shape around you — your rhythm, your vibe, your hunger for
            adventure.
          </span>
          <span className="text-white/55"> Each getaway is tailored, seamless, and wholly yours.</span>
        </p>

        <button
          onClick={onEnter}
          className="bg-white text-black text-[15px] font-medium rounded-full px-8 py-3.5 transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_32px_4px_rgba(255,255,255,0.2)] active:scale-[0.97]"
        >
          Plan my escape today
        </button>

        <div className="flex items-center gap-2">
          <Lock size={13} strokeWidth={1.5} />
          <span className="text-[11px] font-medium tracking-[0.14em] text-white/70">
            SECURE BY DESIGN. ZERO DATA LEAKS.
          </span>
        </div>
      </div>
    </>
  );
}
