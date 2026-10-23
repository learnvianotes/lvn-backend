---
id: e47e14ba-7ea8-716c-928d-656960f08e89
key: topic:operating-systems/memory_management
subject: operating-systems
topic: memory_management
title: Memory & Virtual Memory
slug: memory-virtual-memory
order: 1
---

Contiguous allocation, paging address translation, TLB access calculations, and page replacement traces.

# Amazon SDE-1 Masterclass

> [!NOTE]
>
> <strong>Question:</strong> Explain virtual memory like I'm five years old (ELI5).

> [!NOTE]
>
> "Imagine you have a giant toy chest (the Hard Drive) that holds hundreds of toys, but you only have a small play table (RAM) that can hold three toys at a time. The Operating System is like your parent. When you want to play with a toy, your parent grabs it from the toy chest and puts it on the table. If the table is full, your parent swaps out a toy you haven't played with in a long time back to the chest to make room. Virtual memory is the magic table that makes you feel like you can play with all your toys at once!"

> [!NOTE] Why Virtual Memory?
>
> - <strong>Protects Memory:</strong> Prevents Process A from reading or modifying Process B's memory.
> - <strong>Enables Oversubscription:</strong> Spawns applications that require more memory than physical RAM installed, using the disk backing store.
> - <strong>Simplifies Development:</strong> Every process sees a uniform, contiguous logical memory space starting at address \`0\`.

# Partitioning &amp; Fragmentations

> [!NOTE] Internal Fragmentation
>
> Occurs when memory is allocated in <strong>fixed-size partitions</strong> (e.g. standard pages). If a process requests 3 KB, but the page block is 4 KB, the remaining 1 KB remains allocated but unused. It is wasted internally.

> [!NOTE] External Fragmentation
>
> Occurs when memory is allocated in <strong>dynamic-size partitions</strong> (e.g. segmentation). Over time, memory is carved into tiny blocks. Total free space may equal 10 MB, but if it is fragmented into ten 1 MB chunks, a new process requesting 2 MB cannot start because no contiguous block is available.

> [!NOTE] Paging vs. Segmentation
>
> • <strong>Paging:</strong> Divides logical memory into fixed-size blocks (Pages). Divides physical memory into identical frames. Eliminates external fragmentation entirely but causes minor internal fragmentation in the last page.
>
> • <strong>Segmentation:</strong> Divides memory into variable-sized chunks based on program sections (code, stack, heap). Aligns with programmer view, but causes external fragmentation and requires compaction overhead.

# Page Fault Sequence

> [!NOTE] What happens during a Page Fault?
>
> A page fault is an MMU exception raised when a process references a page marked "invalid" in the page table (not loaded in physical RAM):
>
> 1\. Memory Reference → 2. MMU Trap to Kernel → 3. Locate on Backing Disk → 4. Fetch Frame (Swap if full) → 5. Read Block into Frame → 6. Update Page Table → 7. Restart Instruction

> [!NOTE] Swapping
>
> The system-wide action of moving a process's entire memory image out of RAM onto disk (swap space) when memory pressure is high, and restoring it later when physical RAM becomes free.

> [!NOTE] Thrashing
>
> A catastrophic operating state where the OS spends more time constantly writing and reading memory pages to disk (handling page faults) than executing actual instructions. Occurs when processes lack frames to hold their active working sets.

# TLB Access Math

> [!NOTE] TLB lookup math.
>
> The <strong>Translation Lookaside Buffer (TLB)</strong> is a fast cache located inside the CPU's memory management unit. Let:<br> • $h$ = TLB hit ratio.<br> • $c$ = TLB lookup time.<br> • $m$ = Main memory access time.
>
> `EMAT (Effective Access Time) = h * (c + m) + (1 - h) * (c + 2 * m)`
>
> <em>Note:</em> On a TLB miss, we must access memory twice: once to read the page table entry to find the frame, and a second time to retrieve the actual data byte.

> [!NOTE] Numerical Example
>
> Given hit ratio $h = 90\\%$, TLB lookup time $c = 10\\text{ ns}$, memory access time $m = 100\\text{ ns}$.
>
> `EMAT = 0.90 * (10 + 100) + 0.10 * (10 + 200)`<br>`     = 0.90 * 110 + 0.10 * 210`<br>`     = 99 + 21`<br>`     = 120 ns`

# Numerical Page Replacement Traces

> [!NOTE]
>
> <strong>Trace Scenario:</strong> 3 Frames. Reference string: <strong>7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2</strong>.

> [!NOTE] First-In, First-Out (FIFO)
>
> <strong>Pros</strong>
>
> - Low execution overhead and simple to implement (FIFO queue of frame pointers).
>
> <strong>Cons</strong>
>
> - <strong>Belady's Anomaly:</strong> Increasing the physical frame count can counter-intuitively increase page faults.
> - Ignores how frequently or recently a page is being used.
>
> <strong>Ref</strong> | <strong>7</strong> | <strong>0</strong> | <strong>1</strong> | <strong>2</strong> | <strong>0</strong> | <strong>3</strong> | <strong>0</strong> | <strong>4</strong> | <strong>2</strong> | <strong>3</strong> | <strong>0</strong> | <strong>3</strong> | <strong>2</strong>
>
> F0 | 7 | 7 | 7 | 2 | 2 | 2 | 2 | 4 | 4 | 4 | 0 | 0 | 0
>
> F1 | - | 0 | 0 | 0 | 0 | 3 | 3 | 3 | 2 | 2 | 2 | 2 | 2
>
> F2 | - | - | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 3 | 3 | 3 | 3
>
> Stat | F | F | F | F | H | F | F | F | F | F | F | H | H
>
> • Total Page Faults: <strong>10</strong>

> [!NOTE] Least Recently Used (LRU)
>
> <strong>Pros</strong>
>
> - Highly effective; aligns closely with the <strong>temporal locality of reference</strong> principle.
> - Does not suffer from Belady's Anomaly (belongs to the class of stack algorithms).
>
> <strong>Cons</strong>
>
> - Expensive hardware support needed to track reference timestamps or stack positions on every memory request.
>
> <strong>Ref</strong> | <strong>7</strong> | <strong>0</strong> | <strong>1</strong> | <strong>2</strong> | <strong>0</strong> | <strong>3</strong> | <strong>0</strong> | <strong>4</strong> | <strong>2</strong> | <strong>3</strong> | <strong>0</strong> | <strong>3</strong> | <strong>2</strong>
>
> F0 | 7 | 7 | 7 | 2 | 2 | 2 | 2 | 4 | 4 | 4 | 0 | 0 | 0
>
> F1 | - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 2 | 2
>
> F2 | - | - | 1 | 1 | 1 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3
>
> Stat | F | F | F | F | H | F | H | F | F | F | H | H | H
>
> • Total Page Faults: <strong>8</strong>
