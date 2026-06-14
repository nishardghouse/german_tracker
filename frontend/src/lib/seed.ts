// Starter sentences for translation drills. B2-flavoured, useful in daily life.

export interface SeedSentence {
  prompt_en: string;
  target_de: string;
  acceptable_de: string[];
  tags: string[];
  context_note?: string;
}

export const SEED_SENTENCES: SeedSentence[] = [
  {
    prompt_en: "I would have called you if I had had time.",
    target_de: "Ich hätte dich angerufen, wenn ich Zeit gehabt hätte.",
    acceptable_de: ["Ich hätte dich angerufen, wenn ich Zeit gehabt hätte."],
    tags: ["konjunktiv-2", "subordinate-clause"],
  },
  {
    prompt_en: "Could you tell me where the nearest pharmacy is?",
    target_de: "Könnten Sie mir sagen, wo die nächste Apotheke ist?",
    acceptable_de: [
      "Könnten Sie mir sagen, wo die nächste Apotheke ist?",
      "Können Sie mir sagen, wo die nächste Apotheke ist?",
    ],
    tags: ["indirect-question", "formal", "word-order"],
    context_note: "formal, asking a stranger",
  },
  {
    prompt_en: "I'm looking forward to the weekend.",
    target_de: "Ich freue mich auf das Wochenende.",
    acceptable_de: ["Ich freue mich auf das Wochenende.", "Ich freue mich aufs Wochenende."],
    tags: ["reflexive-verb", "preposition"],
  },
  {
    prompt_en: "The longer I live here, the more I like the city.",
    target_de: "Je länger ich hier wohne, desto mehr mag ich die Stadt.",
    acceptable_de: ["Je länger ich hier wohne, desto mehr mag ich die Stadt."],
    tags: ["je-desto", "word-order"],
  },
  {
    prompt_en: "I have to drop the car off at the garage tomorrow.",
    target_de: "Ich muss das Auto morgen in die Werkstatt bringen.",
    acceptable_de: ["Ich muss das Auto morgen in die Werkstatt bringen."],
    tags: ["modal-verb", "accusative"],
  },
  {
    prompt_en: "If I were you, I would accept the offer.",
    target_de: "An deiner Stelle würde ich das Angebot annehmen.",
    acceptable_de: [
      "An deiner Stelle würde ich das Angebot annehmen.",
      "Wenn ich du wäre, würde ich das Angebot annehmen.",
    ],
    tags: ["konjunktiv-2", "separable-verb"],
  },
  {
    prompt_en: "I'm not used to getting up so early.",
    target_de: "Ich bin es nicht gewohnt, so früh aufzustehen.",
    acceptable_de: ["Ich bin es nicht gewohnt, so früh aufzustehen."],
    tags: ["zu-infinitive", "separable-verb"],
  },
  {
    prompt_en: "The package should have arrived by now.",
    target_de: "Das Paket hätte inzwischen ankommen müssen.",
    acceptable_de: ["Das Paket hätte inzwischen ankommen müssen."],
    tags: ["konjunktiv-2", "modal-verb", "perfect"],
  },
  {
    prompt_en: "Despite the rain, we went for a walk.",
    target_de: "Trotz des Regens sind wir spazieren gegangen.",
    acceptable_de: [
      "Trotz des Regens sind wir spazieren gegangen.",
      "Trotz dem Regen sind wir spazieren gegangen.",
    ],
    tags: ["genitive", "preposition"],
  },
  {
    prompt_en: "I'd rather stay home tonight.",
    target_de: "Ich bleibe heute Abend lieber zu Hause.",
    acceptable_de: ["Ich bleibe heute Abend lieber zu Hause."],
    tags: ["comparative", "word-order"],
  },
  {
    prompt_en: "Can you remind me to send the email?",
    target_de: "Kannst du mich daran erinnern, die E-Mail zu schicken?",
    acceptable_de: ["Kannst du mich daran erinnern, die E-Mail zu schicken?"],
    tags: ["da-compound", "zu-infinitive"],
  },
  {
    prompt_en: "It depends on the weather.",
    target_de: "Das hängt vom Wetter ab.",
    acceptable_de: ["Das hängt vom Wetter ab.", "Es kommt auf das Wetter an."],
    tags: ["separable-verb", "preposition"],
  },
];
