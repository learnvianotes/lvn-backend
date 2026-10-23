---
id: 9f7a10b2-e2df-792b-9e06-7b375f1ca942
key: topic:system-design/googledocs
subject: system-design
topic: googledocs
title: Google Docs
slug: google-docs
order: 1
---

Real-time multi-user collaborative text editing with sub-50ms synchronization latency.

# OT (Operational Transformation) vs CRDT

> [!NOTE] Operational Transformation (OT)
>
> Requires a centralized server to sequence operations. Operations (Insert/Delete) are transformed against concurrent operations based on revision history. Used by Google Docs.

> [!NOTE] CRDT (Conflict-free Replicated Data Types)
>
> Decentralized state-based or operation-based mathematical data structures. Concurrent edits commute naturally without requiring a central server sequencer (e.g., Yjs, Automerge).
