# ADR-0086: Translation in checked pieces

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §15 (AI); amends ADR-0059

## Context

The owner translated a note of two photos (an app's train-booking screens) into Telugu. Only the title came back in
Telugu; the rest came back in English, word for word. There were also broken symbols (`$\rightarrow$`, and `$	ext{…}$`,
where the model's unescaped `\t` of `\text` had become a tab). The owner: "it needs to do the proper translations also."

Replaying the request against the local model (gemma4 on Ollama) showed three causes:

- **The model copies when it must answer in JSON.** The JSON format constrains every token it writes. The same text
  asked as plain text, at a low temperature and with a firmer prompt, came back in Telugu: about 70 % of its letters,
  with only names, codes and terms like "Puducherry Exp" and "SBC" left in English.
- **A whole note is more than it can hold.** The default context is 4,096 tokens, for the note and its translation
  together. Telugu and Hindi take several tokens a word.
- **Photo readings carried LaTeX for ordinary symbols**, which the model reproduced, and broke.

## Decision

- **TRANSLATE is answered in plain text** (`plain: true` on the task), at temperature 0.2, with prompt `translate` v2.
  The prompt says to translate every sentence, heading, list item and label into the language and its script. It
  leaves in English only names, codes, numbers, formulas, code and technical terms usually written in English, and
  keeps the Markdown.
  - The first line of the answer is the title (`# Title`).
- **The note is translated in pieces** of at most 1,500 characters, cut between paragraphs, then lines, then sentences
  (`domain/translate.ts`). The first piece carries the title; later ones use `translate-more`. The pieces are joined in
  order.
- **Each piece is checked to be in the language.** If fewer than half of its letters are in the language's script
  (leaving out code, formulas and links), it is asked again once, insisting, and the answer more in the language is
  kept. A piece already in that language is not asked again.
- **Photo readings make LaTeX symbols in ordinary text plain** (`plainSymbols`):
  - `$\rightarrow$` becomes →, and `$\text{8 km}$` becomes 8 km;
  - an unescaped `\t`, `\r`, `\f` or `\b` is mended first;
  - real mathematics is left as it is.

  Readings already kept are made plain as they are read.
- **Every structured answer is mended.** The gateway turns a control character that is followed by the rest of a
  LaTeX command back into the command before checking the answer (`mendAll`). This mends `$	ext{CO}_2$` in a summary,
  for example.
- **A translation gets the note's words alone**, without the "Photo 1:" labels other tasks see (ADR-0085).

## Consequences

- A translation takes one model call per 1,500 characters, plus at most one more per piece: a long note takes a
  minute or two. It counts against the person's allowance as before.
- The result is Markdown beside the note, as before; nothing changes for clients.
- The other text tasks still answer in JSON. If they show the same copying, the same plain-text way is open to them.
