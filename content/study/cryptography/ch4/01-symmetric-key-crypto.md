---
id: e3a5e111-79b8-7c9d-b58f-60e81a579cae
key: topic:cryptography/ch4
subject: cryptography
topic: ch4
title: Symmetric Key Crypto
slug: symmetric-key-crypto
order: 1
---

Stream vs Block ciphers, operational modes (ECB vs CBC vs GCM), and padding standards.

# 1. Stream Ciphers vs. Block Ciphers

> [!TIP] Stream Ciphers (e.g. ChaCha20, RC4)
>
> - Encrypts plaintext 1 bit/byte at a time.
> - Generates a pseudo-random keystream XORed directly with plaintext.
> - Extremely fast, low latency, ideal for real-time video/audio streaming.
> - <strong>Critical Rule:</strong> NEVER reuse the same key and IV/nonce (destroys security instantly).

> [!DANGER] Block Ciphers (e.g. AES, DES, Blowfish)
>
> - Encrypts data in fixed-sized chunks called blocks (typically 64 or 128 bits).
> - Requires padding (PKCS#7) if plaintext is not an exact multiple of the block size.
> - Requires a Mode of Operation to secure multiple blocks of data.
> - Less vulnerable to key-reuse attacks than stream ciphers (though still highly vulnerable in CBC mode).

# 2. Cipher Modes of Operation

| Mode | Description | Parallelization | Security Level &amp; Rationale |
| --- | --- | --- | --- |
| <strong>ECB (Electronic Codebook)</strong> | Encrypts each block independently. Identical plaintext blocks yield identical ciphertext blocks. | Yes (both Encrypt &amp; Decrypt) | UNSAFE: Leaks structural patterns (e.g., the ECB Penguin image leak). Never use in production. |
| <strong>CBC (Cipher Block Chaining)</strong> | XORs each plaintext block with the preceding ciphertext block before encryption. Requires an IV. | Decrypt only | LEGACY: Vulnerable to <strong>Padding Oracle Attacks</strong> (Manger's/Lucky13) if error messages leak timing details. |
| <strong>CTR (Counter Mode)</strong> | Turns a block cipher into a stream cipher by encrypting an incrementing counter value. | Yes (both Encrypt &amp; Decrypt) | SECURE: High performance, but does not check data integrity. |
| <strong>GCM (Galois/Counter Mode)</strong> | Combines CTR mode with a Galois MAC tag computation to provide <strong>AEAD</strong> (Authenticated Encryption). | Yes (both Encrypt &amp; Decrypt) | RECOMMENDED: Guarantees confidentiality and data integrity. Modern standard for TLS/Web. |

# 3. Padding Standards (PKCS#7)

> [!INFO]
>
> <strong>PKCS#7 Padding:</strong> Adds bytes to the end of the plaintext so its total length matches a block boundary. The value of each added byte is equal to the number of padded bytes. <br><br> • If 3 bytes of padding are needed for a 16-byte block, the padded bytes are: `0x03 0x03 0x03`.<br> • If the plaintext is already an exact multiple of the block size, a <strong>full block of padding</strong> is appended (e.g., 16 bytes of `0x10`) to prevent decryption ambiguity.

# 4. AES Block Structure and Rounds

> [!NOTE]
>
> AES (Advanced Encryption Standard) is a Rijndael block cipher. It maps a 128-bit (16-byte) block into a 4x4 matrix of bytes called the <strong>State</strong>. Each round (10 for AES-128, 12 for AES-192, 14 for AES-256) applies four steps:
>
> 1. <strong>SubBytes:</strong> Substitution S-box mapping bytes non-linearly to prevent mathematical algebraic exploits.
> 2. <strong>ShiftRows:</strong> Circular shift transpositions of the State rows (row 0: 0 bytes, row 1: 1 byte, row 2: 2 bytes, row 3: 3 bytes).
> 3. <strong>MixColumns:</strong> Matrix multiplication over Galois Fields (GF(2<sup>8</sup>)) to diffuse changes across columns.
> 4. <strong>AddRoundKey:</strong> Bitwise XOR of the State with the subkey derived from the master key.
