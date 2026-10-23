---
id: b3ab52d9-7d8a-73af-9c90-f8a2d74919aa
key: topic:artificial-intelligence/what-is-ai
subject: artificial-intelligence
topic: what-is-ai
title: What Is AI?
slug: what-is-ai
order: 1
---

Artificial Intelligence is the study and construction of <strong>agents that act intelligently</strong> — systems that perceive their situation, reason about it and choose actions that achieve goals. Machine learning is one (now dominant) way to build them; search, logic and probability are the others.

> [!INFO]
>
> <strong>Artificial Intelligence</strong> — the field that builds computer systems able to perform tasks that normally need human intelligence — perceiving, reasoning, planning, learning, understanding language and acting in the world.

Artificial Intelligence → Machine Learning → Deep Learning → Generative AI / LLMs

Every arrow is a <em>subset</em>: all deep learning is machine learning, and all machine learning is AI — but a chess engine using search, a route planner using A\* and a medical expert system using rules are AI <strong>without</strong> any learning. Those classical techniques are what this subject covers; learning-based AI has its own notes (<strong>Machine Learning</strong>, <strong>Deep Learning</strong>, <strong>Generative AI</strong>).

# Four ways to define AI

Russell &amp; Norvig's classic textbook sorts definitions along two axes — <em>thinking</em> vs <em>acting</em>, and matching <em>humans</em> vs being <em>rational</em> (doing the right thing):

|  | Human-like | Rational |
| --- | --- | --- |
| <strong>Thinking</strong> | <em>Thinking humanly</em> — cognitive modelling: build programs that reason the way people do (cognitive science) | <em>Thinking rationally</em> — the “laws of thought”: correct inference with formal logic |
| <strong>Acting</strong> | <em>Acting humanly</em> — the Turing test: behave indistinguishably from a person | <em>Acting rationally</em> — the <strong>rational agent</strong>: act to achieve the best expected outcome |

> [!NOTE] Key point
>
> Modern AI mostly follows the <strong>rational agent</strong> approach: it is general (logic is one tool, not the only one), and “best expected outcome” is mathematically precise — unlike “human-like”.

# The Turing test and the Chinese room

> [!NOTE] Turing test (1950)
>
> A human judge chats by text with a hidden person and a hidden machine. If the judge can't reliably tell which is which, the machine passes. Passing needs natural-language processing, knowledge representation, automated reasoning and machine learning. The <em>total</em> Turing test adds computer vision and robotics.

> [!NOTE] Chinese room (Searle, 1980)
>
> A person who knows no Chinese follows a rulebook to answer Chinese notes and looks fluent from outside. Searle's point: manipulating symbols (syntax) is not the same as understanding (semantics) — so passing the Turing test would not prove a machine <em>thinks</em>.

A 1966 program already shows why <em>acting</em> human is a weak test of <em>being</em> intelligent. ELIZA imitated a therapist with a handful of pattern → template rules and no understanding at all:

```python filename:Python
import re

RULES = [                                  # tried in order; the last one always matches
    (r"I need (.*)", "Why do you need {0}?"),
    (r"I am (.*)", "How long have you been {0}?"),
    (r".*\bmother\b.*", "Tell me more about your family."),
    (r"(.*)", "Please, go on."),
]
REFLECT = {"my": "your", "me": "you", "i": "you", "am": "are"}

def eliza(text):
    for pattern, reply in RULES:
        m = re.fullmatch(pattern, text.rstrip(".!"), re.IGNORECASE)
        if m:
            parts = [" ".join(REFLECT.get(w.lower(), w) for w in g.split()) for g in m.groups()]
            return reply.format(*parts)

print(eliza("I need a holiday"))                  # Why do you need a holiday?
print(eliza("I am worried about my exams."))      # How long have you been worried about your exams?
print(eliza("My mother calls every day"))         # Tell me more about your family.
print(eliza("The weather is nice"))               # Please, go on.
```

# Weak vs strong, narrow vs general

| Term | Meaning | Status |
| --- | --- | --- |
| <strong>Weak AI</strong> | Machines can <em>act as if</em> they were intelligent | Philosophical claim — widely accepted |
| <strong>Strong AI</strong> | Machines that act intelligently really <em>think</em> / have minds | Philosophical claim — open (Chinese room debate) |
| <strong>Narrow AI (ANI)</strong> | Excels at one task or domain: chess, face recognition, spam filtering, translation | Every deployed system today |
| <strong>General AI (AGI)</strong> | Human-level competence across essentially all cognitive tasks, able to transfer and learn new ones | Research goal; LLMs are broader than older systems but debated |
| <strong>Superintelligence (ASI)</strong> | Far exceeds humans in every domain | Hypothetical — central to AI-safety discussions |

> [!WARNING] Watch out
>
> Don't mix the two pairs up: <em>weak/strong</em> is about whether the machine has a mind; <em>narrow/general</em> is about how many tasks it can do. A system could in principle be general but “weak”.

# A short history — booms and winters

| Year | Milestone |
| --- | --- |
| 1943 | McCulloch &amp; Pitts model a neuron as a logic gate |
| 1950 | Turing, “Computing Machinery and Intelligence” — the imitation game |
| 1956 | <strong>Dartmouth workshop</strong> (McCarthy, Minsky, Shannon, Rochester) — the name “artificial intelligence”; the field is born |
| 1958–66 | Perceptron (Rosenblatt), Samuel's learning checkers player, the General Problem Solver, LISP, ELIZA |
| 1969–73 | Minsky &amp; Papert show single perceptrons can't learn XOR; the Lighthill report criticises AI's “combinatorial explosion” |
| 1974–80 | <strong>First AI winter</strong> — promises unmet, funding cut |
| 1980–87 | <strong>Expert systems</strong> boom (XCON at DEC, MYCIN-style rule bases); Japan's Fifth Generation project; backprop popularised (1986) |
| 1987–93 | <strong>Second AI winter</strong> — Lisp-machine market collapses, expert systems prove brittle and costly to maintain |
| 1990s–2000s | Probabilistic AI (Bayesian networks, HMMs), statistical ML; <strong>Deep Blue</strong> beats Kasparov (1997) |
| 2011–12 | IBM Watson wins <em>Jeopardy!</em>; <strong>AlexNet</strong> wins ImageNet — the deep-learning era begins |
| 2016 | <strong>AlphaGo</strong> beats Lee Sedol — deep networks + Monte Carlo tree search + reinforcement learning |
| 2017–now | The Transformer (2017), large language models, ChatGPT (2022), multimodal models and LLM agents |

> [!NOTE] Symbolic AI (“GOFAI”)
>
> Knowledge written as symbols and rules; intelligence = search + logical inference. Transparent and precise, but brittle and hand-built. Dominated 1956–1990.

> [!NOTE] Statistical / connectionist AI
>
> Knowledge <em>learned</em> from data as probabilities or network weights. Robust and scalable, but data-hungry and hard to interpret. Dominant since the 1990s–2010s.

> [!NOTE] Key point
>
> Winters followed hype: early researchers predicted human-level AI “within a generation”, then hit the <strong>combinatorial explosion</strong> of search and the <strong>knowledge-acquisition bottleneck</strong> of hand-written rules. Both problems — and the techniques built to tame them — are the core of this subject.

```question
What is the difference between AI, machine learning and deep learning?

---

AI is the broad goal of building intelligent agents, by any method — search, logic, probability or learning. Machine learning is the subset where behaviour is learned from data instead of programmed. Deep learning is the subset of ML using many-layered neural networks.
```

```question
What is the rational agent approach, and why is it preferred?

---

An agent is rational if, for every percept sequence, it picks the action expected to maximise its performance measure given what it knows. It's preferred because it is well-defined mathematically and general — it doesn't require copying human thought, and logical inference is just one way to act rationally.
```

```question
What were the AI winters?

---

Periods of collapsed funding and interest (roughly 1974–80 and 1987–93) that followed over-promising: search didn't scale to real problems (combinatorial explosion) and expert systems were brittle and expensive to maintain.
```
