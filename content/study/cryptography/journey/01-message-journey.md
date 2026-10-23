---
id: c3542172-b7e0-76ae-8e27-5ee91d561ac8
key: topic:cryptography/journey
subject: cryptography
topic: journey
title: Message Journey
slug: message-journey
order: 1
---

Following a single text string "Hello" from User A's terminal keystrokes to User B's screen render.

# Step-by-Step Execution Path

1. <strong>Client A Keystroke:</strong> User A types "Hello" and presses send. The front-end triggers `sendMessage("Hello", "recipient_uuid")`.
2. <strong>Symmetric Key Lookup:</strong> The front-end fetches the 256-bit symmetric session key for the target from local memory.
3. <strong>Encryption:</strong> The crypto handler generates 12 random bytes (IV) and encrypts the string "Hello" into a base64 ciphertext (e.g. `+x09jF/3...`) and extracts a 16-byte auth tag.
4. <strong>Socket Emission:</strong> The client emits the packet over a TLS-encrypted WebSocket channel to the node backend.
5. <strong>Backend Interception:</strong> The message controller extracts the packet, logs routing metadata, and executes an INSERT query to database to save the ciphertext.
6. <strong>Relay routing:</strong> The socket server routes the payload to User B's active socket channel: `socket.to("user_recipient_uuid").emit("receive_message", packet)`.
7. <strong>Decryption:</strong> User B's browser triggers the event, retrieves the session key, and executes the WebCrypto GCM decryption. The output string "Hello" is rendered on the viewport.
