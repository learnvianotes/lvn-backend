---
id: 3908c556-6f3b-7e76-9235-a4de45b1fdaa
key: topic:artificial-intelligence/first-order-logic
subject: artificial-intelligence
topic: first-order-logic
title: First-Order Logic & Unification
slug: first-order-logic-unification
order: 1
---

Propositional logic needs a separate symbol for every fact. First-order logic (FOL) adds <strong>objects, relations, functions and quantifiers</strong>, so one sentence can say something about <em>all</em> objects — “every king is a person”.

| Element | Examples | Denotes |
| --- | --- | --- |
| Constant symbols | `John`, `Richard`, `2` | Objects |
| Predicate symbols | `King(x)`, `Brother(x, y)`, `>` | Relations (true/false) |
| Function symbols | `LeftLeg(x)`, `Mother(x)`, `+` | Functions returning objects |
| Variables | `x`, `y` | Range over objects |
| Quantifiers | `∀x` (for all), `∃x` (there exists) | Generality |
| Equality | `Father(John) = Henry` | Two terms name the same object |

# Translating English

| English | First-order logic |
| --- | --- |
| All kings are persons | `∀x King(x) ⇒ Person(x)` |
| King John has a crown on his head | `∃x Crown(x) ∧ OnHead(x, John)` |
| Everybody loves somebody | `∀x ∃y Loves(x, y)` |
| There is someone who is loved by everyone | `∃y ∀x Loves(x, y)` |
| Nobody likes taxes | `¬∃x Likes(x, Taxes)` ≡ `∀x ¬Likes(x, Taxes)` |
| Brothers are siblings | `∀x, y Brother(x, y) ⇒ Sibling(x, y)` |

> [!TIP] Do
>
> Pair `∀` with `⇒` and `∃` with `∧`: `∀x King(x) ⇒ Person(x)`; `∃x Crown(x) ∧ OnHead(x, John)`.

> [!DANGER] Avoid
>
> `∀x King(x) ∧ Person(x)` (says <em>everything</em> is a king) or `∃x Crown(x) ⇒ OnHead(x, John)` (true as soon as anything is not a crown).

> [!NOTE] Key point
>
> Quantifier order matters: `∀x ∃y Loves(x, y)` (everyone loves someone, maybe different people) is much weaker than `∃y ∀x Loves(x, y)` (one person loved by all). Duality: `¬∀x P ≡ ∃x ¬P` and `¬∃x P ≡ ∀x ¬P`.

# Unification

> [!INFO]
>
> <strong>Unification</strong> — finding a substitution θ that makes two expressions identical: `Unify(p, q) = θ` where `Subst(θ, p) = Subst(θ, q)`. The <strong>most general unifier</strong> (MGU) commits to as little as possible.

```python filename:Python
def is_var(t):
    return isinstance(t, str) and t[0].islower()        # variables: lowercase; constants: Capitalised

def substitute(t, theta):
    if is_var(t):
        return substitute(theta[t], theta) if t in theta else t
    if isinstance(t, tuple):
        return tuple(substitute(a, theta) for a in t)
    return t

def occurs(var, t, theta):
    t = substitute(t, theta)
    return t == var or (isinstance(t, tuple) and any(occurs(var, a, theta) for a in t))

def unify(x, y, theta):
    if theta is None:
        return None
    x, y = substitute(x, theta), substitute(y, theta)
    if x == y:
        return theta
    if is_var(x):
        return None if occurs(x, y, theta) else {**theta, x: y}      # occurs check
    if is_var(y):
        return unify(y, x, theta)
    if isinstance(x, tuple) and isinstance(y, tuple) and len(x) == len(y):
        for a, b in zip(x, y):
            theta = unify(a, b, theta)
        return theta
    return None

def show(theta):
    return theta if theta is None else {v: substitute(v, theta) for v in theta}

q = ("Knows", "John", "x")
print(show(unify(q, ("Knows", "John", "Jane"), {})))               # {'x': 'Jane'}
print(show(unify(q, ("Knows", "y", "Bill"), {})))                  # {'y': 'John', 'x': 'Bill'}
print(show(unify(q, ("Knows", "y", ("Mother", "y")), {})))         # {'y': 'John', 'x': ('Mother', 'John')}
print(show(unify(q, ("Knows", "x", "Elizabeth"), {})))             # None ← x can't be John and Elizabeth
print(show(unify(q, ("Knows", "x2", "Elizabeth"), {})))            # {'x2': 'John', 'x': 'Elizabeth'} ← fixed by standardising apart
```

# Inference in FOL

<strong>Generalised modus ponens</strong> lifts modus ponens with unification: from `King(John)`, `Greedy(y)` and `∀x King(x) ∧ Greedy(x) ⇒ Evil(x)`, unify to `θ = {x/John, y/John}` and infer `Evil(John)` — only if `Greedy(John)` also unifies. Forward chaining with it gives Datalog-style reasoning. The classic crime KB:

```python filename:Python
FACTS = {("American", "West"), ("Missile", "M1"), ("Owns", "Nono", "M1"), ("Enemy", "Nono", "America")}
RULES = [
    ([("American", "x"), ("Weapon", "y"), ("Sells", "x", "y", "z"), ("Hostile", "z")], ("Criminal", "x")),
    ([("Missile", "x"), ("Owns", "Nono", "x")], ("Sells", "West", "x", "Nono")),
    ([("Missile", "x")], ("Weapon", "x")),
    ([("Enemy", "x", "America")], ("Hostile", "x")),
]

def match(pattern, fact, theta):                   # one-way unification: variables only in the pattern
    if len(pattern) != len(fact) or pattern[0] != fact[0]:
        return None
    theta = dict(theta)
    for p, f in zip(pattern[1:], fact[1:]):
        if p[0].islower():
            if theta.setdefault(p, f) != f:
                return None
        elif p != f:
            return None
    return theta

def solutions(premises, facts, theta):
    if not premises:
        yield theta
        return
    for fact in sorted(facts):
        t = match(premises[0], fact, theta)
        if t is not None:
            yield from solutions(premises[1:], facts, t)

def forward_chain(facts, rules):
    facts, rounds = set(facts), []
    while True:
        new = {tuple(theta.get(a, a) for a in concl)
               for prem, concl in rules for theta in solutions(prem, facts, {})} - facts
        if not new:
            return facts, rounds
        rounds.append(sorted(new))
        facts |= new

facts, rounds = forward_chain(FACTS, RULES)
print(rounds[0])                                   # [('Hostile', 'Nono'), ('Sells', 'West', 'M1', 'Nono'), ('Weapon', 'M1')]
print(rounds[1])                                   # [('Criminal', 'West')]
print(("Criminal", "West") in facts)               # True
```

| Method | How | Used in |
| --- | --- | --- |
| Forward chaining | Generalised modus ponens from facts until nothing new | Datalog, production systems, deductive databases |
| Backward chaining | Depth-first from the goal, unifying with rule heads | <strong>Prolog</strong>, logic programming |
| Resolution | Convert to clausal form (Skolemise ∃), resolve with unification | Automated theorem provers (Vampire, E) |

> [!WARNING] Watch out
>
> FOL entailment is only <strong>semi-decidable</strong>: if `KB ⊨ α` a complete procedure will eventually say so, but if not it may run forever. That's why practical systems restrict the language (Horn clauses, Datalog, description logics).

```question
Why is first-order logic more expressive than propositional logic?

---

It has objects, relations, functions and quantifiers, so general rules (`∀x King(x) ⇒ Person(x)`) replace one propositional symbol per individual fact. It can describe infinite domains that propositional logic cannot.
```

```question
What does unification do? Give an example.

---

It finds the most general substitution making two expressions identical. `Knows(John, x)` and `Knows(y, Mother(y))` unify with `{y/John, x/Mother(John)}`. It's the core step of generalised modus ponens, Prolog and resolution.
```

```question
What is the occurs check?

---

Before binding a variable `x` to a term, check that `x` does not occur inside that term — otherwise `x = F(x)` would create an infinite term. Prolog omits it by default for speed.
```
