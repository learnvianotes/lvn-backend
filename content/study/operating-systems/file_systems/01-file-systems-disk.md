---
id: 523b63d2-f5d2-7152-829a-9f362159185c
key: topic:operating-systems/file_systems
subject: operating-systems
topic: file_systems
title: File Systems & Disk
slug: file-systems-disk
order: 1
---

Inode blocks, linking styles, and track seeks distance calculations.

# 1. Inodes &amp; Links

> [!NOTE] What is an Inode?
>
> An <strong>Inode (Index Node)</strong> is a data structure on Unix filesystems containing metadata describing a file object (owner, size, file permissions, creation date, modification date) and an index array of block pointers pointing to where the file's raw bytes reside on disk.

> [!NOTE] Hard Link
>
> A directory entry pointing directly to the Inode of the target file. Deleting the original name has no effect on the file data until all hard links are deleted. Cannot cross filesystem partitions.

> [!NOTE] Soft Link (Symbolic Link)
>
> A separate file containing the path string to the original file. If the original file is deleted, the symbolic link breaks (becomes a dangling reference). Can span cross-partition boundaries.

> [!NOTE] Journaling
>
> A filesystem design that writes metadata changes to a log file (journal) \*before\* committing them to the primary disk. If a crash or power failure occurs, the filesystem replays the journal on reboot, avoiding metadata corruption.

> [!NOTE] Buffer Cache
>
> An area in main memory (RAM) used by the kernel to cache disk sector blocks. Reads and writes hit the cache first, avoiding physical disk seek latencies.

# 2. Numerical Disk Scheduling Traces

> [!NOTE]
>
> <strong>Track Scenario:</strong> Disk size: 200 tracks (0 to 199). Head starting position = <strong>53</strong>.<br> Request queue: <strong>98, 183, 37, 122, 14, 124, 65, 67</strong>.

> [!NOTE] First-Come, First-Served (FCFS)
>
> <strong>Order:</strong> 53 → 98 → 183 → 37 → 122 → 14 → 124 → 65 → 67.<br> <strong>Calculation:</strong> |98 - 53| + |183 - 98| + |37 - 183| + |122 - 37| + |14 - 122| + |124 - 14| + |65 - 124| + |67 - 65| = 45 + 85 + 146 + 85 + 108 + 110 + 59 + 2
>
> • Total Head Movement: <strong>640 cylinders</strong>

> [!NOTE] Shortest Seek Time First (SSTF)
>
> <strong>Order:</strong> 53 → 65 → 67 → 37 → 14 → 98 → 122 → 124 → 183.<br> <strong>Calculation:</strong> |65 - 53| + |67 - 65| + |37 - 67| + |14 - 37| + |98 - 14| + |122 - 98| + |124 - 122| + |183 - 124|
>
> • Total Head Movement: <strong>236 cylinders</strong>

> [!NOTE] SCAN (Assuming direction is toward 0 first)
>
> <strong>Order:</strong> 53 → 37 → 14 → 0 → 65 → 67 → 98 → 122 → 124 → 183.<br> <strong>Calculation:</strong> (53 - 0) + (183 - 0)
>
> • Total Head Movement: <strong>236 cylinders</strong>

> [!NOTE] C-SCAN (Assuming direction is toward 199 first)
>
> <strong>Order:</strong> 53 → 65 → 67 → 98 → 122 → 124 → 183 → 199 → 0 → 14 → 37.<br> <strong>Calculation:</strong> (199 - 53) + (199 - 0) + (37 - 0)
>
> • Total Head Movement (including wrap): <strong>382 cylinders</strong>

> [!NOTE] LOOK (Assuming direction is toward 0 first)
>
> <strong>Order:</strong> 53 → 37 → 14 → 65 → 67 → 98 → 122 → 124 → 183.<br> <strong>Calculation:</strong> (53 - 14) + (183 - 14)
>
> • Total Head Movement: <strong>208 cylinders</strong>
