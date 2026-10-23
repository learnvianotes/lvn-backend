---
id: ea0de295-cdee-7ab0-9667-ab6e59bba6d0
key: topic:cryptography/ch15
subject: cryptography
topic: ch15
title: Cryptographic Attacks
slug: cryptographic-attacks
order: 1
---

Understanding attack classes: ciphertext-only, chosen-plaintext, timing, and padding oracle attacks.

# 1. Attack Classifications

| Attack Class | Attacker Capability | Example Exploits |
| --- | --- | --- |
| <strong>Ciphertext-Only (COA)</strong> | Attacker only has access to encrypted ciphertexts. | Frequency analysis, brute force key exhaustion. |
| <strong>Known-Plaintext (KPA)</strong> | Attacker has access to pairs of plaintext and corresponding ciphertext. | Linear cryptanalysis, historical decryption of static files. |
| <strong>Chosen-Plaintext (CPA)</strong> | Attacker can obtain ciphertexts for any arbitrary plaintexts they choose. | Differential cryptanalysis, block size determination. |
| <strong>Chosen-Ciphertext (CCA)</strong> | Attacker can obtain decryptions of any arbitrary ciphertexts they choose. | Manger's attack on RSA, Padding Oracle attacks. |

# 2. Side-Channel and Timing Attacks

> [!INFO]
>
> • <strong>Side-Channel Attack:</strong> Analyzes physical characteristics of the cryptographic implementation (e.g. power consumption, electromagnetic emissions) rather than the math itself.<br> • <strong>Timing Attack:</strong> Measures how long a cryptographic operation takes to complete. If string comparisons return early on mismatches (e.g., `"apple" === "apricot"` returns on index 2), an attacker can guess signature signatures byte-by-byte. <br><br> <strong>Mitigation:</strong> Always use <strong>constant-time comparison</strong> algorithms for secret keys and MAC tags.

# 3. Padding Oracle Attack

A padding oracle attack targets block ciphers in CBC mode. If the decryption server returns different error messages for invalid padding vs. invalid keys/signatures, an attacker can modify ciphertext bytes and send them to the server to decrypt messages byte-by-byte without knowing the key.
