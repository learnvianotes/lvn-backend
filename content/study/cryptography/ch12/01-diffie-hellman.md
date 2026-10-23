---
id: 8e5aec71-0c31-7aeb-92ff-7e1b467e471b
key: topic:cryptography/ch12
subject: cryptography
topic: ch12
title: Diffie-Hellman
slug: diffie-hellman
order: 1
---

Negotiating shared secrets over public channels, mathematical validation proof, and MITM vulnerabilities.

# 1. Diffie-Hellman Exchange Walkthrough

> [!INFO]
>
> Diffie-Hellman allows two remote parties (Alice and Bob) to establish a shared symmetric session key over insecure public channels without sending keys directly.

> [!NOTE]
>
> <strong>Step-by-step Math:</strong><br> 1. Alice and Bob agree on public parameters: a prime modulus `p = 23` and generator `g = 5`.<br> 2. Alice chooses private exponent `a = 6`, computes public value `A`:
>
> `A = g^a mod p = 5^6 mod 23 = 8`
>
> 3\. Bob chooses private exponent `b = 15`, computes public value `B`:
>
> `B = g^b mod p = 5^15 mod 23 = 19`
>
> 4\. Alice and Bob swap public values `A` and `B`.<br> 5. Alice computes shared secret `S`:
>
> `S = B^a mod p = 19^6 mod 23 = 2`
>
> 6\. Bob computes shared secret `S`:
>
> `S = A^b mod p = 8^15 mod 23 = 2`
>
> Both arrive at the identical shared secret `2` without exposing their private exponents!

# 2. Mathematical Proof of Equality

`Alice's calculation: S_Alice = B^a mod p = (g^b mod p)^a mod p = g^(b*a) mod p`<br>` Bob's calculation: S_Bob = A^b mod p = (g^a mod p)^b mod p = g^(a*b) mod p`<br><br>` Since multiplication is commutative (a * b = b * a), g^(a*b) ≡ g^(b*a) mod p.`

# 3. Man-in-the-Middle (MITM) Vulnerability

> [!WARNING]
>
> <strong>Active MITM Vulnerability:</strong> Anonymous Diffie-Hellman does not authenticate the identities of the participants. An active attacker (Eve) can intercept A's public share and exchange a separate key with Alice, while simultaneously exchanging a key with Bob, decrypting and re-encrypting all traffic passing between them. <br><br> <strong>Mitigation:</strong> Authenticate key exchanges by signing the public key shares using digital signatures and certificates (e.g. ECDHE-RSA or ECDHE-ECDSA in TLS).
