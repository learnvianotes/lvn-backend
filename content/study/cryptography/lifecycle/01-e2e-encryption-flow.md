---
id: cb9910bb-f311-75c1-b2db-0597e1a55e08
key: topic:cryptography/lifecycle
subject: cryptography
topic: lifecycle
title: E2E Encryption Flow
slug: e2e-encryption-flow
order: 1
---

The cryptographic progression of a message from local generation, socket routing, database storage, and remote decryption.

# Sequential Steps

> [!INFO]
>
> <strong>1. User Registration &amp; Key Generation:</strong><br> During signup, the client browser generates a public/private asymmetric key pair (Curve25519 for key exchange).
>
> - <strong>Public Key:</strong> Sent to the server and persisted in the `users` database column.
> - <strong>Private Key:</strong> Encrypted locally using a key derived from the user's password using PBKDF2/scrypt, then stored in IndexedDB.

> [!INFO]
>
> <strong>2. User Login &amp; Key Retrieval:</strong><br> The user authenticates with the server to retrieve their encrypted private key bundle. The local client uses the entered password to derive the key-encryption-key (KEK), decrypting the private key locally into volatile web memory.

> [!INFO]
>
> <strong>3. Conversation Initialization:</strong><br> When User A starts a chat with User B:
>
> 1. User A requests User B's public key from the backend.
> 2. User A performs an <strong>ECDH (Elliptic Curve Diffie-Hellman)</strong> operation with User B's public key and User A's private key to derive a `shared_secret`.
> 3. The `shared_secret` is run through a HKDF (HMAC-based Key Derivation Function) to derive a 256-bit symmetric session key: `aes_session_key`.

> [!INFO]
>
> <strong>4. Message Transmission (Encrypt &amp; Send):</strong><br> User A encrypts the plaintext payload using `AES-256-GCM` with the derived `aes_session_key` and a random IV. The socket client emits:
>
> `socket.emit("send_message", {`<br>`  recipientId: "userB_uuid",`<br>`  ciphertext: "d7a8f9...",`<br>`  iv: "3e4b...",`<br>`  authTag: "fa2b..."`<br>`});`

> [!INFO]
>
> <strong>5. Message Persistence:</strong><br> The socket server validates User A's authentication token (JWT), saves the encrypted packet (ciphertext, IV, authTag) in the SQL DB, and forwards the event to User B's active socket room.

> [!INFO]
>
> <strong>6. Message Decryption:</strong><br> User B receives the packet via their socket connection. User B computes the same session key using their private key and User A's public key, then decrypts the ciphertext using `AES-256-GCM` with the provided IV and validates the integrity tag.

# E2EE Sequential Flow Diagram

```
+----------+             +----------+             +----------+             +----------+
|  User A  |             | Backend  |             | Database |             |  User B  |
+----------+             +----------+             +----------+             +----------+
     |                        |                        |                        |
     |--- Get B's PubKey ---->|                        |                        |
     |<-- Return B's PubKey --|                        |                        |
     |                        |                        |                        |
     |--[ Derives AES Key ]--|                        |                        |
     |--[ Encrypts Message ]--|                        |                        |
     |                        |                        |                        |
     |---- Send Encrypted --->|                        |                        |
     |   {ct, iv, tag, to:B}  |---- Persist Record --->|                        |
     |                        |    {ct, iv, tag, to:B} |                        |
     |                        |                        |                        |
     |                        |---------------- Forward Encrypted ------------->|
     |                        |                 {ct, iv, tag, from:A}           |
     |                        |                        |                        |
     |                        |                        |                  [ Derives Key ]
     |                        |                        |                  [ Decrypts & ]
     |                        |                        |                  [ Verifies ]
```
