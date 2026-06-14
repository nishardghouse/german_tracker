import type { ErrorInstance } from "../lib/types";

const CATEGORY_LABEL: Record<string, string> = {
  case: "Case",
  "word-order": "Word order",
  preposition: "Preposition",
  gender: "Gender",
  "verb-conjugation": "Verb",
  "adjective-ending": "Adj. ending",
  vocabulary: "Vocabulary",
  anglicism: "Anglicism",
  spelling: "Spelling",
  other: "Other",
};

export default function ErrorList({ errors }: { errors: ErrorInstance[] }) {
  if (errors.length === 0) {
    return <p className="text-[14px] text-emerald-300/90">No errors — clean German. ✓</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {errors.map((err, i) => (
        <li key={i} className="liquid-glass rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-white/60">
              {CATEGORY_LABEL[err.category] ?? err.category}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed">
            <span className="line-through text-red-300/80">{err.span_de}</span>
            <span className="mx-2 text-white/40">→</span>
            <span className="text-emerald-300">{err.correction}</span>
          </p>
          <p className="text-[13px] text-white/55 mt-1">{err.explanation}</p>
        </li>
      ))}
    </ul>
  );
}
