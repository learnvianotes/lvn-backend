# Translation in checked pieces

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.56.0 (unchanged)
- Spec: ADR-0086
- Breaking: no

## What changes for clients

- **`runAiTask(task: TRANSLATE)`** gives a real translation:
  - every sentence, heading, list item and label is in the chosen language and script;
  - names, codes, numbers, formulas and code stay as they are.
- **The result shape is unchanged:** `markdown`, with the translated title as a `##` heading.
- **A long note takes longer.** It is translated in pieces of about 1,500 characters, each checked.
- **Notes made from photos** no longer show LaTeX for ordinary symbols (→, ·, °) in what AI reads or writes.
