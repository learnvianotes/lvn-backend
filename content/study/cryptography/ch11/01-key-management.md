---
id: c3fc6136-0fbf-74ef-abfa-2c5253802abd
key: topic:cryptography/ch11
subject: cryptography
topic: ch11
title: Key Management
slug: key-management
order: 1
---

The key lifecycle: generation entropy rules, key storage security (HSMs), rotation strategies, and split secrets.

# 1. Key Lifecycle Phases

> [!NOTE] 1. Generation & Entropy
>
> Keys must be generated using high-entropy random number generators (CSPRNG) inside secure boundary hardware modules. Weak entropy allows attackers to predict generated keys.

> [!NOTE] 2. Secure Storage
>
> Private keys should never be stored in plain configurations or application source code. Always use dedicated Hardware Security Modules (HSMs) or cloud Key Management Services (KMS).

> [!NOTE] 3. Rotation
>
> Keys must be rotated periodically (e.g. every 90 days) to limit the amount of ciphertext encrypted under a single key, reducing the impact if a key is compromised.

> [!NOTE] 4. Destruction
>
> When a key is retired or revoked, it must be securely deleted from all systems and media to prevent decryption of historical archives (ensuring Forward Secrecy).

# 2. KMS &amp; HSM Hardware Boundaries

> [!INFO]
>
> • <strong>HSM (Hardware Security Module):</strong> A physical tamper-resistant device that generates, stores, and protects keys. Keys never leave the HSM in plaintext; all cryptographic operations (encryption, decryption, signing) are executed inside the module's secure memory boundary.<br> • <strong>KMS (Key Management Service):</strong> A cloud service (e.g. AWS KMS, GCP KMS) that manages key lifecycles and enforces access policies (IAM) for keys, while using HSMs on the backend.

# 3. Shamir's Secret Sharing (SSS)

To secure highly sensitive keys (like root keys), <strong>Shamir's Secret Sharing</strong> splits a secret into `N` unique shares. The secret can only be reconstructed if a threshold of `T` shares (where `T ≤ N`) are combined, preventing a single point of failure or compromise.

`SSS relies on polynomial interpolation: any point on a 2D graph can reconstruct a polynomial of degree T-1 if T distinct coordinates are known.`
