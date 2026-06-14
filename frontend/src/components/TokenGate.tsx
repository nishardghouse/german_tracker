import { useState } from "react";
import { setToken } from "../lib/api";

interface Props {
  onUnlock: () => void;
}

export default function TokenGate({ onUnlock }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    const t = value.trim();
    if (!t) { setError(true); return; }
    setToken(t);
    onUnlock();
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <p className="text-[28px] font-semibold tracking-tight text-white">Sprachheld</p>
        <p className="text-white/55 text-[14px]">Enter your access token to continue.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Access token"
          className={`w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder-white/30 outline-none text-[15px] border ${
            error ? "border-red-400/60" : "border-white/10 focus:border-white/30"
          } transition-colors`}
        />
        {error && <p className="text-red-400 text-[13px] -mt-2">Please enter a token.</p>}
        <button
          onClick={submit}
          className="w-full rounded-xl bg-white text-black font-medium py-3 text-[15px] hover:bg-white/90 active:scale-[0.98] transition-all"
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
