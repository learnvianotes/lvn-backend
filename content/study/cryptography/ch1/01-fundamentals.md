---
id: 3691ffc8-5449-7e05-9df2-605a6a755675
key: topic:cryptography/ch1
subject: cryptography
topic: ch1
title: Fundamentals
slug: fundamentals
order: 1
---

Deep dive into cryptographic vocabulary, mathematical models of encryptions, and basic shift operations.

# 1. Core Vocabulary &amp; Concepts

> [!INFO]
>
> • <strong>Plaintext (P):</strong> The original, readable message string or byte buffer before being processed by a cipher. E.g., `"HELLO"`.<br> • <strong>Ciphertext (C):</strong> The scrambled, unreadable output of an encryption algorithm. To unauthorized parties, it should appear as cryptographically random noise.<br> • <strong>Encryption (E):</strong> The mathematical operation mapping plaintext and a key to ciphertext: `E(P, K) = C`.<br> • <strong>Decryption (D):</strong> The process of reconstructing plaintext from ciphertext using a key: `D(C, K) = P`. For a correct cipher, `D(E(P, K), K) == P` holds true.<br> • <strong>Cipher:</strong> The mechanical, electrical, or mathematical algorithm containing the logical steps for encryption and decryption.<br> • <strong>Cryptographic Key (K):</strong> A variable parameter (usually a string of random bits) that alters the cipher output. Its secrecy is the sole guarantor of confidentiality (Kerckhoffs's Principle).<br> • <strong>Cryptanalysis:</strong> The science of hacking or reverse engineering, cracking, or decyphering ciphertext without authorization or prior possession of the correct keys.<br> • <strong>Cryptology:</strong> The overarching discipline combining both cryptography (designing ciphers) and cryptanalysis (breaking ciphers).

# 2. Mathematical Models &amp; Kerckhoffs's Principle

Modern systems assume the algorithm is public. The security of the system rests entirely on keeping the key secret.

> [!NOTE]
>
> <strong>Kerckhoffs's Principle (1883):</strong> A cryptographic system should be secure even if everything about the system, except the key, is public knowledge. This is the foundation of open security standards (AES, RSA, TLS) where public review ensures no backdoors exist.

`Symmetric Cipher Equation: C = E_K(P) <=> P = D_K(C)`

If the key is chosen from a key space of size 2<sup>N</sup> (where N is the key length in bits), an attacker performing a brute-force search must search through 2<sup>N</sup> combinations. A key size of 128 bits yields a key space of 3.4 x 10<sup>38</sup> combinations, making brute force physically impossible with current computing boundaries.

# 3. Detailed Step-by-Step Example: Caesar Cipher

The simplest substitution cipher: shifting letters along the modulo circle.

> [!INFO]
>
> We map the English alphabet to numbers modulo 26: `A = 0, B = 1, C = 2, ..., Z = 25`. The encryption shift formula is:
>
> `C_i = (P_i + K) mod 26`
>
> The decryption shift formula is:
>
> `P_i = (C_i - K) mod 26`

> [!NOTE]
>
> <strong>Trace of Plaintext "HELLO" with Key K = 3:</strong><br> • <strong>H</strong> -&gt; Index 7. Encrypt: (7 + 3) mod 26 = 10 -&gt; <strong>K</strong><br> • <strong>E</strong> -&gt; Index 4. Encrypt: (4 + 3) mod 26 = 7 -&gt; <strong>H</strong><br> • <strong>L</strong> -&gt; Index 11. Encrypt: (11 + 3) mod 26 = 14 -&gt; <strong>O</strong><br> • <strong>L</strong> -&gt; Index 11. Encrypt: (11 + 3) mod 26 = 14 -&gt; <strong>O</strong><br> • <strong>O</strong> -&gt; Index 14. Encrypt: (14 + 3) mod 26 = 17 -&gt; <strong>R</strong><br> <strong>Plaintext:</strong> `HELLO`<br> <strong>Ciphertext:</strong> `KHOOR`
