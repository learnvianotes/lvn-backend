---
id: 32a609d5-aea1-7696-8248-e50454dac2f6
key: topic:computer-networks/topology
subject: computer-networks
topic: topology
title: Network Topologies
slug: network-topologies
order: 1
---

The five classic shapes you can wire a network into — and exactly why each one wins or loses in practice.

A <strong>topology</strong> is the arrangement/layout of how nodes (computers, devices) are connected to each other in a network. The choice of topology directly affects cost, reliability, and how a failure behaves.

# 1. Bus Topology

All devices are connected to a single shared central cable (the "bus" / backbone). Every device taps into this one line to send and receive data.

> [!TIP] Pros
>
> - Very cheap to set up — minimal cabling
> - Easy to extend by adding a new tap
> - Good for small, simple networks

> [!DANGER] Cons
>
> - If the single backbone cable breaks anywhere, the entire network is split or goes down
> - All devices share the same line → unnecessary collisions/calls when many devices transmit at once
> - Hard to troubleshoot — a fault anywhere affects everyone

# 2. Ring Topology

Each device connects to exactly two neighbors, forming a closed loop. Data travels around the ring, hop by hop, until it reaches its destination.

> [!TIP] Pros
>
> - Predictable, orderly data flow (token-passing variants avoid collisions entirely)
> - Performs consistently even with many devices, unlike a shared bus

> [!DANGER] Cons
>
> - A single broken link can disrupt the entire ring (unless dual-ring redundancy is used)
> - Adding/removing a device usually requires briefly breaking the ring
> - One slow or failed device can hold up the whole loop

# 3. Star Topology

Every device connects individually to one central device (a hub or switch). All communication passes through this central point.

> [!TIP] Pros
>
> - One device failing doesn't affect any other — easy isolation of faults
> - Easy to add/remove devices without disrupting the network
> - Centralized management and monitoring

> [!DANGER] Cons
>
> - If the central device (hub/switch) fails, the <strong>entire network goes down</strong> — single point of failure
> - More cabling required than bus topology

> [!TIP] In practice
>
> Most modern home and office LANs are star topologies — every device cables back to a central Wi-Fi router or Ethernet switch.

# 4. Tree Topology (Bus + Star hybrid)

A hierarchical structure: multiple star networks are connected together along a common bus backbone — essentially "stars hanging off a bus," forming a parent-child structure of hubs.

> [!TIP] Pros
>
> - Scales well — easy to add new branches/departments without redesigning the whole network
> - Fault isolation within a branch, similar to star
> - Matches how real organizations are structured (HQ → departments → individual machines)

> [!DANGER] Cons
>
> - Still depends on the backbone bus — if that breaks, branches get isolated from each other
> - More complex to wire and maintain than pure star or pure bus

# 5. Mesh Topology

Every device is connected directly to every other device. Maximum redundancy — there are multiple paths between any two nodes.

> [!TIP] Pros
>
> - Extremely fault-tolerant — many alternate paths if one link fails
> - No single point of failure
> - High performance, no shared-bus contention

> [!DANGER] Cons
>
> - <strong>Expensive</strong> — cabling grows roughly with n² as devices are added
> - <strong>Scalability issues</strong> — becomes physically impractical past a small number of nodes

# Quick comparison

| Topology | Single point of failure? | Cost | Best for |
| --- | --- | --- | --- |
| <strong>Bus</strong> | Yes (backbone) | Lowest | Tiny, temporary networks |
| <strong>Ring</strong> | Yes (any link) | Low–Medium | Predictable token-based LANs |
| <strong>Star</strong> | Yes (central hub) | Medium | Home/office LANs (most common today) |
| <strong>Tree</strong> | Partial (per branch) | Medium–High | Organizations with departments/branches |
| <strong>Mesh</strong> | No | Highest | Mission-critical backbones, military/ISP cores |
