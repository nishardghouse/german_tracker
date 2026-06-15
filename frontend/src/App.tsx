import { useCallback, useEffect, useState } from "react";

import TokenGate from "./components/TokenGate";
import VideoBackground from "./components/VideoBackground";
import Landing from "./screens/Landing";
import Cards from "./screens/Cards";
import Conversation from "./screens/Conversation";
import Translation from "./screens/Translation";
import { clearToken } from "./lib/api";
import { initStore } from "./lib/store";

type View = "home" | "conversation" | "translation" | "cards";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const isHome = view === "home";

  const load = useCallback(() => {
    setReady(false);
    setLoadError(null);
    setNeedsAuth(false);
    initStore()
      .then(() => setReady(true))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Could not reach the server.";
        if (msg.startsWith("401")) {
          clearToken();
          setNeedsAuth(true);
        } else {
          setLoadError(msg);
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (needsAuth) {
    return <TokenGate onUnlock={load} />;
  }

  return (
    <div
      className="min-h-screen bg-black text-white overflow-x-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <VideoBackground dim={!isHome} />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 py-6 sm:py-8 flex justify-between items-center">
        <button
          onClick={() => setView("home")}
          className="text-[17px] font-semibold tracking-tight"
        >
          Sprachheld<sup>TM</sup>
        </button>

        <nav className="liquid-glass rounded-full px-2 py-2 flex items-center gap-1">
          <NavLink active={view === "conversation"} onClick={() => setView("conversation")}>
            CONVERSATION
          </NavLink>
          <NavLink active={view === "translation"} onClick={() => setView("translation")}>
            TRANSLATE
          </NavLink>
          <NavLink active={view === "cards"} onClick={() => setView("cards")}>
            CARDS
          </NavLink>
        </nav>

        <div className="w-[150px] hidden sm:block" />
      </header>

      {/* Views */}
      {view === "home" && <Landing onEnter={() => setView("translation")} />}
      {view !== "home" &&
        (loadError ? (
          <CenterMessage>
            <p className="text-red-300/90 text-[15px]">{loadError}</p>
            <p className="text-white/55 text-[13px] mt-2">
              Is the backend running on port 8000?
            </p>
          </CenterMessage>
        ) : !ready ? (
          <CenterMessage>
            <p className="text-white/60 text-[15px]">Loading your progress…</p>
          </CenterMessage>
        ) : view === "conversation" ? (
          <Conversation />
        ) : view === "cards" ? (
          <Cards />
        ) : (
          <Translation />
        ))}
    </div>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

function NavLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-medium tracking-[0.12em] px-4 py-1.5 rounded-full transition-colors duration-200 ${
        active ? "bg-white text-black" : "text-white/90 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
