---
id: b6ec51ef-5392-7ed2-9cc7-e2ccbf32654d
key: topic:cryptography/ch10
subject: cryptography
topic: ch10
title: Message Auth Code
slug: message-auth-code
order: 1
---

Symmetric checksum authentication, hash vulnerabilities, and the HMAC nested mathematical structure.

# 1. Why plain Hashes cannot Authenticate Messages

> [!INFO]
>
> A cryptographic hash function (like SHA-256) guarantees <strong>Integrity</strong>, but not <strong>Authenticity</strong>. If a message is sent over an insecure network along with its hash, an attacker can modify the message, calculate a new hash for the modified message, and replace the original hash. The receiver will compute the new hash and accept the modified message as valid. <br><br> To prevent this, we use a <strong>Message Authentication Code (MAC)</strong>, which requires a <strong>shared secret key</strong> to compute the tag.

# 2. HMAC Mathematical Formula &amp; Design

Constructing a MAC by simply prepending the key to the message (`H(Key || Message)`) is vulnerable to <strong>Length Extension Attacks</strong> in ciphers using the Merkle-Damgård construction (SHA-1, SHA-2). An attacker can append data to the message and compute a valid hash for the extended message without knowing the key.

> [!NOTE]
>
> To prevent length extension attacks, <strong>HMAC</strong> (Hash-based MAC) uses a nested structure with inner and outer padding:
>
> `HMAC(K, m) = H( (K ⊕ opad) || H( (K ⊕ ipad) || m ) )`
>
> • `K`: The shared secret key (padded to the block size of the hash function).<br> • `opad`: Outer padding (constant byte value `0x5C` repeated).<br> • `ipad`: Inner padding (constant byte value `0x36` repeated).<br> • `⊕`: Bitwise XOR operation.<br> • `||`: Concatenation.
