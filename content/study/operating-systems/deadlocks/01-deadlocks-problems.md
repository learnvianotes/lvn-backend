---
id: 9cbad38d-6a7c-7dc1-9ce1-ef8905f62400
key: topic:operating-systems/deadlocks
subject: operating-systems
topic: deadlocks
title: Deadlocks & Problems
slug: deadlocks-problems
order: 1
---

Necessary conditions, avoidance safety checks, Banker's algorithm logic, and synchronization problems.

# Deadlock Mechanics

> [!NOTE] What is a deadlock? Draw a Resource Allocation Graph.
>
> A <strong>Deadlock</strong> is a system state where a set of processes are permanently blocked because each process holds a resource and waits for another resource held by another process in the set.

> [!NOTE] The 4 Necessary Coffman Conditions
>
> All four must hold simultaneously for a deadlock to exist:
>
> 1. <strong>Mutual Exclusion:</strong> At least one resource must be held in a non-shareable mode (only one process can use it at a time).
> 2. <strong>Hold and Wait:</strong> A process must be holding at least one resource and requesting new ones that are currently held by other processes.
> 3. <strong>No Preemption:</strong> Resources cannot be forcibly seized; they are released only voluntarily by the holding process.
> 4. <strong>Circular Wait:</strong> Process P0 waits for resource held by P1, which waits for P2, ..., which waits for P0.

> [!NOTE] Deadlock Prevention
>
> Eliminate at least one Coffman condition. The most practical is preventing <strong>Circular Wait</strong> by imposing a global ordering on all resources. A process can only request resource $R\_i$ if it holds no resources numbered $&gt; i$.

> [!NOTE] Deadlock Avoidance
>
> The OS dynamically evaluates resource requests using the <strong>Banker's Algorithm</strong>. If granting a request leads to an <strong>Unsafe State</strong> (which could potentially lead to deadlock), the request is deferred.

> [!NOTE] How do databases avoid and detect deadlocks?
>
> - <strong>Detection (Wait-For Graph):</strong> The database runs a background thread that periodically inspects active transactions. It draws a wait-for graph (nodes are transactions) and checks for cycles. If a cycle is detected, it aborts one transaction (rollback) to release its locks.
>
> - <strong>Avoidance (Timestamps):</strong>
>
>   - <em>Wait-Die:</em> Older transaction is allowed to wait. Younger transaction dies (abort and restart).
>   - <em>Wound-Wait:</em> Older transaction immediately preempts ("wounds") the younger transaction. Younger transaction waits if older requests it.

# Starvation, Deadlock, &amp; Livelock

| Concept | Process State | CPU Usage | System Progress |
| --- | --- | --- | --- |
| <strong>Deadlock</strong> | Blocked/Waiting | 0% | Permanently Halted |
| <strong>Livelock</strong> | Active / Running | 100% (Busy-waiting loop) | Permanently Halted |
| <strong>Starvation</strong> | Ready / Waiting | 0% for starved task | System makes progress for other tasks |

> [!NOTE] Examples illustrating the difference:
>
> - <strong>Deadlock:</strong> Two cars meet head-on on a single-lane bridge. Neither can move forward, neither will back up. They sit forever.
> - <strong>Livelock:</strong> Two polite people meet in a hallway. They both step to their left to let the other pass, then both step to their right, constantly moving back and forth in perfect synchronization but making no forward progress.
> - <strong>Starvation:</strong> A small customer waits at a busy shop. Large, wealthy customers keep arriving, and the shopkeeper repeatedly serves them first. The small customer is ignored indefinitely but the shop operates fine.

# Classic Synchronization Problems

> [!NOTE] Producer-Consumer
>
> A shared bounded queue exists. The producer places items in it, and the consumer removes them. Primitives needed:<br> • \`mutex\` (protect queue integrity).<br> • \`empty\` counting semaphore (track empty slots, init to N).<br> • \`full\` counting semaphore (track filled slots, init to 0).

> [!NOTE] Readers-Writers
>
> A database needs to support concurrent readers but exclusive writers. Primitives needed:<br> • \`writeLock\` mutex (protect database access).<br> • \`mutex\` (protect the reader count variable).<br> • \`readCount\` integer tracking active reader threads.

> [!NOTE] Dining Philosophers
>
> 5 philosophers sit around a table, each needing two chopsticks to eat. If everyone picks up their left chopstick first, a circular wait deadlock occurs. Resolved by resource ordering: the 5th philosopher picks up the right chopstick first.

> [!NOTE] Sleeping Barber
>
> A barber sleeps if no customers are in the shop. Customers enter: if chairs are available, they sit and wait; if not, they leave. Coordinate barber sleep-wake cycles with customers using semaphores and bounded wait variables.
