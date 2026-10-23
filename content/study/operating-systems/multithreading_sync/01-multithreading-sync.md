---
id: fcfae5da-ed4d-7459-b015-ac098324267d
key: topic:operating-systems/multithreading_sync
subject: operating-systems
topic: multithreading_sync
title: Multithreading & Sync
slug: multithreading-sync
order: 1
---

Concurrency vs Parallelism, shared data race conditions, memory safety, and lock styles.

# Concurrency Fundamentals

> [!NOTE] Concurrency
>
> The execution of multiple tasks overlapping in time. On a single-core CPU, this is achieved by rapidly switching execution context (interleaving processes), creating the <strong>illusion</strong> of simultaneous progress.

> [!NOTE] Parallelism
>
> The execution of multiple tasks at the exact same physical instant. This requires multi-core, multi-processor hardware where distinct threads execute on separate physical CPU cores simultaneously.

> [!NOTE] Race Condition
>
> A scenario where multiple threads access and manipulate the same shared resource concurrently, and the final value depends on the exact ordering of execution. Consider a simple count increment:
>
> `Thread A (Read): count = 0`<br>`Thread B (Read): count = 0`<br>`Thread A (Add):  count + 1 = 1`<br>`Thread B (Add):  count + 1 = 1`<br>`Thread A (Write): count becomes 1`<br>`Thread B (Write): count becomes 1 (Lost update! Output should be 2)`

> [!NOTE] Critical Section Requirements
>
> The code segment containing shared memory modifications. A valid solution must satisfy:
>
> - <strong>Mutual Exclusion:</strong> Only one thread can execute in the critical section at any instant.
> - <strong>Progress:</strong> If no thread is in the critical section, only threads waiting to enter can decide which one gets to enter. The decision cannot be delayed indefinitely.
> - <strong>Bounded Waiting:</strong> There is a limit on the number of times other threads can enter their critical sections before a waiting thread's request is granted (no starvation).

# Locks, Semaphores &amp; Atomicity

> [!NOTE] Mutex
>
> Mutual Exclusion Lock. A locking primitive with an owner. Only the thread that locks the mutex can release/unlock it. Good for simple critical section protection.

> [!NOTE] Semaphore
>
> A signaling primitive containing an integer counter. Non-owner based: any thread can call \`signal()\` to increment the semaphore, waking up waiting threads.

> [!NOTE] Binary Semaphore vs. Mutex
>
> While a Binary Semaphore is restricted to values 0 and 1, it differs fundamentally from a Mutex:
>
> - <strong>Ownership:</strong> Mutexes have ownership. The thread that locks a mutex \*must\* unlock it. Semaphores can be signaled (unlocked) by any thread.
> - <strong>Use Case:</strong> Mutexes are for protecting data structures. Semaphores are for scheduling/producer-consumer signaling.
> - <strong>Reentrancy:</strong> Mutexes can support recursive locking (a thread can lock it multiple times). Semaphores deadlock if locked again by the same thread.

> [!NOTE] Spin Lock
>
> A lock where a waiting thread continuously polls the lock status in a tight loop. Wastes CPU cycles (busy waiting), but avoided context switch cost. Used in kernel code where lock hold times are guaranteed to be extremely brief.

> [!NOTE] Read-Write Lock
>
> Allows multiple threads to read shared data simultaneously (shared lock), but only one thread to write at a time (exclusive lock). Boosts read-heavy application throughput.

# Advanced Memory Synchronization

> [!NOTE] Atomicity
>
> An operation is atomic if it completes as a single, indivisible step relative to all other threads. Hardware primitives like <strong>Compare-And-Swap (CAS)</strong> provide atomicity.

> [!NOTE] Memory Visibility
>
> CPU cores cache values in L1/L2 caches. Writes by Core A are not instantly seen by Core B unless variables are declared \`volatile\` or memory barrier synchronization instructions are run.

> [!NOTE] False Sharing
>
> Occurs when two threads running on different CPU cores modify independent variables that happen to share the same cache line. Cores repeatedly invalidate each other's cache lines, destroying speed.

> [!NOTE] Thread-Safety & Reentrant Code
>
> <strong>Thread Safety:</strong> A design guarantee that code functions correctly when called by multiple concurrent threads without side effects.
>
> <strong>Reentrancy:</strong> A stronger condition: code is reentrant if it can be interrupted in the middle of execution, called again (re-entered) by another thread, and both calls complete safely. Reentrant code completely avoids global/static variables and only modifies stack/arguments.
