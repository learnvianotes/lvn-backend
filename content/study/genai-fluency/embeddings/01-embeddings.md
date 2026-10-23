---
id: 97de74a6-8f1b-7736-8719-e600bd9821b2
key: topic:genai-fluency/embeddings
subject: genai-fluency
topic: embeddings
title: Embeddings
slug: embeddings
order: 1
---

How mathematical vector alignment translates semantic meaning into geometric distance.

> [!NOTE] Vector Dimensions
>
> An embedding is an array of floating-point numbers (e.g., 1536 elements). Meaning is spread across many dimensions; concepts like gender or royalty correspond to directions in the space, and individual dimensions are usually not human-interpretable.

> [!NOTE] Cosine Similarity
>
> Measures the angle between two vectors, ignoring magnitude. Ranges from -1 to 1. A score close to 1 indicates the concepts are highly related in semantic direction.

# Vector search methods

> [!NOTE] Nearest Neighbor Search (KNN vs ANN)
>
> Finding vectors closest to a query vector. K-Nearest Neighbor (KNN) scans every item (O(N)), which is too slow at scale. Approximate Nearest Neighbor (ANN) uses specialized indexes to locate nearest items in sub-linear time (≈O(log N) for HNSW), typically milliseconds, sacrificing slight accuracy.

> [!NOTE] Vector Database
>
> A database optimized for storing, indexing, and executing vector searches. It handles metadata filtering, updates, and fast ANN indexing (using graphs or quantizations) alongside typical database operations. Examples: Pinecone, Chroma, Milvus.
