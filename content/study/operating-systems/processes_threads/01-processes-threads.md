---
id: 8df6a9f9-15db-7f0a-84e8-c831303b171d
key: topic:operating-systems/processes_threads
subject: operating-systems
topic: processes_threads
title: Processes & Threads
slug: processes-threads
order: 1
---

Process lifecycle, resources allocation, lightweight executing structures, and thread pool design.

# Process Architecture &amp; States

> [!NOTE] What is a process? What is stored in the PCB?
>
> A <strong>Process</strong> is an active program instance in execution, isolated by memory boundaries. The OS tracks and manages each process using a kernel data structure called the <strong>Process Control Block (PCB)</strong>, which stores:
>
> - <strong>Process ID (PID) &amp; Process State:</strong> Unique identifier and current execution state (New, Ready, Running, Waiting, Terminated).
> - <strong>Program Counter (PC):</strong> Address of the next CPU instruction to execute for this process.
> - <strong>Registers:</strong> Saved CPU register values when the process is context-switched out.
> - <strong>Memory Management Info:</strong> Page tables, segment tables, and base/limit registers representing the virtual address space.
> - <strong>File Descriptor Table:</strong> Pointers to open files, network sockets, and I/O descriptors.

> [!NOTE] Program vs. Process
>
> A <strong>Program</strong> is a passive entity: a compiled binary file containing machine code instructions stored on disk. A <strong>Process</strong> is an active entity: it represents the active execution of those instructions, possessing resources like virtual memory, registers, stack, and heap allocated by the kernel.

> [!NOTE] Why are processes isolated?
>
> Processes have completely isolated virtual address spaces. If Process A has a bug (e.g., null pointer dereference or array index write out of bounds), it triggers a segmentation fault. The OS terminates Process A, but Process B continues running completely unaffected. Memory isolation guarantees safety and security.

# Process &amp; Thread Lifecycles

> [!NOTE] Zombie Process
>
> A child process that has completed execution (called \`exit()\`) but its parent has not yet read its exit status (via \`wait()\`). It holds an entry in the system process table, though it releases all other memory.

> [!NOTE] Orphan Process
>
> A process whose parent has terminated while the child is still executing. The child is immediately adopted by the root system process (\`init\` or PID 1) which cleans up its exit state on termination.

> [!NOTE] Daemon Process
>
> A background service process that runs continuously, detached from any user session or terminal. It handles system service tasks (e.g., \`crond\`, \`syslogd\`, web server listening loops).

> [!NOTE] Why is creating a process expensive?
>
> Creating a process requires allocating a new PID, setting up a fresh PCB, building new page tables, copying file descriptors, and copying the parent's memory layout (often optimized via <strong>Copy-on-Write</strong>, but still incurs overhead). In contrast, threads simply run inside the existing process environment.

# Threads: The Lightweight Alternative

> [!NOTE] What is a thread? Why is it lightweight?
>
> A <strong>Thread</strong> is the basic, smallest unit of CPU execution scheduled by the OS. It is "lightweight" because it runs inside its parent process's memory context, avoiding the need to allocate separate virtual memory page tables or address space descriptors.

> [!NOTE] Shared Resources
>
> - Code Segment (instructions)
> - Data Segment (global variables)
> - Heap memory (objects, dynamically allocated variables)
> - System resources (open files, sockets)

> [!NOTE] Private Resources
>
> - Thread ID (TID)
> - Program Counter (PC)
> - CPU registers
> - Stack (local variables, function call frames)
> - Thread Local Storage (TLS)

> [!NOTE] Can one thread crash another?
>
> <strong>Yes.</strong> Because all threads of a process share the same virtual address space, if one thread executes a invalid memory operation (e.g., null pointer dereference, writing outside allocated boundaries), it triggers a segmentation fault at the process level. The OS sends a \`SIGSEGV\` signal to the parent process, causing the immediate termination of the entire process and all of its executing threads.

# Amazon SDE-1 Follow-up Scenario

> [!NOTE]
>
> <strong>Question:</strong> Suppose your backend server needs to handle 10,000 concurrent client requests. Would you create 10,000 threads? Why or why not? What are the alternatives?

> [!NOTE] Why 10,000 threads will crash your server:
>
> 1. <strong>Memory Exhaustion (Out Of Memory):</strong> Each thread requires its own private stack segment. By default on Linux, stack size is 8MB (can be tuned down to 512KB-2MB). At 1MB per thread, 10,000 threads consume <strong>10 GB of RAM</strong> just for stack frames, completely starving the application heap.
> 2. <strong>Context Switching Storm:</strong> If 10,000 threads compete for CPU cycles on an 8-core CPU, the CPU spends almost all its time swapping register states, page base pointers, and flushing caches (CPU thrashing). The CPU spends more time on context switching than running actual business logic.
> 3. <strong>Thread Creation Overhead:</strong> Initiating, scheduling, and tearing down 10,000 OS-level kernel threads wastes massive system cycles.
>
> <strong>The Production-Grade Alternatives:</strong>
>
> - <strong>Thread Pool (Bounded Workers):</strong> Maintain a fixed pool of worker threads (e.g., \`num\_cores \* 2\`). Incoming requests are placed in a thread-safe task queue. Worker threads poll the queue, process requests, and return to the pool for reuse. This bounds resource usage.
> - <strong>Non-blocking Asynchronous I/O (Event Loop / Reactor Pattern):</strong> Used in Node.js, Nginx, Netty. A single thread (or one thread per core) multiplexes thousands of active connections using OS event notifications (such as \`epoll\` on Linux or \`kqueue\` on macOS). Instead of blocking a thread while waiting on disk/network I/O, the thread registers a callback and instantly moves to the next request. When I/O finishes, the OS raises an event and the thread executes the callback.
