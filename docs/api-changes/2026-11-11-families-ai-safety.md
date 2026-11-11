# Families-policy AI safety

- Date: 2026-11-11
- Package: `@lvn/contracts` **0.83.0 → 0.84.0**
- Spec: ADR-0111, Google Play Families policy, §10
- Depends on: PR #72 (age gate, `users.GuardianConsent`) and PR #73 (parent notice, email-plus verification, minor purge). Merge those first. This branch contains their commits.
- Breaking: additive GraphQL fields and operations, plus one new error code. Adult AI routing is unchanged.

## Why

A person under 18, or whose age is unknown, must not have their content sent to OpenAI unless an admin has recorded a zero-data-retention agreement. Gemini is not a provider. Model answers for a minor carry a child-safety prompt and an output check. Every model answer is labelled, and a person can report one.

## Admin settings

All of these have `environmentFallback: false`. A missing row uses the default. Nothing new is read from the environment. Connection details stay in the environment (`AI_KEYS_SECRET` and the provider URLs already there). No secret is stored in git.

| Key | Type | Default |
| --- | --- | --- |
| `openai_zdr_approved` | boolean | `false` |
| `ai_child_safety_prompt` | string, up to 8,000 characters | empty, which uses the built-in prompt (version 1) |
| `ai_report_max_per_hour` | integer 1–100 | `10` |

`openai_zdr_approved` allows OpenAI for minors. It does not allow Gemini.

## Error codes

`AI_UNAVAILABLE_FOR_MINOR` is returned when a minor's content has no safe provider.

| Path | Message |
| --- | --- |
| Chat, notes, summaries, ID-card extraction | This AI feature isn’t available on this account. |
| Embeddings that would send their content | AI search isn’t available on this account. |
| Transcription | Transcription isn’t available on this account. |

An output-filter block is not this code. A text answer is replaced with a fixed safe message. A structured answer fails with `UNAVAILABLE` and that same message. Self-harm uses a message that names iCall (9152987821), AASRA (9820466726), emergency 112, and https://www.iasp.info/suicidalthoughts/.

## What changes for clients

- `aiGenerated: Boolean!` on `AiAnswer`, `AiArtifact`, `AiInsight`, `Transcript`, `NotesFromTranscript` and `DailyLine`. True when a model produced the text. False for browser SpeechRecognition captions and for a chosen daily line (`fromAi` is still there). Render an AI label from this field.
- `reportAiAnswer(input: { responseId, responseKind, reason, comment })` returns `reportId`. `responseKind` is `ANSWER` or `ARTIFACT`. Reasons: `INACCURATE`, `INAPPROPRIATE`, `HARMFUL`, `PERSONAL_INFO`, `OTHER`. Comment is optional, at most 500 characters. The reporter must own the answer or the artifact. A public study aid (`ownerId` null) can be reported by any signed-in person. Rate limited per account.
- Admin queue, platform admin only: `aiReports(status, first)`, `aiReport(id)`, `resolveAiReport(id)`, `dismissAiReport(id)`. `status` defaults to `OPEN`. `first` is 1–50. Resolve and dismiss only work on an `OPEN` report.
- Handle `AI_UNAVAILABLE_FOR_MINOR` on ask, AI tasks and transcription, and show the message. Transcription has no Anthropic fallback, so a minor sees this whenever the only hearing model is OpenAI and `openai_zdr_approved` is off.

## Migration

`20261116090000_families_ai_safety`

Adds `ai.AiReport` with status `OPEN | RESOLVED | DISMISSED` and reason `INACCURATE | INAPPROPRIATE | HARMFUL | PERSONAL_INFO | OTHER`. The row stores the reporter, the response id, the kind, the reason, an optional comment, and `{ task, status, noteId }`. It does not store the question or the answer. Account erasure deletes rows by `reporterId`.

No `AppSetting` row is seeded. A missing `openai_zdr_approved` is off.

## Production startup

The API and the worker refuse to start when `APP_ENV` is `production` and any Gemini connection (including a disabled one), Gemini model, Google Generative AI address, Gemini route, or Gemini environment variable is configured. The log names the setting and never a key. Development and sandbox log a warning and continue. Gemini is hidden from the admin model pickers. Saving a Gemini connection or model is rejected.

## Follow-ups, outside this repository

- Web and mobile: render `aiGenerated` on every AI surface, including transcripts and the daily line.
- Web and mobile: show `AI_UNAVAILABLE_FOR_MINOR`, especially on transcription, which has no second provider.
- Web and mobile: a "report this answer" action calling `reportAiAnswer`.
- Admin web: the review queue (`aiReports`, `aiReport`, `resolveAiReport`, `dismissAiReport`) and the three settings above. Gemini no longer appears in the provider or model pickers.
