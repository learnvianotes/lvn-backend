# Support contact is support@learnvianotes.in

Not a schema break. `UserError.supportEmail` is still one nullable string.

## What changed

`AGE_RESTRICTED` and a blocked sign-in name `SUPPORT_EMAIL` (default `support@learnvianotes.in`). They no longer name
the earliest platform admin's own address.

Transactional mail is sent as `MAIL_FROM` (default `LearnViaNotes <no-reply@learnvianotes.in>`) with `Reply-To` and a
footer of `MAIL_REPLY_TO` (default `support@learnvianotes.in`).

Show "contact admin at \<supportEmail\>" as before. The value is the support inbox.
