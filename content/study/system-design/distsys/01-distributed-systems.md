---
id: 201449b2-2f5f-78a4-a34e-10f47d3f5cbd
key: topic:system-design/distsys
subject: system-design
topic: distsys
title: Distributed Systems
slug: distributed-systems
order: 1
---

Fundamental protocols, consensus mechanics, failure detection algorithms, and coordination engines powering global scale systems.

# Leader Election &amp; Consensus Protocols

> [!NOTE] Raft Consensus Protocol
>
> Decomposes consensus into Leader Election, Log Replication, and Safety. Nodes operate in 3 states: <strong>Follower</strong>, <strong>Candidate</strong>, or <strong>Leader</strong>.<br><br> • <strong>Election Mechanics:</strong> Randomized election timeouts (150–300ms) prevent split votes. Followers convert to Candidate if no heartbeat received.<br> • <strong>Log Replication:</strong> Leader receives client commands, writes to log, and broadcasts `AppendEntries` RPCs. Uncommitted entries become committed when replicated to a Quorum majority: `Quorum = ⌊N/2⌋ + 1`.<br> • <strong>Leader Completeness:</strong> A candidate must contain all committed entries to win an election (Term numbers enforced).

> [!NOTE] Paxos Protocol (Overview)
>
> The foundational consensus protocol for asynchronous networks with crash-stop failures.<br><br> • <strong>Roles:</strong> Proposers (propose values), Acceptors (vote on values), Learners (learn agreed value).<br> • <strong>Phase 1a (Prepare):</strong> Proposer sends `Prepare(n)` with proposal number <em>n</em>.<br> • <strong>Phase 1b (Promise):</strong> Acceptors respond with `Promise` not to accept proposals `< n`, returning highest proposal accepted.<br> • <strong>Phase 2a (Accept):</strong> If Proposer receives majority promises, sends `Accept(n, v)`.<br> • <strong>Phase 2b (Accepted):</strong> Acceptors accept value if <em>n</em> is still highest seen.<br> • <strong>Multi-Paxos:</strong> Stabilizes a single leader across proposal streams to eliminate Phase 1 round-trips for high throughput.

# Gossip Protocol &amp; P2P Membership

> [!INFO]
>
> <strong>Gossip Protocol:</strong> A decentralized peer-to-peer communication protocol inspired by epidemic spreading. Every node periodically selects random peers and exchanges cluster state. Offers `O(log N)` convergence time, extreme fault tolerance, and zero single point of failure.

> [!NOTE] SWIM Protocol
>
> <strong>Structured Weakness-Detection &amp; Infection-Style Process Group Membership:</strong> Separates failure detection from membership updates. Node A pings Node B. If no ACK, Node A requests <em>k</em> indirect peers to ping Node B. Prevents false failure detections caused by transient network congestion.

> [!NOTE] Anti-Entropy & Dissemination
>
> • <strong>Rumor-Mongering:</strong> Fast infection mode for immediate state changes.<br>• <strong>Anti-Entropy:</strong> Periodic full background comparison (using Merkle Trees) to guarantee eventual consistency across cluster nodes.

# Heartbeats &amp; Failure Detectors

> [!NOTE] Lease Timeouts
>
> Fixed time window heartbeats. Simple but prone to false positives under high garbage collection (GC) pauses or temporary network spikes.

> [!NOTE] Phi Accrual Failure Detector
>
> Calculates a continuous suspicion level `Φ` using historical inter-arrival time distributions:<br> `Φ = -log10(P_later(t - t_last))`<br> Adapts dynamically to fluctuating network latency, enabling configurable sensitivity thresholds without fixed timeouts (used in Cassandra and Akka).

# Service Discovery Architecture

> [!NOTE] Client-Side Discovery
>
> Client queries Service Registry (e.g., Eureka), obtains healthy instance IP endpoints, and executes local load balancing algorithm (e.g., Round Robin, Least Connections). High speed, no proxy bottleneck.

> [!NOTE] Server-Side Discovery
>
> Client issues request directly to a Load Balancer (e.g., AWS ALB, NGINX). Load Balancer queries Service Registry and routes request to healthy target nodes. Hides infrastructure complexity from clients.

# Coordination Tools Comparison

# Distributed Coordination Engines

| Engine | Consensus | Data Model | Key Features | Primary Use Case |
| --- | --- | --- | --- | --- |
| <strong>ZooKeeper</strong> | Zab | Hierarchical ZNodes (Tree) | Watcher events, Ephemeral nodes, Sequential IDs | Kafka metadata (legacy), Hadoop, Solr |
| <strong>etcd</strong> | Raft | Flat KV (B+ Tree with MVCC) | gRPC API, Lease grants, Watch streams, Distributed locks | Kubernetes Control Plane state storage |
| <strong>Consul</strong> | Raft + Serf Gossip | KV Store + Service Registry | Native Service Mesh (Envoy sidecars), DNS interface, Health checks | Microservice discovery &amp; Config management |

> [!NOTE]
>
> <strong>Key Interview Takeaway:</strong> In system design interviews, never state "we use ZooKeeper" without specifying why. ZooKeeper/etcd are designed for <strong>strong consistency and small metadata volumes</strong>. Never use them as primary data stores for high-throughput user traffic.
