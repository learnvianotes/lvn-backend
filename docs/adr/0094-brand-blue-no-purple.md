# ADR-0094: Brand blue; no purple, lavender, indigo or violet

- Status: Accepted (owner design rule, 2026-10-21)
- Date: 2026-10-21
- Deciders: Web, Mobile, Backend agents; owner
- Spec sections: §12.2 (accessibility); amends `docs/design/ui-reference.md` (board A tokens) and ADR-0076's palette

## Context

Board A drew LearnViaNotes in indigo: an indigo accent, lavender-tinted backgrounds, an indigo logo tile and night-sky
heroes that run from midnight to indigo. For the launch build of the old app, the owner replaced every purple with the
brand blue (`#2563EB`) and gave CS Fundamentals green. The rule now covers every app: **no purple, lavender, indigo or
violet anywhere**: web, phone, emails, icons, generated files.

## Decision

**Tokens** (`docs/design/ui-reference.md`; lvn-web `app/globals.css`, lvn-mobile `global.css` and `lib/theme.ts`):

| Token | Light | Dark |
| --- | --- | --- |
| `accent` | `#2563EB` | `#60A5FA` |
| `accent-fg` | `#FFFFFF` | `#0D1117` |
| `accent-soft` | `#EFF6FF` | `#172554` |
| `bg` | `#F6F8FB` | `#0D1117` |
| `surface` / `surface-2` | `#FFFFFF` / `#F1F4F8` | `#161B22` / `#1F2630` |
| `fg` / `muted` | `#111827` / `#5B6475` | `#F4F4F5` / `#A1A1AA` |
| `border` | `#E3E8EF` | `#2D3440` |
| definitions | teal `#0F766E` | `#5EEAD4` |
| hero dark | `#0B1220` → `#1E3A8A` | same |

Contrast (WCAG 2.1 AA, §12.2):

- `accent` on white is 5.2:1, and on `accent-soft` 4.75:1 (light) and 5.8:1 (dark);
- `muted` on `bg` is 5.6:1 (light), and 5.9:1 or more on the dark surfaces.

The lowest pair is `accent` on `surface-2`, at 4.7:1.

**Hues for categories and tiles** come from blue, sky, cyan, teal, green, amber, orange, rose and pink. CS
Fundamentals is green.

**The logo** keeps its shapes. The tile runs `#3B82F6` → `#2563EB` → `#1E40AF`; the page shade is `#DBEAFE` and the
lines `#BFDBFE`.

**Highlights.** The API's `HighlightColor.PURPLE` keeps its name, so no stored highlight changes. Clients draw it and
name it **orange**.

**Kept as they are:** syntax highlighting themes, third-party marks (Google, GitHub, LinkedIn) and the content of
notes.

## Consequences

- Board A remains the layout reference; its colours are superseded by this table.
- New screens use the tokens; a review that finds a purple-family colour treats it as a bug.
- The icons are re-rendered from `logo-paths.json` (lvn-web `branding/render-icons.mjs`; lvn-mobile's icon assets).
