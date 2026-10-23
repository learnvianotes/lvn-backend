---
id: 2965f658-ea2f-7aab-a99a-0d6c7a992d2d
key: topic:cryptography/ch9
subject: cryptography
topic: ch9
title: TLS / SSL
slug: tls-ssl
order: 1
---

Transport Layer Security: comparing TLS 1.2 vs 1.3 handshakes, and step-by-step connection walkthroughs.

# 1. Comparison: TLS 1.2 vs. TLS 1.3

| Feature | TLS 1.2 Handshake | TLS 1.3 Handshake |
| --- | --- | --- |
| <strong>Round Trips (RTT)</strong> | 2-RTT (requires 2 round trips before sending encrypted data). | 1-RTT (requires only 1 round trip, reducing latency). |
| <strong>Key Exchange</strong> | Supports RSA, Static DH, and Ephemeral DH. | Mandates Ephemeral DH (ECDHE/DHE) to guarantee <strong>Forward Secrecy</strong>. |
| <strong>0-RTT Mode</strong> | Not supported. | Supported (allows returning clients to send encrypted data on the first request). |
| <strong>Cipher Suites</strong> | Supports old, weak ciphers (RC4, 3DES, CBC mode). | Only supports highly secure AEAD ciphers (AES-GCM, ChaCha20-Poly1305). |

# 2. TLS 1.3 Handshake Sequence

```
Client                                                              Server
  |                                                                   |
  |---- ClientHello (Supported ciphers, DH key share A=g^a mod p) --->|
  |                                                                   |
  |                                 [Server selects cipher suite]     |
  |                                 [Calculates Shared Secret]        |
  |<--- ServerHello (Selected cipher, DH key share B=g^b mod p) ------|
  |<--- Server Certificate & Signature (Signed with CA Private Key) --|
  |<--- Finished (Encrypted validation tag) --------------------------|
  |                                                                   |
  | [Client verifies Server Certificate]                              |
  | [Calculates Shared Secret]                                        |
  |---- Finished (Encrypted validation tag) ------------------------->|
  |                                                                   |
  |<================== Encrypted Application Data ===================>|
```
