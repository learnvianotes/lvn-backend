---
id: 2ebb60c0-5064-7716-a09e-01b136dbfe77
key: topic:artificial-intelligence/propositional-logic
subject: artificial-intelligence
topic: propositional-logic
title: Propositional Logic
slug: propositional-logic
order: 1
---

A <strong>knowledge-based agent</strong> stores facts as sentences in a formal language and derives new facts by inference. Propositional logic is the simplest such language: sentences are built from true/false symbols with connectives.

TELL the KB what is perceived → ASK the KB what to do (inference) → TELL the KB the action taken

# Syntax and semantics

| Connective | Symbol | Read as | True when |
| --- | --- | --- | --- |
| Negation | `¬P` | not P | `P` is false |
| Conjunction | `P ∧ Q` | P and Q | both are true |
| Disjunction | `P ∨ Q` | P or Q | at least one is true |
| Implication | `P ⇒ Q` | if P then Q | `P` is false <strong>or</strong> `Q` is true |
| Biconditional | `P ⇔ Q` | P if and only if Q | both have the same value |

> [!WARNING] Watch out
>
> `P ⇒ Q` is true whenever `P` is false (“if pigs fly, 1 = 2” is true). Implication in logic states no causal link — only that the case “P true, Q false” does not happen.

# Key vocabulary

| Term | Meaning |
| --- | --- |
| <strong>Model</strong> | An assignment of true/false to every symbol — a possible world |
| <strong>Entailment</strong> `KB ⊨ α` | `α` is true in <em>every</em> model where the KB is true |
| <strong>Inference</strong> `KB ⊢ α` | An algorithm derives `α` from the KB |
| <strong>Sound</strong> | Derives only entailed sentences (never lies) |
| <strong>Complete</strong> | Can derive every entailed sentence |
| <strong>Valid</strong> (tautology) | True in all models: `P ∨ ¬P` |
| <strong>Satisfiable</strong> | True in at least one model; <em>unsatisfiable</em> = true in none |

> [!NOTE] Key point
>
> Two facts power all of logical inference: `KB ⊨ α` <strong>iff</strong> `KB ⇒ α` is valid (deduction theorem), and <strong>iff</strong> `KB ∧ ¬α` is unsatisfiable (proof by contradiction — the basis of resolution).

# Inference by model checking

The simplest sound and complete method: enumerate every model (a truth table) and check that `α` holds wherever the KB holds. KB: <em>If it rains the grass is wet</em> (`R ⇒ W`), <em>the sprinkler is on or it rains</em> (`S ∨ R`), <em>the sprinkler is off</em> (`¬S`).

```python filename:Python
from itertools import product

SYMBOLS = ["R", "S", "W"]
implies = lambda a, b: (not a) or b
KB = [lambda m: implies(m["R"], m["W"]),
      lambda m: m["S"] or m["R"],
      lambda m: not m["S"]]

def entails(kb, query):
    models = [dict(zip(SYMBOLS, values)) for values in product([False, True], repeat=len(SYMBOLS))]
    kb_models = [m for m in models if all(sentence(m) for sentence in kb)]
    return all(query(m) for m in kb_models), len(models), len(kb_models)

print(entails(KB, lambda m: m["W"]))        # (True, 8, 1) ← KB ⊨ W: in the only KB-model the grass is wet
print(entails(KB, lambda m: m["S"]))        # (False, 8, 1)

valid = lambda f: all(f(*v) for v in product([False, True], repeat=2))
print(valid(lambda p, q: implies(p, q) == implies(not q, not p)))    # True ← contraposition is valid
print(valid(lambda p, q: implies(p, q) == implies(q, p)))            # False ← the converse is not
```

Model checking is exact but costs `O(2ⁿ)` for `n` symbols. Real systems use <strong>theorem proving</strong> (inference rules) or <strong>SAT solvers</strong>, which search the models cleverly.

# Standard equivalences

| Name | Equivalence |
| --- | --- |
| Implication elimination | `P ⇒ Q ≡ ¬P ∨ Q` |
| Contraposition | `P ⇒ Q ≡ ¬Q ⇒ ¬P` |
| Biconditional elimination | `P ⇔ Q ≡ (P ⇒ Q) ∧ (Q ⇒ P)` |
| De Morgan | `¬(P ∧ Q) ≡ ¬P ∨ ¬Q`, `¬(P ∨ Q) ≡ ¬P ∧ ¬Q` |
| Double negation | `¬¬P ≡ P` |
| Distributivity | `P ∨ (Q ∧ R) ≡ (P ∨ Q) ∧ (P ∨ R)` |

| Inference rule | From | Infer |
| --- | --- | --- |
| <strong>Modus ponens</strong> | `P ⇒ Q`, `P` | `Q` |
| Modus tollens | `P ⇒ Q`, `¬Q` | `¬P` |
| And-elimination | `P ∧ Q` | `P` |
| <strong>Resolution</strong> | `P ∨ Q`, `¬Q ∨ R` | `P ∨ R` |

```question
What is the difference between entailment and inference?

---

Entailment (`⊨`) is a semantic relationship: α is true in every model of the KB. Inference (`⊢`) is a syntactic procedure that derives sentences. A good inference procedure is sound (derives only entailed sentences) and complete (derives all of them).
```

```question
How do you check whether KB entails α?

---

Either enumerate all models and check α in each model of the KB (truth tables, `O(2ⁿ)`), or show that `KB ∧ ¬α` is unsatisfiable — with resolution or a SAT solver.
```
