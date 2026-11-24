# ADR-0114: Design direction from the product's world (unslop); supersedes ADR-0094

- Status: Accepted
- Date: 2026-11-25
- Deciders: owner; Web and Mobile agents
- Spec sections: §12 (UI)

## Context

The owner asked for a redesign of web and mobile that does not look like a generic AI-generated product, and pointed
at heydamir/unslop (CC BY 4.0) as the method: one neutral ramp tinted toward the product's world, one accent, one
signature detail, no hue gradients, glows, sparkles, emoji labels, uppercase tracked labels or looping motion. ADR-0094
fixed the brand to blue with no purple; its palette and gradient logo are replaced here.

## Decision

- World: a study desk the night before an exam: ruled paper, pen ink, a yellow highlighter.
- Colour: warm-paper neutral ramp (paper #f8f7f4 / #141413), ink accent #2847a8 (dark #a9bbf2) as the default theme `ink`,
  the highlighter (`spark` #f2c230, `highlight` #fbe7a1) as the signature. Other accents stay as user choices.
- Signature: a flat highlighter stroke behind a key phrase, under the logo letters, and on Nova's citations.
- Type: IBM Plex Sans 400/500/600 for the interface, JetBrains Mono for code and figures. No weights above 600.
- Logo: the letters LVN in paper on a flat ink tile with one highlighter stroke. No gradient, glow or sparkle.
- The AI is called Nova.
- Values live in lvn-web docs/ui-revamp/tokens.json and are shared by web and mobile.

## Consequences

Purple, violet, indigo, lavender and pink stay out, as before. Tests pin contrast (AA) for every accent and the
highlighter's text pair. A later palette change edits tokens.json and both apps follow.
