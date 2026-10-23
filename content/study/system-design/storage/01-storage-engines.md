---
id: a2b91660-053c-7b0a-be7d-fed12398e747
key: topic:system-design/storage
subject: system-design
topic: storage
title: Storage Engines
slug: storage-engines
order: 1
---

Deep dive into LSM Trees, B+ Trees, SSTables, Bloom Filters, Compaction algorithms, and MemTables driving modern databases.

# LSM Trees (Log-Structured Merge-Trees)

> [!INFO]
>
> <strong>LSM Tree Architecture:</strong> Optimized for sequential write performance by converting random writes into sequential disk append operations.<br> Write Path: `Client → Write-Ahead Log (WAL) → MemTable (RAM) → Immutable MemTable → Flush to SSTable (Level 0 Disk)`.

> [!NOTE] MemTable & WAL
>
> • <strong>MemTable:</strong> In-memory SkipList or Red-Black Tree. Provides `O(log N)` insertions and sorted range scans.<br> • <strong>WAL:</strong> Append-only log on disk ensuring crash durability before updating MemTable.

> [!NOTE] SSTable (Sorted String Table)
>
> Immutable disk file containing key-value pairs sorted by key. Segmented into data blocks with an appended <strong>Sparse Index</strong> and <strong>Bloom Filter</strong> block for ultra-fast key location.

# B-Trees vs B+ Trees

> [!NOTE] B-Tree
>
> Keys and data pointers stored in both internal nodes and leaf nodes. Range scans require traversing up and down tree levels, incurring random I/O.

> [!NOTE] B+ Tree (Industry Standard SQL)
>
> Data records (or pointers) stored <strong>only in leaf nodes</strong>. Internal nodes store only routing keys. Leaf nodes are linked via a doubly-linked list. Benefits:<br> • Higher fan-out factor = shallower tree depth (3–4 levels for billions of rows).<br> • Ultra-fast range scans by walking leaf linked list sequentially.

# Bloom Filters

> [!INFO]
>
> <strong>Bloom Filter:</strong> A space-efficient probabilistic data structure used to test set membership. Returns either <em>"Definitely Not in Set"</em> (100% accurate) or <em>"Possibly in Set"</em> (low false positive rate). Prevents expensive disk reads for non-existent keys in LSM SSTables.

> [!NOTE]
>
> <strong>Optimal Hash Functions (k)</strong>: k = (m / n) \* ln(2)
>
> <strong>False Positive Probability (p)</strong>: p ≈ (1 - e^(-kn/m))^k
>
> <strong>Memory Overhead</strong>: \~10 bits per key for 1% error rate

# Compaction Strategies

> [!NOTE] Size-Tiered Compaction (STCS)
>
> Merges SSTables of similar sizes when count reaches threshold. Writes are fast, but high space amplification (requires up to 50% free disk space) and high read latency. <strong>Best for write-heavy workloads.</strong>

> [!NOTE] Leveled Compaction (LCS)
>
> Organizes SSTables into discrete levels (L0, L1, L2...). Each level has fixed total size (10× growth factor). Keys within L1+ are non-overlapping. Low space amplification (\~10%), fast reads. <strong>Best for read-heavy workloads (RocksDB, Cassandra default).</strong>

# Storage Engine Comparison Matrix

| Feature | B+ Tree (e.g., PostgreSQL, InnoDB) | LSM Tree (e.g., Cassandra, RocksDB) |
| --- | --- | --- |
| <strong>Write Bottleneck</strong> | Random I/O (Page splits, dirty buffer updates) | Sequential I/O (WAL append + MemTable) |
| <strong>Read Bottleneck</strong> | Minimal (Direct index lookup O(log N)) | Compaction background overhead + Multi-file lookups |
| <strong>Write Amplification</strong> | High (Full 16KB page rewrite for small updates) | Moderate to High (Compaction rewriting SSTables) |
| <strong>Space Efficiency</strong> | Fragmentation over time | Compact &amp; Compressed block SSTables |
