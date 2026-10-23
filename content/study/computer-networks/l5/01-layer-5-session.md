---
id: 06adf48c-745c-728f-ab54-380a6e1a642b
key: topic:computer-networks/l5
subject: computer-networks
topic: l5
title: Layer 5 — Session
slug: layer-5-session
order: 1
---

The connection manager, coordinating and keeping conversations in sync.

> [!INFO] Definition
>
> The <strong>Session Layer</strong> manages the dialog between two host computers. It establishes, coordinates, maintains, and terminates connections (sessions) between local and remote applications, keeping track of authorization, session tokens, and connection synchronization.

PDU: Data / Session

Focus: Dialogue &amp; Checkpoints

Hardware: CPU / Auth Servers

# Core Purpose &amp; Function

While the lower layers manage the delivery of raw packets or segments, the Session Layer is the high-level manager that understands the \*lifetime\* of the conversation. It handles user authentication, session token mapping, and coordinates which party is allowed to talk (dialogue control).

# Key Responsibilities

- <strong>Session Creation &amp; Teardown</strong>: Gracefully opening a communication channel, authenticating users, assigning session IDs, and tearing down the channel when done.
- <strong>Synchronization &amp; Checkpointing</strong>: Injecting checkpoints (recovery markers) into a data stream. If a 100MB download is interrupted at 80MB, session checkpoints allow the transfer to resume from the last marker instead of restarting from scratch.
- <strong>Dialogue Control</strong>: Coordinating half-duplex (alternating sender/receiver) or full-duplex (simultaneous) transmission streams so packets don't overlap in confusing sequences.

# Common Technologies &amp; Protocols

| Protocol / Standard | Description | Role in Session Management |
| --- | --- | --- |
| <strong>SOCKS</strong> | Socket Secure Protocol | Routes packets through proxy servers, establishing authenticated sessions. |
| <strong>RPC / gRPC Sessions</strong> | Remote Procedure Call | Makes remote servers look like local functions, managing transaction states. |
| <strong>NetBIOS</strong> | Network Basic Input/Output System | Sets up sessions and connections between local Windows computers. |
| <strong>PPTP / L2TP Sessions</strong> | Point-to-Point Tunneling Protocols | Establishes persistent, encrypted tunnels for VPN sessions. |

# Analogy: The Courier Clerk &amp; Order Authorization

> [!TIP] Amazon Analogy
>
> The Session Layer is like the <strong>clerk checking your ID and payment authorization</strong> before shipping or releasing the package. They make sure you have an active account (session token) and coordinate the transaction, ensuring the handoff happens only after authentication is confirmed.

# Dialogue Modes &amp; Session Lifecycle

> [!TIP] Pros
>
> - Maintains state across stateless lower-layer protocols.
> - Ensures session isolation and security via token management.
> - Protects large transfers from network dropouts via checkpoint markers.

> [!DANGER] Cons
>
> - Adds state management overhead on servers (scaling stateful sessions is complex).
> - Sessions can hang or timeout incorrectly if connection drops are not handled gracefully.
