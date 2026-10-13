# The AI gateway (P5a)

- Date: 2026-10-13
- Package: `@lvn/contracts` 0.33.0
- Spec: §10.1; ADR-0058
- Breaking: no

## What changes for clients

- A new `ai` subgraph:
  - `aiStatus: AiStatus!`, for anyone: `available`, and `reason` when it is not. The reasons are `NOT_CONFIGURED`,
    `BUDGET` (until next month) and `PROVIDER_DOWN` (tried again shortly).
  - `myAiAllowance: AiAllowance!`, signed in only: `usedToday` and `limitToday` in tokens, and `resetsAt` (the next
    UTC midnight). `limitToday` is the plan's `AI_TOKENS_DAILY`; null means no limit.
- `ErrorCode` gains `UNAVAILABLE`. AI answers with it when it is off, out of budget, failing, or gave an answer that
  could not be used. Worth trying later.
- AI requests over the day's tokens answer `RATE_LIMITED`, with `retryAfter` in seconds until the next UTC midnight.

## Authorization

`aiStatus` reveals nothing personal. `myAiAllowance` is the viewer's own.

## What clients should do

Nothing yet. The AI menu (P5b) shows the allowance and reads `aiStatus` before offering tasks.
