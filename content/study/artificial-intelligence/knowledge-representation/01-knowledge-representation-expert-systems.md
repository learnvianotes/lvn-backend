---
id: 0212e0d0-5a8b-77ec-950a-cce4f7e4d5d6
key: topic:artificial-intelligence/knowledge-representation
subject: artificial-intelligence
topic: knowledge-representation
title: Knowledge Representation & Expert Systems
slug: knowledge-representation-expert-systems
order: 1
---

Knowledge representation (KR) is about organising what an agent knows — categories, objects, properties, defaults and rules — so that inference is efficient. Expert systems were AI's first big commercial success, and today's knowledge graphs are their descendants.

# Main representation schemes

> [!NOTE] Semantic networks
>
> A graph: nodes are objects/categories, labelled edges are relations (`is-a`, `part-of`, `has`). Properties are <strong>inherited</strong> down `is-a` links. Easy to visualise; weak on negation and quantifiers.

> [!NOTE] Frames
>
> Record-like structures (Minsky, 1974): a frame for <em>Restaurant</em> has <strong>slots</strong> (cuisine, price) with <strong>default</strong> values and procedures (“if-needed”). The ancestor of objects and classes in OOP.

> [!NOTE] Ontologies
>
> A formal, shared vocabulary of categories and relations for a domain. Upper ontologies define general concepts (events, time, physical objects); OWL/RDF encode them as triples; description logics give decidable reasoning.

> [!NOTE] Rules / production systems
>
> IF-THEN rules over a working memory of facts, fired by an inference engine (forward or backward chaining). Conflict resolution picks which matching rule fires; the Rete algorithm matches efficiently.

# Inheritance with exceptions

```python filename:Python
# a semantic network as (subject, relation, object) triples
TRIPLES = [
    ("Bird", "is-a", "Animal"), ("Animal", "breathes", True),
    ("Bird", "can-fly", True), ("Bird", "has", "feathers"),
    ("Penguin", "is-a", "Bird"), ("Penguin", "can-fly", False),     # an exception overrides the default
    ("Tweety", "instance-of", "Bird"), ("Pingu", "instance-of", "Penguin"),
]

def lookup(entity, attribute):
    node = entity
    while node:
        for s, r, o in TRIPLES:
            if s == node and r == attribute:
                return o                           # the most specific value wins
        parents = [o for s, r, o in TRIPLES if s == node and r in ("is-a", "instance-of")]
        node = parents[0] if parents else None     # climb the is-a hierarchy
    return None

print(lookup("Tweety", "can-fly"), lookup("Pingu", "can-fly"))     # True False
print(lookup("Pingu", "has"), lookup("Pingu", "breathes"))         # feathers True ← inherited from Bird and Animal
```

This is <strong>default (non-monotonic) reasoning</strong>: birds fly <em>unless</em> we learn otherwise. Classical logic is <em>monotonic</em> — adding facts never removes conclusions — so defaults need special logics (default logic, circumscription) or the inheritance trick above.

# Expert systems

| Component | Role |
| --- | --- |
| <strong>Knowledge base</strong> | Domain rules and facts captured from human experts |
| <strong>Inference engine</strong> | Applies the rules (forward or backward chaining) to the case at hand |
| <strong>Working memory</strong> | Facts about the current case (symptoms, test results) |
| <strong>Explanation facility</strong> | Answers <em>why</em> a question is asked and <em>how</em> a conclusion was reached |
| <strong>Knowledge-acquisition interface</strong> | Lets experts and engineers add and edit rules |

```python filename:Python
RULES = [
    ("R1", {"fever", "cough"}, "flu-suspected"),
    ("R2", {"flu-suspected", "short-of-breath"}, "refer-to-doctor"),
    ("R3", {"sneezing", "itchy-eyes"}, "allergy-suspected"),
]

def diagnose(symptoms):
    facts, how = set(symptoms), {}
    changed = True
    while changed:                                  # forward chaining until nothing new fires
        changed = False
        for name, conditions, conclusion in RULES:
            if conditions <= facts and conclusion not in facts:
                facts.add(conclusion)
                how[conclusion] = f"{name}: {' + '.join(sorted(conditions))}"
                changed = True
    return how

result = diagnose({"fever", "cough", "short-of-breath"})
print(list(result))                         # ['flu-suspected', 'refer-to-doctor']
print(result["refer-to-doctor"])            # R2: flu-suspected + short-of-breath ← the "how" explanation
```

| System | Domain | Note |
| --- | --- | --- |
| DENDRAL (1965) | Inferring molecular structure from mass spectra | First expert system |
| MYCIN (1970s) | Diagnosing blood infections, recommending antibiotics | Hundreds of backward-chaining rules with <strong>certainty factors</strong>; matched specialists but was never used clinically |
| XCON / R1 (1980) | Configuring DEC VAX computers | Saved DEC an estimated $40M a year; grew to thousands of rules |

> [!WARNING] Watch out
>
> Why expert systems faded: the <strong>knowledge-acquisition bottleneck</strong> (experts can't articulate everything), brittleness outside their narrow rules, no learning, and heavy maintenance as rule bases grew. Machine learning replaced much of this — but rule engines still run business logic, and <strong>knowledge graphs</strong> (Wikidata, Google Knowledge Graph) ground search and LLM answers (retrieval-augmented generation).

# Hard problems in KR

| Problem | Description |
| --- | --- |
| <strong>Frame problem</strong> | Representing what does <em>not</em> change when an action happens without writing an axiom for every unaffected fact |
| <strong>Qualification problem</strong> | Listing every precondition of an action is impossible (the car starts… unless the battery is dead, the tank empty, a potato in the exhaust…) |
| <strong>Closed-world assumption</strong> | Databases and Prolog treat anything not known to be true as false — convenient, but not valid for open worlds like the web |
| <strong>Common sense</strong> | Vast everyday knowledge (water is wet, people have one mother) that is hard to write down — the target of projects like Cyc |

```question
Compare semantic networks and frames.

---

Both organise knowledge around objects and categories with inheritance. Semantic networks emphasise relations as labelled graph edges; frames bundle an object's properties into slots with defaults and attached procedures. They are largely interchangeable and both map to subsets of first-order logic.
```

```question
What are the components of an expert system?

---

A knowledge base of rules, an inference engine (forward/backward chaining), working memory for case facts, an explanation facility, and a knowledge-acquisition interface. The user interface asks questions and presents conclusions.
```
