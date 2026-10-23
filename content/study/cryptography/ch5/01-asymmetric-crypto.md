---
id: adae5a34-19bc-7150-a73a-ad34025a2b1c
key: topic:cryptography/ch5
subject: cryptography
topic: ch5
title: Asymmetric Crypto
slug: asymmetric-crypto
order: 1
---

Public/private keypairs, prime integer arithmetic, RSA key generation proof, and Elliptic Curve security benefits.

# 1. Asymmetric Model Concept

> [!INFO]
>
> Symmetric ciphers suffer from the <strong>Key Distribution Problem</strong>: how do two remote parties securely share a key without a secure channel? Asymmetric cryptography solves this by using mathematically linked keypairs:
>
> - <strong>Public Key:</strong> Shared openly with the world. Anyone can use it to encrypt messages or verify signatures.
> - <strong>Private Key:</strong> Kept secret by the owner. Only the owner can use it to decrypt messages or sign payloads.

# 2. Mathematical Principles &amp; RSA Keygen Proof

RSA (Rivest-Shamir-Adleman) relies on the <strong>Trapdoor One-Way Function</strong> of prime factorization: multiplying two large primes is easy, but factoring the resulting modulus back into primes is computationally infeasible.

> [!INFO]
>
> <strong>RSA Key Generation Algorithm:</strong><br> 1. Select two prime integers: `p = 61` and `q = 53`.<br> 2. Compute modulus:
>
> `n = p * q = 61 * 53 = 3233`
>
> 3\. Compute Euler Totient:
>
> `φ(n) = (p - 1)(q - 1) = 60 * 52 = 3120`
>
> 4\. Choose public exponent `e` such that `gcd(e, φ(n)) == 1`. Let `e = 17`.<br> 5. Calculate private exponent `d` as the modular multiplicative inverse: `d * e ≡ 1 mod φ(n)`. Using the Extended Euclidean Algorithm:
>
> `d = 17^-1 mod 3120 = 2753`
>
> 6\. Public Key is `(e=17, n=3233)`. Private Key is `(d=2753, n=3233)`.

> [!NOTE]
>
> <strong>RSA Encryption &amp; Decryption Example:</strong><br> Let message be `M = 65`.<br> • <strong>Encrypt:</strong>
>
> `C = M^e mod n = 65^17 mod 3233 = 2790`
>
> • <strong>Decrypt:</strong>
>
> `M = C^d mod n = 2790^2753 mod 3233 = 65`

# 3. Elliptic Curve Cryptography (ECC)

Stronger security bounds using curve coordinates (y² = x³ + ax + b) with significantly smaller key sizes.

| Security Strength (Bits) | Symmetric Key Size (AES) | Equivalent RSA Key size | Equivalent ECC Key size |
| --- | --- | --- | --- |
| <strong>80 (Legacy)</strong> | 80 bits | 1024 bits | 160 bits |
| <strong>112 (Deprecated)</strong> | 112 bits | 2048 bits | 224 bits |
| <strong>128 (Secure)</strong> | 128 bits | 3072 bits | 256 bits |
| <strong>256 (Highly Secure)</strong> | 256 bits | 15360 bits | 512 bits |

By shifting to 256-bit ECC, devices gain equivalent security to 3072-bit RSA while reducing processing overhead, transmission packet sizes, and memory usage. This is critical for mobile networks, smart cards, and IoT sensors.
