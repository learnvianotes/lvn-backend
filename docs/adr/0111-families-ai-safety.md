# ADR-0111: Families-policy AI safety

- Status: Accepted (owner decision, 2026-11-11: under-13 changes ship as pull requests to main)
- Date: 2026-11-11
- Deciders: Backend; owner
- Spec sections: Google Play Families policy, §10 (AI)
- Depends on: ADR-0109, ADR-0110

## Context

LearnViaNotes admits minors, including children under 13. OpenAI is not approved for that content unless a zero-data-retention agreement is in place. Gemini and Google Generative AI are not used. Model answers need a child-safety prompt, an output check, an AI label, and a way to report an answer.

A person is a minor for this decision when their age is under 18 or is not known. Guardian consent and the admin consent age do not change it.

## Decision

**OpenAI is blocked for minors unless `openai_zdr_approved` is on.** The default is off, and the environment does not set it. The choice is made in provider routing (`AiProviders.guarded`), not at each call. A minor's preferred unsafe target moves to Anthropic for chat when one can do the job, then to a local model, then to any other safe provider. Embeddings and transcription move to a provider that can do that job. When none can, the call fails with `AI_UNAVAILABLE_FOR_MINOR` and the content is not sent. Adults keep the route they have today.

**The person whose age is used** is the requester. Platform work that still holds one person's content (a public note's owner, a daily line, a PDF, an ID card, a skills import, a note's embeddings) passes that person as `subjectId` and does not charge their quota. A signed-out search has no person and stays on the default route. A missing people binding, which unit tests use, is treated as an adult. A lookup that throws is treated as a minor.

**A child-safety system prompt is prepended for every minor, on every provider,** including when zero-data retention allows OpenAI. The built-in text is version 1 in code. Admin setting `ai_child_safety_prompt` replaces it when it is non-empty. ID-card extraction does not use the prompt or the output filter, because the model has to read the name on the card. It still refuses OpenAI and Gemini for a minor.

**Model text for a minor is filtered before it is returned.** Sexual, violent, self-harm and personal-information matches are replaced with a fixed message. Self-harm uses a message that names iCall, AASRA, 112 and the IASP page. The log records the category and the task only. A text answer returns the safe message. A structured answer fails with that message as `UNAVAILABLE`, so it is not parsed back into the note. Streaming tokens are not written until the finished answer passes.

**Every AI response has `aiGenerated: true`.** Browser SpeechRecognition captions and a chosen daily line are false. Clients render the label.

**`reportAiAnswer` stores the response id, the reason, an optional comment, and the task, status and note id.** It does not store the question or the answer. One account may file `ai_report_max_per_hour` reports (default 10). Platform admins list, view, resolve and dismiss the queue. Account erasure deletes the reporter's rows.

**Production refuses to start** when a Gemini connection, a Gemini model, a Google Generative AI address, or a Gemini environment variable is configured. Other environments log a warning. Admin pickers do not offer Gemini, and saving a Gemini connection or model is rejected. The enum value stays so an existing row can still be read.

## Consequences

Web and mobile must render `aiGenerated`, handle `AI_UNAVAILABLE_FOR_MINOR` (especially transcription), and can add report and review screens. Sentry, push, uploads and social gates are unchanged.

OpenAI-compatible hosts other than `api.openai.com`, `*.api.openai.com` and `*.openai.azure.com` are not treated as OpenAI.
