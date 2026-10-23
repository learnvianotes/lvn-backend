---
id: a2b3ddcc-ffab-7df6-b2cd-4a5018b23df6
key: topic:cryptography/files
subject: cryptography
topic: files
title: File Level Breakdown
slug: file-level-breakdown
order: 1
---

Explaining exact file roles, exported methods, dependencies, and security relevance inside secure E2EE chat modules.

# Key System Files

| File Path | Core Exported Functions | Dependencies | Security Relevance |
| --- | --- | --- | --- |
| <strong>utils/crypto.js</strong> | `generateKeys()`, `deriveSharedKey()`, `encryptGCM()`, `decryptGCM()` | `crypto-web-api` / Node.js `crypto` | Provides cryptographic primitives. Ensures standard AES-GCM and Curve25519 usage. |
| <strong>controllers/keyManager.js</strong> | `storePrivateKey()`, `getDecryptedPrivateKey()`, `rotateSessionKey()` | IndexedDB API, PBKDF2 utilities | Handles secure storage and memory isolation of user key bundles. |
| <strong>server/socket.js</strong> | `initSocketServer()`, `verifySocketJWT()`, `handleConnections()` | `socket.io`, `jsonwebtoken` | Authenticates inbound real-time channels and manages transport namespaces. |
| <strong>handlers/messageHandler.js</strong> | `onSendMessage()`, `persistPayload()`, `ackDelivery()` | `models/Message`, `socketInstance` | Routes encrypted payloads to rooms and saves raw ciphertext metadata. |
| <strong>models/Message.js</strong> | `MessageSchema`, `indexes` | Mongoose ORM / Prisma | Defines database constraints for ciphertext, IV, and authTag. Ensures no plaintext columns. |
