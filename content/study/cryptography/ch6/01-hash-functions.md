---
id: cec063ee-1325-74fd-8cd8-345755b2c846
key: topic:cryptography/ch6
subject: cryptography
topic: ch6
title: Hash Functions
slug: hash-functions
order: 1
---

One-way mathematical maps, preimage resistance properties, the Avalanche Effect, and the Birthday Paradox collision math.

# 1. Core Properties of Cryptographic Hashes

> [!INFO]
>
> A cryptographic hash function takes an arbitrary-sized input message and map-digests it into a fixed-size bit string (e.g. 256 bits for SHA-256). It must satisfy:
>
> - <strong>Pre-image Resistance:</strong> One-way nature. Given hash `h`, it must be computationally impossible to reconstruct any input `x` such that `H(x) == h`.
> - <strong>Second Pre-image Resistance:</strong> Given a specific input `x1`, it must be impossible to find a different input `x2` that hashes to the same value: `H(x1) == H(x2)`.
> - <strong>Collision Resistance:</strong> It must be impossible to find \*any\* two arbitrary distinct inputs `x` and `y` such that `H(x) == H(y)`.

# 2. The Avalanche Effect

The <strong>Avalanche Effect</strong> means a single bit change in the input completely alters the output digest, making the new hash appear uncorrelated with the original. This prevents attackers from guessing the input based on changes in the output.

> [!NOTE]
>
> <strong>Example using SHA-256:</strong><br> • `SHA-256("test")` = `9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`<br> • `SHA-256("test1")` = `1b4f90f239384752c00223df1f82f2c8d239103e3f43cd3f21822cd15b0f00b21`

# 3. Collision Math: The Birthday Paradox

Why finding collisions is much easier than finding the original input for a given hash.

> [!INFO]
>
> The <strong>Birthday Paradox</strong> shows that in a room of just 23 random people, there is a 50.7% chance that at least two share the same birthday, even though there are 365 possible birthdays. Applying this to hash collisions: <br> For a hash function with an output size of `n` bits (giving 2<sup>n</sup> possible hashes), the number of random inputs needed to find a collision with a 50% probability is not 2<sup>n</sup>, but only:
>
> `Operations to Collision ≈ sqrt(2^n) = 2^(n/2)`
>
> Consequently: <br>• For <strong>MD5</strong> (128-bit): Collisions can be found in just 2<sup>64</sup> iterations (practically broken). <br>• For <strong>SHA-256</strong> (256-bit): Collisions require 2<sup>128</sup> operations, which is still computationally infeasible today.
