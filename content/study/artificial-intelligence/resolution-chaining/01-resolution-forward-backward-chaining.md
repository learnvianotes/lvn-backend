---
id: d2fb5420-62fd-7b04-b9c4-b0a9d282d35e
key: topic:artificial-intelligence/resolution-chaining
subject: artificial-intelligence
topic: resolution-chaining
title: Resolution, Forward & Backward Chaining
slug: resolution-forward-backward-chaining
order: 1
---

Resolution is a single inference rule that is complete for propositional logic when used for proof by contradiction. For the restricted but common <strong>Horn clause</strong> form, forward and backward chaining are simpler and run in linear time.

# Converting to CNF

Resolution works on <strong>conjunctive normal form</strong> (CNF): a conjunction of <strong>clauses</strong>, each a disjunction of literals. Any sentence can be converted:

1. <strong>Eliminate ⇔</strong>

   `α ⇔ β` → `(α ⇒ β) ∧ (β ⇒ α)`

2. <strong>Eliminate ⇒</strong>

   `α ⇒ β` → `¬α ∨ β`

3. <strong>Move ¬ inwards</strong>

   De Morgan and double negation until ¬ applies only to symbols

4. <strong>Distribute ∨ over ∧</strong>

   `α ∨ (β ∧ γ)` → `(α ∨ β) ∧ (α ∨ γ)`

> [!TIP] CNF example
>
> `B ⇔ (P ∨ Q)` → `(¬B ∨ P ∨ Q) ∧ (¬P ∨ B) ∧ (¬Q ∨ B)`

# Resolution refutation

To prove `α`: add `¬α` to the KB's clauses and resolve pairs of clauses with complementary literals. Deriving the <strong>empty clause</strong> (a contradiction) proves `KB ⊨ α`; if no new clauses can be produced, `α` is not entailed.

```python filename:Python
from itertools import combinations

def resolve(a, b):
    out = []
    for lit in sorted(a):
        neg = lit[1:] if lit.startswith("~") else "~" + lit
        if neg in b:
            out.append((a - {lit}) | (b - {neg}))
    return out

def resolution(clauses, query):
    neg = query[1:] if query.startswith("~") else "~" + query
    clauses = set(clauses) | {frozenset([neg])}              # add the negated goal
    derived = []
    while True:
        new = set()
        for a, b in combinations(sorted(clauses, key=sorted), 2):
            for r in resolve(a, b):
                if not r:
                    return True, derived                     # empty clause: contradiction
                if r not in clauses and r not in new:
                    new.add(frozenset(r))
                    derived.append(sorted(r))
        if not new:
            return False, derived                            # nothing new: not entailed
        clauses |= new

# KB:  P ⇒ Q,  Q ⇒ R,  P       as clauses: {¬P, Q}, {¬Q, R}, {P}
kb = [frozenset({"~P", "Q"}), frozenset({"~Q", "R"}), frozenset({"P"})]
proved, derived = resolution(kb, "R")
print(proved, derived)          # True [['Q'], ['R', '~P'], ['~Q'], ['R']]
print(resolution(kb, "~R")[0])  # False ← R is entailed, so ¬R is not
```

> [!NOTE] Key point
>
> Resolution is <strong>refutation-complete</strong>: if `KB ⊨ α`, resolution on `KB ∧ ¬α` will eventually derive the empty clause. Modern <strong>SAT solvers</strong> (DPLL / CDCL, WalkSAT) decide satisfiability of millions of clauses and power hardware verification, planning and scheduling.

# Horn clauses, forward and backward chaining

> [!INFO]
>
> <strong>Definite / Horn clause</strong> — a clause with at most one positive literal — equivalently a rule `A ∧ B ∧ … ⇒ C` or a fact `C`. Inference with Horn clauses takes time linear in the size of the KB and is easy for humans to read.

The textbook KB: `P ⇒ Q`, `L ∧ M ⇒ P`, `B ∧ L ⇒ M`, `A ∧ P ⇒ L`, `A ∧ B ⇒ L`, and facts `A`, `B`.

```python filename:Python
RULES = [(["P"], "Q"), (["L", "M"], "P"), (["B", "L"], "M"), (["A", "P"], "L"), (["A", "B"], "L")]
FACTS = ["A", "B"]

def forward_chain(rules, facts, query):
    known, agenda, order = set(), list(facts), []
    count = {i: len(prem) for i, (prem, _) in enumerate(rules)}    # unsatisfied premises per rule
    while agenda:
        p = agenda.pop(0)
        if p in known:
            continue
        known.add(p)
        order.append(p)
        if p == query:
            return True, order
        for i, (prem, concl) in enumerate(rules):
            if p in prem:
                count[i] -= 1
                if count[i] == 0:                                   # all premises known → fire
                    agenda.append(concl)
    return False, order

def backward_chain(rules, facts, goal, seen=()):
    if goal in facts:
        return True
    if goal in seen:                                                # avoid looping on P ⇒ … ⇒ P
        return False
    return any(all(backward_chain(rules, facts, g, seen + (goal,)) for g in prem)
               for prem, concl in rules if concl == goal)

print(forward_chain(RULES, FACTS, "Q"))     # (True, ['A', 'B', 'L', 'M', 'P', 'Q'])
print(backward_chain(RULES, FACTS, "Q"))    # True
print(backward_chain(RULES, FACTS, "Z"))    # False ← no rule concludes Z
```

|  | Forward chaining | Backward chaining |
| --- | --- | --- |
| Direction | <strong>Data-driven</strong>: from known facts to all consequences | <strong>Goal-driven</strong>: from the query back to facts |
| Fires | Every rule whose premises become true | Only rules relevant to the goal |
| Good for | Monitoring, reacting to new data, deriving everything | Answering specific questions |
| Cost | May derive many irrelevant facts | Often much less than linear in KB size |
| Used in | Production systems, expert-system shells (CLIPS), Datalog | Prolog, diagnostic systems (MYCIN) |

```question
Explain resolution refutation.

---

Convert KB ∧ ¬α to CNF, then repeatedly resolve pairs of clauses containing a literal and its negation, adding the resolvents. Deriving the empty clause shows KB ∧ ¬α is unsatisfiable, so KB ⊨ α. It's sound and refutation-complete.
```

```question
Forward vs backward chaining — when to use which?

---

Forward chaining is data-driven: good when new facts arrive and you want all consequences (alerting, production systems). Backward chaining is goal-driven: good for answering a specific query, since it only explores rules relevant to the goal (Prolog, diagnosis).
```

```question
What is a Horn clause and why does it matter?

---

A clause with at most one positive literal, i.e. a rule with a single conclusion or a fact. With Horn clauses, entailment can be decided in linear time using forward or backward chaining, instead of the exponential worst case of general propositional inference.
```
