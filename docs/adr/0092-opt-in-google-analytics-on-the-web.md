# ADR-0092: Google Analytics on the web, only after the visitor allows it

- Status: Accepted (owner decision, 2026-10-20: the launch keeps Google Analytics, behind opt-in)
- Date: 2026-10-21
- Deciders: Web agent; owner
- Spec sections: §15.2 (Cookies / tracking: "No third-party trackers on the student app; analytics is first-party and
  pseudonymous"); ADR-0007 §4 (no Firebase Analytics)

## Context

The owner keeps Google Analytics for the College/Interview launch, as the old app's launch build does
(`release/college-launch`: opt-in, consent kept on the device and shared between tabs). §15.2 rules out third-party
trackers, so the rewrite needs a decision before it carries the same thing.

## Decision

**Off unless configured.** `NEXT_PUBLIC_GA_MEASUREMENT_ID` (web, optional) names the Google Analytics 4 property.
Without it nothing loads, no banner asks and no setting shows. That is the default in every environment, including
the phone, which never runs it.

**Nothing before consent.**

- A banner asks once: "Allow" and "Don't allow" weigh the same, and it links to the Privacy Policy.
- The choice is kept on the device, and the profile page changes it at any time.
- Until the visitor allows it, Google's script is not even downloaded: no cookie, no request.
- Withdrawing turns collection off at once and deletes the `_ga` cookies.
- A choice made in one tab applies in every open tab of the site (the `storage` event).

**Collected, and how.** GA4 through `gtag.js`, not Firebase Analytics: ADR-0007's line holds.

- Consent mode: `analytics_storage` granted only with consent; ad storage, ad user data and ad personalisation are
  always denied.
- Page views are sent by hand on each navigation, with the path only. Addresses can carry one-time tokens (email links,
  sign-in callbacks), so no query string or fragment is sent.
- No user id, name, email or note content is ever sent (§10.1).

**Children.** A device that was refused an account as under-age (ADR-0091) has its choice set to "don't allow".

**The Content Security Policy** (ADR-0090) allows Google's tag and collection hosts only when the variable is set.

## Consequences

- §15.2's Cookies/tracking row is amended: a third-party analytics tool may run on the web, only with the visitor's
  opt-in and only where the deployment sets it. The Privacy Policy describes it and its retention.
- Turning it off is leaving the variable empty and rebuilding: no code change.
- Google Analytics' own retention setting (Admin → Data retention) must match what the Privacy Policy states
  (lvn-web `config/legal.ts` → `RETENTION.analyticsMonths`).
