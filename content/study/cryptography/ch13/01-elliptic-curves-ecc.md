---
id: 74d8e5c6-f2a4-76ea-800e-5ac442065474
key: topic:cryptography/ch13
subject: cryptography
topic: ch13
title: Elliptic Curves (ECC)
slug: elliptic-curves-ecc
order: 1
---

Coordinate geometry, point arithmetic equations, and curve standards (secp256k1 &amp; Curve25519).

# 1. Elliptic Curve Coordinates &amp; Point Arithmetic

> [!INFO]
>
> Elliptic curve cryptography utilizes curves defined by the algebraic equation:
>
> `y² = x³ + ax + b`
>
> The coordinates of points on the curve form a group under a defined addition operation:
>
> - <strong>Point Addition (P + Q):</strong> Draw a line through points P and Q. The line will intersect the curve at a third point, R. Reflect R across the x-axis to find the sum point: `P + Q = -R`.
> - <strong>Point Doubling (2P):</strong> Draw a tangent line to the curve at point P. The line will intersect the curve at another point. Reflect this point across the x-axis to find `2P`.

# 2. The Discrete Logarithm Problem on Curves (ECDLP)

Given a starting point `P` (generator) and a scalar multiplier `k` (private key), we compute the public key point `Q = k * P` by repeatedly doubling and adding. <br><br> The security of ECC relies on the difficulty of finding the scalar `k` given only points `P` and `Q`. This is the <strong>Elliptic Curve Discrete Logarithm Problem (ECDLP)</strong>, for which there are no known sub-exponential time solving algorithms.

# 3. Industry Standard Curves

> [!NOTE] secp256k1
>
> A Koblitz curve defined by `y² = x³ + 7 mod p`. Used in Bitcoin, Ethereum, and other cryptocurrencies due to its efficient point addition properties.

> [!NOTE] Curve25519
>
> A Montgomery curve optimized for fast ECDH key exchanges. Designed by Daniel J. Bernstein, it is highly resistant to timing attacks and is the standard curve for SSH, TLS 1.3, Signal, and WireGuard.
