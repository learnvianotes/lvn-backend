---
id: 301a707d-d666-7cc3-8efd-7dd3e417c4cd
key: topic:artificial-intelligence/modern-ai-landscape
subject: artificial-intelligence
topic: modern-ai-landscape
title: The Modern AI Landscape
slug: the-modern-ai-landscape
order: 1
---

Today “AI” usually means machine learning, and especially deep learning and large language models. But the classical ideas in these notes — search, constraints, logic, probability, decision theory — are still inside modern systems, often combined with learned components.

# How the pieces fit

| Paradigm | Knowledge comes from | Core techniques | Where to read more |
| --- | --- | --- | --- |
| Search &amp; planning | A problem formulation | BFS/A\*, alpha-beta, MCTS, STRIPS planners, CSP solvers | This subject |
| Logic &amp; knowledge | Hand-written facts and rules | Resolution, chaining, ontologies, knowledge graphs | This subject |
| Probabilistic reasoning | Expert-built or learned models | Bayesian networks, HMMs, MDPs | This subject |
| Machine learning | Labelled/unlabelled data | Regression, trees, SVMs, clustering, evaluation | <strong>Machine Learning</strong>, <strong>Data Science</strong> |
| Deep learning | Large datasets + gradient descent | CNNs, RNNs, Transformers, generative models | <strong>Deep Learning</strong> |
| Generative AI / LLMs | Web-scale pretraining + fine-tuning + RLHF | Prompting, RAG, agents, evaluation | <strong>Generative AI</strong> |
| Reinforcement learning | Interaction and reward | Q-learning, policy gradients, self-play | This subject (intro) + <strong>Deep Learning</strong> |

# Classical AI inside modern systems

| Classical idea | Still used in |
| --- | --- |
| A\* and graph search | Maps and ride-hailing routing, game path-finding, robot motion planning |
| Minimax / MCTS | Chess engines (Stockfish: alpha-beta + a neural evaluation), AlphaZero, game AI |
| Constraint solving &amp; SAT | Airline crew and timetable scheduling, chip verification, package managers' dependency resolution |
| Planning (PDDL/HTN) | Logistics, space missions, NPC behaviour in games, LLM agents that decompose tasks |
| Logic &amp; knowledge graphs | Search-engine knowledge panels, business rules engines, grounding LLM answers (RAG over graphs) |
| Bayesian reasoning &amp; HMMs | Spam filters, medical decision support, Kalman/particle filters in robots and GPS |
| MDPs &amp; RL | Recommendation, ad bidding, robotics, and RLHF for aligning LLMs |
| Beam search | Decoding text in translation and speech models |

> [!NOTE] Key point
>
> An <strong>LLM agent</strong> is the agent loop from the <strong>Intelligent Agents</strong> topic with an LLM as the decision-maker: it perceives (reads tool results), keeps state (memory), reasons toward a goal (plans), and acts (calls tools). Adding classical search or verification on top of LLM proposals is an active research area — <em>neuro-symbolic</em> AI.

# Natural language processing

| Era | Approach | Example |
| --- | --- | --- |
| 1960s–80s | Hand-written rules and grammars | ELIZA, SHRDLU |
| 1990s–2000s | Statistical: n-gram language models, HMMs, CRFs | Statistical machine translation, POS tagging |
| 2013–2017 | Word embeddings + RNN/LSTM sequence models | word2vec, seq2seq translation |
| 2018–now | Pretrained Transformers, then LLMs | BERT, GPT family, instruction-tuned chat models |

The idea behind every language model is the same — predict the next word from the context. A bigram model is the smallest version:

```python filename:Python
from collections import Counter, defaultdict

corpus = "the cat sat on the mat . the cat ate the fish . the dog sat on the log .".split()
bigrams = defaultdict(Counter)
for w1, w2 in zip(corpus, corpus[1:]):
    bigrams[w1][w2] += 1

def next_word_probs(word):
    counts = bigrams[word]
    total = sum(counts.values())
    return {w: round(c / total, 2) for w, c in counts.most_common()}

def generate(word, n=5):
    out = [word]
    for _ in range(n):
        word = bigrams[word].most_common(1)[0][0]     # greedy decoding
        out.append(word)
    return " ".join(out)

print(next_word_probs("the"))     # {'cat': 0.33, 'mat': 0.17, 'fish': 0.17, 'dog': 0.17, 'log': 0.17}
print(generate("dog"))            # dog sat on the cat sat ← greedy decoding soon loops
```

An LLM replaces the one-word context with thousands of tokens and the count table with a Transformer of billions of parameters — see the <strong>Deep Learning</strong> (Transformers) and <strong>Generative AI</strong> notes.

| NLP task | Input → output |
| --- | --- |
| Classification (sentiment, spam, intent) | Text → label |
| Named-entity recognition, POS tagging | Text → label per token |
| Machine translation, summarisation | Text → text |
| Question answering, retrieval | Question (+ documents) → answer |
| Speech recognition / synthesis | Audio ↔ text |

# Computer vision

| Task | Output | Typical models |
| --- | --- | --- |
| Image classification | One label per image | CNNs (ResNet), Vision Transformers |
| Object detection | Boxes + labels | YOLO, DETR |
| Segmentation | A label per pixel (semantic / instance) | U-Net, Mask R-CNN, SAM |
| Tracking, pose, depth | Trajectories, keypoints, 3-D structure | Specialised CNN/Transformer heads |
| Generation &amp; editing | New images | Diffusion models |
| Vision–language | Captions, answers about images | CLIP-style encoders, multimodal LLMs |

Vision went through the same shift as NLP: hand-designed features (edges, SIFT, HOG) + a classifier, replaced after 2012 by features <em>learned</em> end-to-end by CNNs, and more recently by Transformers and multimodal models.

robotics · speech · recommender systems · autonomous vehicles · multi-agent systems · AI for science (protein folding) · neuro-symbolic AI

```question
Is classical (symbolic) AI obsolete now that we have deep learning?

---

No. Learning excels at perception and pattern-matching from data; search, planning, constraint solving and logic excel at exact, verifiable reasoning over explicit structure. Strong systems combine them — AlphaZero (MCTS + networks), LLM agents with planners and tools, RAG over knowledge graphs.
```

```question
What is the difference between narrow AI systems today and AGI?

---

Today's systems — even broad LLMs — are trained for particular distributions of tasks and fail in unfamiliar ways (hallucination, brittle planning). AGI would learn and perform essentially any intellectual task a human can, adapting robustly to new situations. Whether scaling current methods leads there is debated.
```
