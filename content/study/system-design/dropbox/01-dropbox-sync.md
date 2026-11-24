---
id: 5e7b257e-10b3-7d90-a0d5-f557973e4a07
key: topic:system-design/dropbox
subject: system-design
topic: dropbox
title: Dropbox Sync
slug: dropbox-sync
order: 1
---

Global file synchronization service storing petabytes of user data. Key challenges: block-level chunking, deduplication, conflict resolution, delta sync.

# Block Chunking &amp; Deduplication

> [!INFO]
>
> Files are split into fixed <strong>4MB Chunk Blocks</strong>. Each chunk is hashed using SHA-256.<br> • <strong>Deduplication:</strong> Before uploading a chunk, client queries Metadata DB for the chunk's SHA-256 hash. If hash exists, upload is skipped! Saves \~40% cloud storage.<br> • <strong>Delta Sync:</strong> When a file is edited, only modified 4MB chunks are uploaded.

# System Architecture

> [!NOTE] Metadata Service
>
> Stores file directory structures, permissions, chunk manifest lists, and version history in MySQL/PostgreSQL (Sharded).

> [!NOTE] Block Storage (S3)
>
> Raw encrypted 4MB chunk blocks stored in Amazon S3 object storage with CDN acceleration.
