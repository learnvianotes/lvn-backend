---
id: 0116325f-5fbd-7463-936a-9e9e5356908e
key: topic:cryptography/threat_model
subject: cryptography
topic: threat_model
title: Threat Model
slug: threat-model
order: 1
---

Evaluating the architecture against standard cybersecurity attack vectors and exploits.

# Attack Vector Analysis

> [!NOTE] Man-in-the-Middle (MITM)
>
> <strong>Threat:</strong> The server acts as a proxy, returning a fake public key to User A so it can decrypt messages.<br><br><strong>Mitigation:</strong> Visual safety numbers (computed from hashes of public keys) are compared out-of-band by users, or public keys are signed by a Certificate Authority.

> [!NOTE] Compromised Server Database
>
> <strong>Threat:</strong> An attacker steals all records from the messages table.<br><br><strong>Mitigation:</strong> Payloads are stored as ciphertext. Only metadata (sender ID, time) is exposed. Message content remains secure.

> [!NOTE] Replay Attacks
>
> <strong>Threat:</strong> An attacker intercepts an encrypted message packet and forwards it to the recipient repeatedly.<br><br><strong>Mitigation:</strong> The encrypted packet contains a sequence counter and timestamp. Recipient rejects duplicated or expired sequences.

> [!NOTE] XSS Key Leakage
>
> <strong>Threat:</strong> A cross-site scripting script accesses local IndexedDB variables and exfiltrates private keys.<br><br><strong>Mitigation:</strong> Keys are kept in-memory (volatile storage) or loaded only within a sandbox Web Worker that restricts DOM access.

# Forward Secrecy Definition

> [!NOTE]
>
> <strong>Forward Secrecy:</strong> If an attacker compromises the private keys of User A or User B today, they must not be able to decrypt past conversations. This is achieved by generating <strong>ephemeral keys</strong> that are destroyed after a session is closed.
