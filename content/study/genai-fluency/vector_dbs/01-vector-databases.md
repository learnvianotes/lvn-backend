---
id: 7f988d5e-1c3b-7557-8b38-d89935d5c078
key: topic:genai-fluency/vector_dbs
subject: genai-fluency
topic: vector_dbs
title: Vector Databases
slug: vector-databases
order: 1
---

How vector engines optimize retrieval speed across millions of high-dimensional vectors.

# Common Engines

Pinecone (SaaS) · Chroma (Local/Light) · Milvus (Scale) · Weaviate (GraphQL hybrid) · FAISS (Meta library) · pgvector (Postgres plugin)

# Indexing Algorithms

> [!NOTE] HNSW (Hierarchical Navigable Small World)
>
> Builds a multi-layered graph where the top layers have long-range links for fast routing, and lower layers have short-range links for local accuracy. The search skips down layers to find the nearest vector in O(log N) time. Highly performant but uses significant RAM.

> [!NOTE] IVF (Inverted File Index) & Product Quantization (PQ)
>
> \- <strong>IVF</strong>: Clusters the vector space. At query time, we only search vectors in the few nearest clusters (nprobe), drastically reducing search space.<br> - <strong>Product Quantization (PQ)</strong>: Compresses high-dimensional vectors into shorter byte codes, reducing memory requirements by 90% at the cost of slight precision loss.
