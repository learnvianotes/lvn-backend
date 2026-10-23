---
id: 9d080c74-03dd-7da5-8ea1-a924751595d2
key: topic:operating-systems/ipc
subject: operating-systems
topic: ipc
title: Inter-Process Comm (IPC)
slug: inter-process-comm-ipc
order: 1
---

Mechanisms for exchanging data across isolated boundary barriers.

# 1. IPC Mechanisms

> [!NOTE] Pipe (Anonymous Pipe)
>
> Unidirectional channel stored in memory. Supports communication only between processes sharing a parent-child relationship. Managed via standard input/output file descriptors.

> [!NOTE] Named Pipe (FIFO)
>
> Bidirectional channel represented as a special block file on the filesystem directory tree. Allows unrelated processes to read and write data streams.

> [!NOTE] Shared Memory
>
> Processes request the kernel to map the same physical RAM frame directly to both virtual address spaces. Processes read and write directly to the same bytes without invoking system calls.

> [!NOTE] Sockets
>
> Standard network protocol abstraction. Allows bidirectional stream communication between processes on the same machine (Unix domain sockets) or across distinct network machines (TCP/UDP).

> [!NOTE] Message Queue
>
> System-wide queue managed by the kernel. Allows processes to pass formatted messages asynchronously. Unlike pipes, messages do not require continuous streaming read loops.

> [!NOTE] Signals
>
> Asynchronous kernel notifications sent to a process to alert it of events (e.g. \`SIGINT\` for keyboard interrupt, \`SIGSEGV\` for bad memory access, \`SIGKILL\` to instantly terminate).

# 2. Core Interview Questions

> [!NOTE] Which IPC mechanism is the fastest? Why?
>
> <strong>Shared Memory</strong> is the fastest IPC mechanism by a wide margin.
>
> <strong>Why:</strong>
>
> - For other IPC types (like Pipes, Sockets, or Message Queues), the sending process must copy data from its user buffer into the kernel's memory buffer (System Call 1). The receiving process must then copy data from kernel buffer to its own user buffer (System Call 2). This involves context switches and duplicate RAM copies.
> - With Shared Memory, once the memory layout is mapped to both processes' spaces, writing data is identical to writing to a local array. It is a direct RAM transfer with <strong>zero data copying</strong> and <strong>zero system call intervention</strong> required for the transfer. (Synchronization must be coordinated using locks).

> [!NOTE] Difference between Threads and IPC.
>
> - <strong>Threads:</strong> Share the same address space. Synchronization is quick and done via locks, but a bug in one thread can access and corrupt memory belonging to another, or crash the process.
> - <strong>IPC:</strong> Crosses process boundaries. Processes are isolated; Process A cannot read Process B's memory. Safe and crash-isolated, but data transfer requires higher overhead.
