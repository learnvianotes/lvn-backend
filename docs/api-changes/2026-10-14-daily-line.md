# Home's line for the day

- Date: 2026-10-14
- Package: `@lvn/contracts` 0.57.0
- Spec: ADR-0087
- Breaking: no

## What changes for clients

- **New query `dailyLine: DailyLine!`** (signed in), with these fields:
  - `day`: the person's learning day, `YYYY-MM-DD`;
  - `title`: a headline of a few words;
  - `line`: one sentence;
  - `fromAi`;
  - `pending`.
- **Before AI has written today's line**, or when AI is off, the answer is a chosen line, with `fromAi: false`. It is
  still different each day.
- **While `pending` is true**, AI is writing the person's own line. Ask again every few seconds (up to about a minute):
  it then comes with `fromAi: true` and stays the same for the rest of the day.
- **Show it on Home's card:** "Keep learning, <first name>", then `title`, then `line` (no quotation marks needed).
