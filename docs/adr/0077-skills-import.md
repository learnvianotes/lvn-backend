# ADR-0077: Skills import from public identifiers a teacher proves are theirs

- Status: Accepted
- Date: 2026-10-14
- Deciders: Backend, Web and Mobile agents
- Spec sections: ADR-0012 (the Skills tab), ADR-0044 (the manual tab), ADR-0073 (teacher onboarding), ADR-0074
  (`SafeFetcher`), ADR-0058/0059 (the AI gateway); Phase 7 plan, "Research this plan rests on"

## Context

ADR-0012 promised that a teacher's Skills tab could be filled from public identifiers: ORCID, OpenAlex, GitHub and a
personal or faculty website. Three rules came with it:
- Only identifiers the teacher proves are theirs.
- Imported items land as drafts the teacher reviews.
- Every imported item shows where it came from and when.

ADR-0044 built the manual tab. A save replaces every item, so it would also wipe anything imported.

The Phase 7 plan's research decides what can be proven without paid APIs or credentials:
- **GitHub:** a public profile is readable without credentials (60 requests an hour from one address).
- **A website:** proven by a meta tag in its head, as Search Console does. robots.txt is obeyed (RFC 9309).
- **ORCID:** proven only by ORCID sign-in. That needs a client registered under the owner's own iD, and the free
  Public API is for non-commercial use only, so ORCID waits for the owner's choice.
- **OpenAlex:** an author can be trusted only through a linked ORCID.
- **LinkedIn and Google Scholar:** never fetched. LinkedIn's terms forbid scraping, and Scholar has no API and its
  robots.txt disallows it.

## Decision

1. **Who.**
   - Verified teachers only: `globalRole` TEACHER and not suspended. An applicant (ADR-0073) fills the tab by hand and
     imports once approved. The editor says so; it does not offer a button that would refuse.
   - Opt-in, one identifier at a time. LearnViaNotes never searches the web for a person.
2. **Identifiers and their proof** (`users.ExternalIdentity`: kind, value, a proof code, `verifiedAt`, `checkedAt`,
   `fetchedAt`, `lastError`; one per teacher, kind and value).
   - **GITHUB** (a login): the code is in the profile's bio, or in the description of one of their latest 30 public
     gists. It is read from GitHub's REST API, a fixed host. `GITHUB_TOKEN` is used when configured, to raise the
     hourly limit.
   - **WEBSITE** (an http(s) address): the page at that address has
     `<meta name="learnvianotes-verification" content="CODE">` in its head. The page is read through `SafeFetcher`
     (public addresses only, 1 MB, 5 s). The site's robots.txt, for the user agent `LearnViaNotes`, must allow it.
   - **ORCID and OPENALEX** come in P7c2 behind configuration. They are not offered until ORCID's client is set, so
     nothing in the apps leads to a refusal.
   - The proof code is `lvn-` and ten random characters, kept for re-checks.
   - Checking is limited to 10 a day per teacher, since each check spends GitHub's shared hourly allowance.
3. **Import.**
   - A proven identifier is read by a worker job (`users.skills`).
   - **GitHub:**
     - The profile (name, bio, company, blog).
     - The 30 most recently updated public repositories that are not forks. The 10 most starred become **PROJECT**
       items straight from GitHub's data (name, description, link), without AI.
     - The `ai` context's `READ_SKILLS` task reads the bio and repositories (languages, descriptions, topics) into
       **SKILL** items.
   - **WEBSITE:** the page's title, description and visible text, cut to 12,000 characters. `READ_SKILLS` reads them
     into SKILL, QUALIFICATION, EXPERIENCE and **PUBLICATION** items.
   - **AI sees only the fetched public text**, fenced as content. It runs as platform work under the monthly AI budget.
     With AI not configured, GitHub's projects still arrive, and the editor says skills will follow once AI is set up.
   - **Items arrive as drafts** (`TeacherSkill.status` DRAFT), with `source`, `sourceUrl`, `fetchedAt` and
     `identityId`. At most 30 per import.
   - A new import replaces that identifier's drafts. A published item with the same kind and name only gets its
     `fetchedAt` renewed, so curation is never undone.
4. **Review.**
   - The teacher publishes or discards drafts, one at a time or all together. **Drafts never publish themselves.**
   - Published imported items show on the public tab with their source and date: "From GitHub · checked 14 Oct 2026",
     with a link to the source.
   - A manual save replaces only manual items (ADR-0044's replace-all stays within MANUAL). The 60-item limit counts
     published items of every source.
5. **Refresh and removal.**
   - A daily job takes proven identifiers last fetched more than 30 days ago: it checks the proof again and imports
     again. A teacher may also refresh one at once (within the daily limit).
   - **A proof that is gone** leaves the identifier unproven: `verifiedAt` cleared and `lastError` says why. Its items
     leave the public tab until it is proven again; nothing is deleted.
   - Removing an identifier deletes it and every item from it.
6. **Data.**
   - `ExternalIdentity` is new.
   - `TeacherSkill` gains:
     - `status` DRAFT | PUBLISHED, with manual items PUBLISHED;
     - `sourceUrl`, `fetchedAt` and `identityId`, which cascades;
     - the kinds PROJECT and PUBLICATION;
     - the sources GITHUB, WEBSITE, ORCID and OPENALEX.
   - The data export gains `data/users/teacher-profile.json`: the profile, every item with its source, and the
     identifiers without their codes. Until now the export left the Skills tab out.
   - Erasure: both cascade from the person. Account deletion itself is not built yet; Phase 7's exit records it.

## Consequences

- Teachers can show open-source work and what their own pages say, with provenance, and nobody types it twice.
- GitHub's unauthenticated limit is shared by the whole server. A busy deployment sets `GITHUB_TOKEN`. P7d's GitHub
  App is for repository activity, not this.
- Fetched pages can say anything. The AI turns them into short items the teacher must approve, and the public tab
  shows only what they approved. A profile with false claims is reported like any profile (ADR-0051).
- robots.txt support lives in `SafeFetcher`, ready for later fetchers.
- P7c2 adds ORCID sign-in (`/authenticate`) and OpenAlex works through a linked ORCID, off until the owner registers
  the ORCID client and chooses its terms.
