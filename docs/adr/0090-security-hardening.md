# ADR-0090: Security hardening — per-person rate limit, the edge firewall, a Content Security Policy, 15-minute reader links

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web, Mobile agents; owner
- Spec sections: §17.1 (rate limits, pre-signed URLs at most 15 minutes, headers), §16.6, §18 Phase 9 (security audit)

## Context

Phase 9's security review (docs/plans/phase-9.md, P9b) checked the §17.1 list against what runs. Most of it held:
depth and complexity limits, pagination caps, introspection off outside development, sign-in and sign-up limits,
upload checks, cookie flags, CORS. Four gaps were left:

- **No general rate limit.** Only sign-in, sign-up, codes, AI and a few writes were limited. A signed-in script could
  send as many operations as the API could answer.
- **No firewall at the edge.** The AWS module put CloudFront in front of the web and the API with nothing to stop a
  flood or a known exploit pattern before it reached a container.
- **No Content Security Policy** on the web. The other headers (HSTS, `X-Frame-Options`, `nosniff`, referrer and
  permissions policies) were set.
- **A one-hour reader link.** The PDF reader asked for its file's URL with a 60-minute lifetime, because pdf.js keeps
  fetching ranges for as long as the reader is open. §17.1 says at most 15 minutes.

## Decision

**A per-person limit in the API.** Each signed-in person may send `OPERATIONS_PER_MINUTE` (600) GraphQL operations a
minute: ten a second, far above what a session needs.

- The gateway counts them in Redis (`RateLimiter`, key `gql:<user>`), so the limit holds across API instances.
- Past it, the operation is refused before any resolver runs: `RATE_LIMITED`, HTTP 429 and `Retry-After`.
- Signed-out requests are not counted here. Their floods are the edge's to stop, as are floods by address, because
  one address may be a whole campus.
- Sign-up keeps no per-address limit in the API for the same reason: a college lab signs up a class from one address
  on its first day. Mass sign-ups meet the edge's per-address rule, and a new account can do little that reaches
  others until it is verified (publishing, groups, resources).

**A firewall at the edge (AWS WAF, `modules/edge`).** A web ACL on the CloudFront distribution, in us-east-1 as
CloudFront requires:

- a rate rule: 10,000 requests to `/graphql` from one address in any 5 minutes (about 33 a second), then blocked
  (`api_requests_per_address_per_5_minutes`);
- AWS's managed Common and Known Bad Inputs rule sets. The Common set's body-size rule only counts, because a long
  note is a large GraphQL body; files go straight to S3.

It is skipped on the AWS emulator, as CloudFront is.

**A Content Security Policy on the web.**

- Pages are cached (ISR), so a per-request nonce is not possible: inline scripts stay allowed (Next's own and the
  theme script). `next dev` also gets `'unsafe-eval'`; built pages do not.
- Scripts come from the site and Google sign-in (Google, gstatic, Firebase auth) only.
- Plugins (`object-src 'none'`), a changed base URL, forms posting elsewhere and being framed
  (`frame-ancestors 'none'`) are refused. Frames are Google sign-in's only.
- Images, media and connections allow any HTTPS origin, because files come by pre-signed URL from the environment's
  storage. Plain HTTP and WebSocket are added only where the site itself runs on HTTP (the local environment).
  `upgrade-insecure-requests` is on everywhere else.

**Reader links last 15 minutes, and the readers renew them.** `noteFile` signs its URL for the default 15 minutes.
The web and phone readers load the PDF through pdf.js's range transport. When a range request is refused (403 or 400,
an expired signature), they ask `noteFile` again for a fresh URL and retry the range. Reading on for hours works; a
leaked link stops working within 15 minutes.

## Consequences

- A runaway client or script is slowed down to ten operations a second per account, and other people carry on.
  Load tests must spread their virtual users over enough accounts (scripts/load/k6-learners.js uses 100).
- The firewall costs about $5 a month plus $1 a million requests on AWS, when AWS starts. Its rules are visible in
  CloudWatch metrics and sampled requests.
- A new third-party script, frame or font on the web needs a change to the policy in `next.config.ts`.
- `'unsafe-inline'` scripts remain. Moving to nonces would mean giving up cached pages; the other directives still
  shut the common injection routes.
