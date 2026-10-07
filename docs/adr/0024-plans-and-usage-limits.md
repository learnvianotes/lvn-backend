# ADR-0024: No pricing yet; usage limits come from plans stored as data

- Status: Accepted (owner decision, 2026-10-08)
- Date: 2026-10-08
- Spec sections: §1 (out of scope), §8.1 (quotas), §10.1 (AI quotas)
- Amends: ui-reference item 1 (Pricing link)

## Context

The owner removed the Pricing link for now, and plans to introduce **plans with user limits** later. §1 keeps
payments out of this build but asks for a schema that can add them without rewrites.

## Decision

- **No pricing page, no payments** in this build (§1 stands).
- **Every limit is data, not code.** `Plan` (only `FREE` today) has `Entitlement(planId, key, limit)` rows; a user's
  plan comes from `UserPlan`, an organisation's from `OrganizationPlan` (which carries seat limits). Keys are
  `LimitKey` in `@lvn/contracts`: storage, daily AI tokens, PDF pages per month, groups owned, members per group,
  classrooms owned, members per classroom, project workspaces, daily exports and imports, organisation seats.
- Today's numbers become FREE-plan entitlements by role: storage 5 GB (student) / 20 GB (teacher) (§8.1); AI 200k /
  1M tokens a day (§10.1); others set before Phase 3 launches.
- One `EntitlementService` in `users` answers "limit and usage for this key"; every context asks it before creating
  something limited (the usual quota check, §8.1). Plans and limits are cached briefly in Redis like feature flags
  (§6.3) — never permission decisions.
- `viewer.limits` shows each limit and current usage so the apps can show "3 of 5 groups" and warn early.

## Consequences

Introducing paid plans later is new rows plus a billing integration — no change to how features check limits.
