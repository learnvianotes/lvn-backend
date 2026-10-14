# Respond to a leakage report

When: anyone reports that they could see something they should not: another person's private note, a group's posts
from outside the group, someone's email or age, a file by a guessed link. This includes a security researcher's
report, a moderator's finding, or a failing security test in production. Treat every report as real until shown
otherwise.

## Within the hour

1. **Acknowledge** the reporter (if a person) and ask for exactly what they saw, where, when, and as whom. Do not ask
   them to try again.
2. **Contain.** Find the channel (§17.1 lists them: GraphQL query, mutation, search, recommendations, file URL, RAG,
   subscription, SEO page) and close it:
   - a note or file exposed: take the note offline (`moderation.md`, "take a note offline"); file URLs expire within
     15 minutes on their own;
   - a field or resolver: deploy a fix, or switch the feature off by its flag;
   - search or recommendations: reindex (`reindexSearch`) after the fix, so cached documents are rebuilt;
   - a secret: `rotate-secrets.md`.
3. **Preserve evidence.** Export the relevant logs (request ids, viewer ids, times) before they age out. Note the
   audit log entries (`users.AuditLog`) of anyone who changed the content's visibility.

## Within the day

4. **Reproduce in a test.** Add a case to the security suite (`apps/api/test/security/`) that fails before the fix and
   passes after. It runs on every pull request from then on.
5. **Scope.** From the logs, who read the exposed data, how much, and since when?
6. **Decide on notice.** Under India's DPDP Act and the GDPR where it applies, a personal-data breach may need notice
   to the regulator and to the people affected, within 72 hours of finding it. The owner and counsel decide; the
   on-call writes down the facts they need: what data, how many people, since when, contained when.

## After

7. **Incident write-up** in `docs/incidents/<date>-<name>.md`: timeline, cause, fix, the new test, and follow-ups.
8. **Thank the reporter**, and tell them when it is fixed.
