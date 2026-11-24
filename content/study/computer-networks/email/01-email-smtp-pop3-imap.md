---
id: ea49b775-9a48-771b-b022-d4f4d15567a8
key: topic:computer-networks/email
subject: computer-networks
topic: email
title: Email — SMTP/POP3/IMAP
slug: email-smtp-pop3-imap
order: 1
---

Three protocols, three different jobs in the lifecycle of an email.

# Sending — SMTP

> [!INFO] Definition
>
> <strong>SMTP</strong> (Simple Mail Transfer Protocol) is the application-layer protocol used to <em>send</em> email between mail servers, running over TCP so no data is lost in transit.

Sender → Sender's SMTP server → Receiver's SMTP server → Receiver

To find which server handles mail for a domain, a special DNS record is queried — the <strong>MX (Mail Exchange) record</strong>, checkable via `dig -type=mx gmail.com`.

# Receiving (download &amp; delete) — POP3

> [!INFO] Definition
>
> <strong>POP3</strong> (Post Office Protocol v3) runs on <strong>port 110</strong>. The client authenticates with the POP server, downloads all mail to the local device, then typically <strong>deletes it from the server</strong>, and closes the session.

> [!NOTE]
>
> Limitation: because mail is downloaded and removed, POP3 doesn't sync well across multiple devices — your inbox on your phone and laptop can end up out of sync.

# Receiving (multi-device sync) — IMAP

> [!INFO] Definition
>
> <strong>IMAP</strong> (Internet Message Access Protocol) allows your email to remain on the server and stay synced across multiple devices — instead of downloading and deleting, it mirrors the server-side state on every device.
