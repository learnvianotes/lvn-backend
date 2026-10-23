# Moderation: the first moderator, taking a note offline, the word list

Spec §15.1, ADR-0037. The queue is the web page `/admin/moderation`, open to PLATFORM_ADMIN accounts.

## Make the first platform admin

Roles are never self-selected; later admins are made with `setGlobalRole` by an admin. The first one is set in the
database. The person signs up normally first, then (local environment shown; on Lightsail, as the deploy user in
`/opt/lvn`, run the same SQL with `docker compose exec -T postgres psql -U lvn -d lvn -c "…"`):

```sh
infra/local-vm/vm.sh ssh 'docker exec lvn-local-postgres psql -U lvn -d lvn -c "UPDATE users.\"User\" SET \"globalRole\" = '"'"'PLATFORM_ADMIN'"'"' WHERE email = '"'"'owner@example.com'"'"' RETURNING id, handle"'
```

They sign out and in again (the role is read when the session starts) and find "Moderation queue" on their account
page.

## Take a note offline

In the queue: **Remove** (or **Hide**) with a reason; the author is told and may appeal once. A note that is not in the
queue can be reported first by any account, which puts it there.

When the web app is unavailable, the same effect from the database, recorded in the audit log by hand:

```sql
UPDATE notes."Note" SET moderation = 'REMOVED', "moderationReason" = '<reason the author sees>' WHERE id = '<note id>';
INSERT INTO users."AuditLog" (id, "actorId", action, "targetType", "targetId", metadata, "createdAt")
VALUES (gen_random_uuid(), NULL, 'moderation.remove', 'NOTE', '<note id>', '{"reason":"<reason>","manual":true}', now());
```

Public pages refresh within the revalidation window; search and recommendations follow the `NoteUnpublished` event,
which the SQL route does not send — prefer the queue.

## Change the word list

Set `MODERATION_WORDS_FILE` to a file of `REASON: phrase` lines (`SPAM`, `HARASSMENT`, `SEXUAL`, `SELF_HARM`, `HATE`,
`COPYRIGHT`, `OTHER`; `#` comments) and restart the API. Phrases match whole words, ignoring case. Notes already public
are not re-screened; only notes going public and new public versions are.
