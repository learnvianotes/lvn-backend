---
id: 4c935732-b897-77ac-84df-02a1ed629dd1
key: topic:cryptography/ch16
subject: cryptography
topic: ch16
title: Random Numbers (RNG)
slug: random-numbers-rng
order: 1
---

Entropy, predictability, PRNGs, CSPRNGs, and Linux kernel entropy pools.

# 1. Types of Random Number Generators

> [!NOTE] PRNG
>
> Pseudo-Random Number Generator. Uses mathematical formulas to generate sequences of numbers from a seed value. Fast but deterministic; if the seed is known, the entire sequence is predictable.

> [!NOTE] CSPRNG
>
> Cryptographically Secure PRNG. Guaranteed to pass statistical randomness tests and be mathematically unpredictable. Essential for generating keys, salts, and session tokens.

> [!NOTE] TRNG
>
> True Random Number Generator. Uses physical noise (e.g., thermal fluctuation, radio interference) as entropy. Slow but truly non-deterministic.

# 2. Operating System Entropy Pools

How Linux collects entropy and exposes random devices to userspace.

> [!INFO]
>
> The Linux kernel gathers environmental noise (keyboard input, mouse movements, disk seek times) into an entropy pool.
>
> - `/dev/random`: Blocks execution if the entropy pool runs dry. Highly secure but slow.
> - `/dev/urandom`: Does not block; if entropy runs dry, it uses a CSPRNG to generate values. Recommended for almost all production security tasks.

# 3. Predictable Hashing Disasters (e.g., Dual\_EC\_DRBG)

> [!WARNING]
>
> In 2013, documents leaked by Edward Snowden confirmed that the NSA had inserted a backdoor into the <strong>Dual\_EC\_DRBG</strong> standard (an elliptic curve PRNG). By choosing specific public curve parameters, they could predict future random outputs, allowing them to decrypt TLS connections. <br><br> <strong>Developer Rule:</strong> Never use predictable PRNGs like `Math.random()` in Javascript for security tasks, as their internal states can be reconstructed from just a few outputs. Always use `crypto.getRandomValues()`.
