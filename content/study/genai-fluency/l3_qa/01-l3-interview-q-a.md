---
id: e2713061-1bdc-7900-b53c-abbc3269f87b
key: topic:genai-fluency/l3_qa
subject: genai-fluency
topic: l3_qa
title: "L3: Interview Q&A"
slug: l3-interview-q-a
order: 1
---

Advanced GenAI system design interview scenarios. Read-times are approximately 3-5 minutes per answer.

```question
"Design ChatGPT for Amazon."

---

<strong>System Focus:</strong> Multi-tool routing, transactional safety, scale queries, and localized recommendations.

<strong>System Architecture:</strong> <br>1. <strong>Gateway &amp; Guardrails</strong>: User queries enter an API gateway where inputs are filtered for jailbreaks, toxicity, and PII. <br>2. <strong>Orchestrator Agent</strong>: A core router model (e.g., Claude or fine-tuned Llama) coordinates the response. It has access to tools: <br> - <em>Catalog Search Tool</em>: Triggers a hybrid search (Vector search for semantic intent + Lexical search for exact product names) in the Product DB. <br> - <em>Order History Tool</em>: Connects to relational order databases via secure APIs using authenticated customer IDs. <br> - <em>Returns API Tool</em>: Initiates returns protocols. <br>3. <strong>Knowledge Base (RAG)</strong>: Serves Amazon policy pages, help docs, and FAQ materials stored in a Vector DB (Pinecone/Milvus). <br>4. <strong>Response Generation</strong>: Synthesizes responses using retrieved documents, product ratings, and user order context. <br>5. <strong>Latency Optimization</strong>: Implements streaming token output directly to the UI, prompt caching of system rules, and speculative decoding for fast generation. <br>6. <strong>Output Guardrails</strong>: Audits generated content to ensure it does not mention competitors, leak tokens, or output toxic content.
```

```question
"Design a document chatbot."

---

<strong>System Focus:</strong> Ingestion parsing, vector chunk indexing, metadata filtering, and citation verification.

<strong>System Design:</strong> <br>1. <strong>Ingestion Pipeline</strong>: <br> - Parse documents (PDF, Word, Markdown) into raw text using OCR if needed. <br> - Segment text using recursive character splitters into 512-token chunks with 50-token overlap. <br> - Pass chunks to an embedding model (e.g. OpenAI text-embedding-3-small). <br> - Store vectors alongside metadata (document\_id, page\_number, filename, access\_roles) in a Vector DB. <br>2. <strong>Retrieval Pipeline</strong>: <br> - The user submits a question and their auth token. <br> - Generate a query vector embedding. <br> - Execute a vector similarity query with <strong>metadata pre-filtering</strong> (ensuring the user is authorized to read the retrieved documents). <br> - Fetch top-5 document chunks. <br>3. <strong>Synthesis &amp; Verification</strong>: <br> - Pass the query and retrieved document chunks to the LLM with a system prompt enforcing the model to only answer using provided chunks and output inline citations. <br> - Verify citations post-generation by checking if they exist verbatim in the retrieved chunks.
```

```question
"How would you reduce hallucinations?"

---

<strong>System Focus:</strong> Context grounding, prompt design, reflection algorithms, and low sampling settings.

To systematically reduce hallucinations in a production system: <br>1. <strong>Context Grounding (RAG)</strong>: Ensure the LLM never generates responses purely from memory. Inject relevant reference documents into the context. <br>2. <strong>Strict Prompt Engineering</strong>: Explicitly instruct the model: <em>"If you cannot find the answer in the provided documents, say 'I do not know'. Do not make up facts."</em> <br>3. <strong>Lower Temperature (0–0.2)</strong>: Reduces sampling randomness for more consistent answers; it does not by itself prevent confident errors. <br>4. <strong>Self-Reflection / Self-Correction</strong>: Use a secondary LLM checker to review outputs: <em>"Check if the answer is fully supported by the reference documents. If it contains unsupported facts, rewrite it."</em> <br>5. <strong>Guardrail Frameworks</strong>: Implement NeMo Guardrails or Guardrails AI to automatically validate outputs against schemas or run alignment checks.
```

```question
"How would you make responses faster?"

---

<strong>System Focus:</strong> Streaming, KV caching, quantization, and specialized inference runtimes.

To reduce LLM latency across the stack: <br>1. <strong>User Experience</strong>: Enable <strong>Streaming</strong> using Server-Sent Events (SSE). Pushing tokens to the UI as they generate reduces perceived latency to near-zero. <br>2. <strong>Server Caching</strong>: Enable <strong>KV Caching</strong> in inference engines to avoid recomputing attention states for historical tokens, and configure <strong>Prompt Caching</strong> to skip prefill phases for repeat system prompts. <br>3. <strong>Inference Engine Selection</strong>: Deploy using optimized runtimes like <strong>vLLM</strong> or <strong>TensorRT-LLM</strong> that implement PagedAttention (reduces memory fragmentation) and continuous batching. <br>4. <strong>Hardware Optimization</strong>: Quantize weights to 8-bit or 4-bit (reducing weight size and memory footprint), use speculative decoding (using small models to draft tokens), or deploy models across multiple GPUs with tensor parallelism.
```

```question
"How would you reduce API cost?"

---

<strong>System Focus:</strong> Caching strategies, model routing tiers, context reduction, and open-source models.

Cost reduction strategies: <br>1. <strong>Semantic Caching</strong>: Implement a cache (like GPTCache with Redis) that stores queries. If a new question is semantically similar to a cached query (e.g. cosine similarity &gt; 0.95), return the cached answer instead of calling the LLM. <br>2. <strong>Model Cascading / Routing</strong>: Run a cheap classifier to evaluate query complexity. Route simple queries (e.g., classification, summarization) to cheap models (e.g. small "mini"-tier or \~8B open-weight models) and reserve expensive models (e.g. flagship GPT, Claude or Gemini models) for complex logic queries. <br>3. <strong>Minimize Token Lengths</strong>: Prune retrieved RAG contexts to remove redundant text. Compress prompt templates. <br>4. <strong>Self-Host Open Source</strong>: For heavy workloads, self-host a fine-tuned open-source model (Llama-3) on private GPUs to exchange high variable API costs for fixed infrastructure costs.
```

```question
"When would you choose GPT vs Llama?"

---

<strong>System Focus:</strong> Hosting capability, security/privacy, cost metrics, and scale demands.

<strong>Choose GPT (or other proprietary API models) when:</strong> <br>- You want rapid prototyping (zero infrastructure to manage). <br>- You require state-of-the-art reasoning or mathematical capabilities. <br>- Your request volume is low or highly variable (paying per token is cheaper than running a dedicated GPU). <br><strong>Choose Llama (or other open-weight models) when:</strong> <br>- Data privacy is critical (medical records, financial contracts) and data cannot leave your virtual private cloud (VPC). <br>- You have massive query volumes where renting dedicated GPUs (fixed cost) is significantly cheaper than API tokens. <br>- You need low-latency local execution (e.g., running on-device or within edge servers). <br>- You want to fine-tune the model on proprietary domain data to specialize it for a niche task.
```

```question
"Explain vector databases."

---

<strong>Fast Answer:</strong> Specialized databases built to index, store, and execute vector similarity searches at high speeds over millions of records.

Traditional databases index records using keys, columns, or keywords. In contrast, Vector Databases index high-dimensional vectors representing semantic embeddings. They are optimized for mathematical similarity computations (e.g. cosine distance). Because searching millions of 1536-dimensional vectors is computationally intensive, Vector DBs use specialized Approximate Nearest Neighbor (ANN) index structures (like HNSW or IVF) to narrow down search spaces, returning results in milliseconds. They also support concurrent metadata filtering (e.g., "find vectors similar to X but only files updated after Monday").
```

```question
"Explain ANN search."

---

<strong>Fast Answer:</strong> An approximation method that groups vectors to find closest matches in sub-millisecond O(log N) time, sacrificing minor accuracy for massive scale performance.

Exact nearest neighbor search (k-NN) scans every single vector in the database, which scales linearly O(N) and is too slow for millions of rows. Approximate Nearest Neighbor (ANN) search trades a small amount of recall accuracy for speed. It indexes vectors using one of three methods: <br>1. <strong>Graph-based (HNSW)</strong>: Creates a layered graph representing connections. Search traverses long connections, then local details. <br>2. <strong>Inverted Files (IVF)</strong>: Clusters space and searches only within the nearest cluster. <br>3. <strong>Quantization (PQ)</strong>: Compresses vectors to perform distance calculations on byte signatures. <br>This makes search sub-linear in practice (≈O(log N) for HNSW; IVF scans only a few clusters; PQ makes each distance much cheaper and is often combined with IVF), making massive search queries extremely fast.
```

```question
"How would you deploy an LLM?"

---

<strong>System Focus:</strong> Model deployment stacks, autoscaling GPU nodes, and parallel batching.

A production deployment workflow: <br>1. <strong>Packaging &amp; Inference Server</strong>: Wrap the model (e.g., Llama-3-70B quantised to AWQ 4-bit) in an inference engine like <strong>vLLM</strong> or <strong>Triton Inference Server with a TensorRT-LLM/vLLM backend</strong>. This grants features like PagedAttention, continuous batching, and an OpenAI-compatible API endpoint. <br>2. <strong>GPU Hosting Cluster</strong>: Deploy containers onto a Kubernetes cluster with GPU-enabled nodes (e.g. AWS EKS with G5 or P5 instances containing A10G/H100 GPUs). <br>3. <strong>Autoscaling &amp; Queue Management</strong>: Scale GPU instances based on concurrent request counts. Implement a queue (e.g., using Redis) at the API Gateway to buffer request bursts. <br>4. <strong>Load Balancing &amp; Routing</strong>: Use an API gateway (e.g. Kong, Nginx) to handle SSL termination, authentication, rate limiting, and round-robin request distribution across active GPU replicas.
```
