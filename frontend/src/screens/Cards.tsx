import { useMemo, useState } from "react";
import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { translateSentence } from "../lib/api";
import { archiveCard, editCard, getCards, type Card } from "../lib/store";

const SOURCE_LABEL: Record<string, string> = {
  manual: "manual",
  conversation: "convo",
  generated: "auto",
  seed: "seed",
  inbox: "inbox",
};

export default function Cards() {
  const [cards, setCards] = useState<Card[]>(() => getCards());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Card | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.prompt_en.toLowerCase().includes(q) ||
        (c.target_de ?? "").toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [cards, search]);

  const handleDelete = (id: string) => {
    archiveCard(id);
    setCards(getCards());
  };

  const handleSave = (
    id: string,
    fields: { prompt_en: string; target_de: string | null; context_note?: string },
  ) => {
    editCard(id, fields);
    setCards(getCards());
    setEditing(null);
  };

  return (
    <div className="relative z-20 mx-auto flex min-h-screen max-w-2xl flex-col px-6 pt-28 pb-12">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-semibold">Cards</h1>
        <span className="text-[13px] text-white/50">{cards.length} total</span>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="liquid-glass rounded-2xl px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/30 mb-4 w-full"
      />

      {filtered.length === 0 ? (
        <p className="text-center text-white/40 text-[14px] mt-16">
          {search ? "No cards match." : "No cards yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((card) => (
            <div key={card.id} className="liquid-glass rounded-2xl px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-white leading-snug">{card.prompt_en}</p>
                {card.target_de && (
                  <p className="text-[13px] text-white/55 mt-0.5">{card.target_de}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-white/35 uppercase tracking-wide">
                    {SOURCE_LABEL[card.source] ?? card.source}
                  </span>
                  {card.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] text-white/45 bg-white/10 rounded-full px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(card)}
                  className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="text-white/40 hover:text-red-300 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal card={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function EditModal({
  card,
  onSave,
  onClose,
}: {
  card: Card;
  onSave: (
    id: string,
    fields: { prompt_en: string; target_de: string | null; context_note?: string },
  ) => void;
  onClose: () => void;
}) {
  const [en, setEn] = useState(card.prompt_en);
  const [de, setDe] = useState(card.target_de ?? "");
  const [note, setNote] = useState(card.context_note ?? "");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!en.trim() || generating) return;
    setGenerating(true);
    try {
      const { translation } = await translateSentence(en.trim());
      setDe(translation);
    } catch {
      // silent fail — user can still type manually
    } finally {
      setGenerating(false);
    }
  };

  const save = () => {
    if (!en.trim()) return;
    onSave(card.id, {
      prompt_en: en.trim(),
      target_de: de.trim() || null,
      context_note: note.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-6"
      onClick={onClose}
    >
      <div
        className="liquid-glass w-full max-w-md rounded-3xl px-6 py-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] font-semibold">Edit card</p>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-white/55">English</span>
          <input
            autoFocus
            value={en}
            onChange={(e) => setEn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="bg-white/5 rounded-xl px-3 py-2 text-[15px] text-white outline-none placeholder:text-white/30 focus:bg-white/10"
          />
        </label>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-white/55">German reference</span>
            <button
              onClick={generate}
              disabled={generating || !en.trim()}
              className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white disabled:opacity-30 transition-colors"
            >
              <Sparkles size={11} />
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
          <input
            value={de}
            onChange={(e) => setDe(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Optional"
            className="bg-white/5 rounded-xl px-3 py-2 text-[15px] text-white outline-none placeholder:text-white/30 focus:bg-white/10"
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-white/55">Context note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Optional"
            className="bg-white/5 rounded-xl px-3 py-2 text-[15px] text-white outline-none placeholder:text-white/30 focus:bg-white/10"
          />
        </label>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="text-[14px] text-white/60 hover:text-white px-3 py-2">
            Cancel
          </button>
          <button
            onClick={save}
            className="bg-white text-black text-[14px] font-medium rounded-full px-5 py-2 active:scale-[0.97]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
