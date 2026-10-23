---
id: ea4aa364-650c-715a-90e5-eb55402348c4
key: topic:computer-networks/osi
subject: computer-networks
topic: osi
title: OSI Model — Overview
slug: osi-model-overview
order: 1
---

Open Systems Interconnection: the standard mental map for every layer of networking, top to bottom.

> [!INFO] Definition
>
> The <strong>OSI model</strong> is a conceptual, standardized framework that describes how data moves through a network in 7 distinct layers, each with a specific responsibility. It's "open" because it's vendor-neutral — any system following it can interoperate with any other.

Data physically only exists as electrical/light/radio signals — the OSI model is the human-friendly abstraction layered on top so engineers can reason about "what's happening" without tracking every electron. Each layer talks logically to its counterpart layer on the other machine, but physically only ever talks to the layer directly above/below it on the same machine.

> [!NOTE] Application
>
> L7
>
> What the user-facing software does

> [!NOTE] Presentation
>
> L6
>
> Formatting, encryption, translation

> [!NOTE] Session
>
> L5
>
> Setting up &amp; managing connections

> [!NOTE] Transport
>
> L4
>
> TCP/UDP, segmentation, ports

> [!NOTE] Network
>
> L3
>
> IP addressing, routing

> [!NOTE] Data Link
>
> L2
>
> MAC addresses, framing

> [!NOTE] Physical
>
> L1
>
> Raw bits as electrical/light signals

# Memory aid

A classic mnemonic, top-down: <strong>A</strong>ll <strong>P</strong>eople <strong>S</strong>eem <strong>T</strong>o <strong>N</strong>eed <strong>D</strong>ata <strong>P</strong>rocessing — Application, Presentation, Session, Transport, Network, Data Link, Physical.

# You ↔ Friend — the whole stack in one picture

Think of two people (computers) wanting to talk. On your side, data goes <em>down</em> the stack (A→P→S→T→N→D2→Physical), gets physically transmitted, and on the friend's side it goes back <em>up</em> the stack in reverse. Each layer adds its own header as data descends (this is called <strong>encapsulation</strong>), and each corresponding layer strips its header back off as data ascends on the receiving side (<strong>decapsulation</strong>).

App ↓ Presentation ↓ Session ↓ Transport ↓ Network ↓ Data Link ↓ Physical

> [!NOTE]
>
> ...signal travels across the wire/air...

Physical ↑ Data Link ↑ Network ↑ Transport ↑ Session ↑ Presentation ↑ App (friend receives)
