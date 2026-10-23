---
id: e292c725-3262-7398-8cec-c48621676dc5
key: topic:cryptography/ch14
subject: cryptography
topic: ch14
title: Password Security
slug: password-security
order: 1
---

Protecting password databases: salts (preventing rainbow tables), peppers, and key stretching ciphers.

# 1. Why Simple Hashes Fail for Passwords

> [!INFO]
>
> Hash functions like MD5 or SHA-256 are designed to be fast, which makes them insecure for password storage. An attacker with a stolen database can use GPUs to test millions of passwords per second. <br><br> Furthermore, without unique salting, users with identical passwords will have identical hashes, allowing attackers to crack multiple accounts simultaneously using <strong>Rainbow Tables</strong> (pre-computed lists of common passwords and their hashes).

# 2. Salt vs. Pepper

> [!TIP] Cryptographic Salt
>
> - A unique, cryptographically random string generated for each user.
> - Appended to the password before hashing and stored in plaintext in the database alongside the hash.
> - <strong>Purpose:</strong> Ensures identical passwords yield different hashes, preventing rainbow table attacks.

> [!DANGER] Cryptographic Pepper
>
> - A secret key appended to all passwords before hashing.
> - Stored separately from the database (e.g. in environment variables or an HSM).
> - <strong>Purpose:</strong> Prevents attackers from cracking passwords even if they steal the database, as they still lack the pepper.

# 3. Key Stretching Algorithms

Using slow, memory-hard algorithms to resist brute-force attacks.

> [!NOTE] bcrypt
>
> Based on the Blowfish cipher. Uses a configurable cost parameter to increase the number of hashing rounds, slowing down brute-force attempts.

> [!NOTE] scrypt
>
> Designed to require a large amount of memory, making it highly resistant to parallel attacks using custom hardware (ASICs/GPUs).

> [!NOTE] Argon2id
>
> The winner of the Password Hashing Competition (2015). Provides configurable memory, time, and parallelization parameters. Highly secure.

# 4. Code Implementation: Hashing with bcrypt

A standard implementation using Node.js to hash and verify passwords securely.

```javascript filename:JavaScript
const bcrypt = require('bcrypt');

// Hash a password
async function hashPassword(password) {
  const saltRounds = 12; // Cost factor (2^12 rounds)
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}

// Verify a password match
async function verifyPassword(password, storedHash) {
  const match = await bcrypt.compare(password, storedHash);
  return match;
}
```
