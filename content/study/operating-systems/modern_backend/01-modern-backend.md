---
id: 31d94c2a-0f21-7ea2-86b5-b9126d9d8f24
key: topic:operating-systems/modern_backend
subject: operating-systems
topic: modern_backend
title: Modern Backend
slug: modern-backend
order: 1
---

Mapping operating system concepts to distributed backend systems, web servers, and databases.

# Web Server Mechanics

> [!NOTE] Why are thread pools used in web servers? What happens under load?
>
> A thread pool bounds the maximum resources consumed by a server process. Thread creation is slow, so keeping warm thread pools ready avoids latency spikes.
>
> <strong>What happens under load:</strong>
>
> - When simultaneous request traffic exceeds the thread pool size, incoming connection jobs are placed in an OS-level queue (backlog buffer).
> - If load continues to climb and the socket backlog buffer fills, the kernel drops or refuses connections, returning TCP resets or timed-out errors to clients.

> [!NOTE] Why doesn't every request get a new thread?
>
> As discussed in Module 2: context-switching overhead, memory exhaustion (stack space limits), and CPU schedulers getting overloaded. Bounding threads via pools is necessary for stability.

# Database Isolation &amp; Scalability

> [!NOTE] How does a database handle concurrent transactions?
>
> Databases guarantee transaction isolation (ACID properties) through synchronization primitives:
>
> - <strong>Locks:</strong> Pessimistic locking. Uses Shared Locks (S-locks) for readers, and Exclusive Locks (X-locks) for writers.
> - <strong>MVCC (Multi-Version Concurrency Control):</strong> Optimistic approach. Readers access a historical snapshot of the database while writers update a new version. Avoids blocking readers, maximizing database scalability.

> [!NOTE] Why are asynchronous event-loop servers (like Node.js) scalable?
>
> Node.js runs single-threaded for JS code but delegates heavy operations to background system threads. It utilizes non-blocking system calls:
>
> - When Node performs an I/O request (e.g., querying database), it registers a callback and moves to handle other incoming events.
> - The kernel handles the I/O block. When completed, the OS notifies the event loop, which schedules the JS callback to run. This allows a single thread to multiplex thousands of active connections without thread overhead.

> [!NOTE] When should you use Multiprocessing instead of Multithreading?
>
> - <strong>Multiprocessing:</strong> CPU-bound tasks (e.g., video compression, heavy mathematical rendering, machine learning inference). Essential in languages like Python due to the <strong>Global Interpreter Lock (GIL)</strong> which prevents threads from running code on multiple CPU cores simultaneously.
> - <strong>Multithreading:</strong> I/O-bound tasks (e.g., network APIs request batching, real-time chats, filesystem logs). Beneficially shares memory structures and has very low instantiation cost.
