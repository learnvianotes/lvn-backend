---
id: c3a4ee63-bab3-706f-9631-2084965920f4
key: topic:computer-networks/intro
subject: computer-networks
topic: intro
title: What is a Network
slug: what-is-a-network
order: 1
---

Where the whole subject starts: machines, wires, and an agreement about how to talk to each other.

> [!INFO] Definition
>
> A <strong>computer network</strong> is a collection of computers connected together so they can exchange data. The <strong>internet</strong> is the largest example — a network of networks spanning the planet.

A playful backronym sometimes used for "computer": <strong>C</strong>ommonly <strong>O</strong>riented <strong>M</strong>achine <strong>P</strong>articularly used for <strong>T</strong>raining, <strong>E</strong>ducation and <strong>R</strong>esearch — not the literal etymology, but a useful way to remember that a computer at its core is a general-purpose machine for processing information, and a network is what happens when many of those machines are wired together to share it.

# A short history — how the internet started

Before the internet, computers were isolated islands. The story of how that changed:

ARPA founded → ARPANET (research network) → TCP adopted → More hosts join → World Wide Web

- <strong>ARPA</strong> (Advanced Research Projects Agency) — a U.S. government agency that funded early research into how computers could communicate with each other over long distances.
- <strong>ARPANET</strong> — the first real packet-switched network ARPA built, originally linking research institutions including MIT, Stanford, UCLA, and the University of Utah, with early links partly carried over satellite connections.
- <strong>TCP</strong> (Transmission Control Protocol) — the rule-set invented to let independent, dissimilar computer networks reliably exchange data with each other. This is the single biggest unlock: once everyone agreed on TCP, networks could interconnect instead of staying isolated.
- Over years, more institutions, companies, and eventually homes connected — the network of networks became <strong>the Internet</strong>.
- <strong>WWW</strong> (World Wide Web) — not the same thing as the internet. The internet is the physical/logical network of connected computers; the Web is a collection of linked documents (pages) that live on top of that network, accessed via HTTP.

> [!TIP] Common confusion
>
> "Internet" and "Web" are often used interchangeably but aren't the same: the internet is the infrastructure (cables, routers, protocols); the Web is one application that runs on that infrastructure, alongside others like email, file transfer, and video calls.

# How a request actually travels

At the simplest level, when Computer A wants to talk to Computer B — possibly on the other side of the planet — the message doesn't teleport. It is broken down, addressed, and physically carried across a chain of intermediate devices until it reaches the destination, and a reply makes the same kind of journey back.

> [!TIP] Scenario — typing google.com
>
> You type `google.com` in a browser and hit enter → your computer turns that into a <strong>request</strong> → the request is sent through your router, your ISP, and a chain of other networks → it reaches Google's <strong>server</strong> → the server sends back a <strong>response</strong> (the webpage) → your browser renders it. This client → server round trip is the basic shape of almost everything that happens on a network.
