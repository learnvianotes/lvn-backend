---
id: 35d7edfd-4e64-73df-8283-c906c21dd897
key: topic:genai-fluency/rag_pipeline
subject: genai-fluency
topic: rag_pipeline
title: RAG Architecture
slug: rag-architecture
order: 1
---

Retrieval-Augmented Generation grounds LLM answers in external source documentation.

# Complete RAG Pipeline Flow

1\. Parse Docs PDFs, HTML, Markdown → 2. Chunking Size: 512, Overlap: 50 → 3. Embed Text -&gt; 1536-dim vector → 4. Store Vector DB Index

5\. User Query "How to refund?" → 6. Retrieval Vector Cosine Search → 7. Context Inject Format prompt with facts → 8. LLM Answer Fact-grounded response

# Key Concepts

> [!NOTE] Chunking & Overlap
>
> To avoid overflowing the context window and diluting semantic signals, text must be split into logical chunks. <strong>Overlap</strong> (e.g., 10%) ensures semantic continuity between adjacent chunks so information split at boundaries isn't lost.

> [!NOTE] Context Injection
>
> The top-k retrieved snippets are formatted into the prompt wrapper template. Example system instruction: <em>"Answer the query using ONLY the provided contexts below. If you don't know, say I don't know."</em>
