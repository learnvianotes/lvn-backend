---
id: 5d6b95a5-0e25-767f-a8f6-19422972700e
key: topic:computer-networks/dns
subject: computer-networks
topic: dns
title: DNS Resolution
slug: dns-resolution
order: 1
---

How a human-readable name like google.com turns into a machine-routable IP address.

> [!INFO] Definition
>
> <strong>DNS</strong> maps human-friendly domain names to the numeric IP addresses computers actually use to route data — without it, you'd need to memorize IP addresses for every website.

# Anatomy of a domain name

Take `mail.google.com`:

| Part | Example | Role |
| --- | --- | --- |
| Sub-domain | `mail` | A specific service within the domain |
| Second-level domain (SLD) | `google` | The registered organization name |
| Top-level domain (TLD) | `com` | The broad category/registry (.com, .org, .io) |

The TLD-specific name servers are managed under root authority by <strong>ICANN</strong> (Internet Corporation for Assigned Names and Numbers) — note that domains are technically <em>rented</em> (registered for a renewable period), never permanently "bought."

# The resolution chain — root → TLD → domain

Root DNS Servers → .io / .org / .com (TLD servers) → student.io / commonsense.org / google.com (SLD)

The <strong>root DNS servers</strong> are the first point of contact in global DNS resolution — they don't know the final IP, but they know which TLD server to point to next, which in turn points to the specific domain's name servers.

# Full step-by-step lookup, typing google.com

1. Your computer first checks its <strong>own local cache</strong> — if you've visited recently, the IP may already be saved locally.
2. If not cached, the request goes to your <strong>ISP's local DNS server</strong> — the first external point of contact.
3. If the local DNS server doesn't have it cached either, it queries a <strong>root server</strong>.
4. The root server doesn't know the IP, but acknowledges and redirects to the correct <strong>TLD server</strong> (e.g. the .com server).
5. The TLD server returns the IP address of `google.com`'s actual name server.
6. Your computer finally connects directly to `google.com`'s server using the resolved IP.

> [!TIP] Try it
>
> Run `dig google.com` in a terminal to see the full DNS resolution trace yourself, or `man dig` to read the manual for all available options.
