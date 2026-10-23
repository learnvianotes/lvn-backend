---
id: 47748d51-304b-709b-be30-977d8e0dcef8
key: topic:artificial-intelligence/genetic-algorithms
subject: artificial-intelligence
topic: genetic-algorithms
title: Genetic Algorithms
slug: genetic-algorithms
order: 1
---

A genetic algorithm (GA) evolves a <strong>population</strong> of candidate solutions: the fittest are selected to reproduce, their encodings are combined by <strong>crossover</strong>, and random <strong>mutation</strong> keeps diversity. It is stochastic beam search with sexual reproduction.

1. <strong>Encode</strong>

   Represent each candidate as a string — bits, digits or a permutation. 8-queens: 8 digits, one row per column.

2. <strong>Initialise</strong>

   Create a random population of `N` individuals.

3. <strong>Evaluate fitness</strong>

   Score each individual (higher = better). 8-queens: non-attacking pairs, max 28.

4. <strong>Select</strong>

   Pick parents with probability rising with fitness (tournament or roulette-wheel selection).

5. <strong>Crossover</strong>

   Cut two parents at a random point and swap the tails → children combine traits.

6. <strong>Mutate</strong>

   With small probability change a random gene — keeps diversity, explores.

7. <strong>Replace &amp; repeat</strong>

   The children form the next generation (often keeping the best few — <strong>elitism</strong>) until fit enough or out of time.

```python filename:Python
import random

def fitness(s):                               # non-attacking pairs; 28 = solution
    return 28 - sum(1 for i in range(8) for j in range(i + 1, 8)
                    if s[i] == s[j] or abs(s[i] - s[j]) == j - i)

def select(pop):                              # tournament selection of size 3
    return max(random.sample(pop, 3), key=fitness)

def crossover(a, b):
    cut = random.randrange(1, 8)
    return a[:cut] + b[cut:]

def mutate(s, rate=0.2):
    if random.random() < rate:
        col = random.randrange(8)
        s = s[:col] + (random.randrange(8),) + s[col + 1:]
    return s

def genetic_algorithm(size=60, generations=500):
    pop = [tuple(random.randrange(8) for _ in range(8)) for _ in range(size)]
    history = []
    for gen in range(generations):
        best = max(pop, key=fitness)
        history.append(fitness(best))
        if fitness(best) == 28:
            return best, gen, history
        children = [mutate(crossover(select(pop), select(pop))) for _ in range(size - 2)]
        pop = sorted(pop, key=fitness)[-2:] + children          # elitism: keep the best 2
    return best, generations, history

random.seed(7)
best, gen, history = genetic_algorithm()
print(best, fitness(best))           # (3, 7, 0, 2, 5, 1, 6, 4) 28
print(gen)                           # 23 ← generations needed
print(history[::4])                  # [26, 26, 27, 27, 27, 27] ← best fitness every 4th generation
```

# Crossover in one picture

|  | Genes (row of the queen in each column) |
| --- | --- |
| Parent A | `3 2 7 5 &#124; 2 4 1 1` |
| Parent B | `2 4 7 4 &#124; 7 5 5 2` |
| Child | `3 2 7 5 &#124; 7 5 5 2` — head of A, tail of B |

Crossover helps when the encoding has meaningful <strong>building blocks</strong> — contiguous substrings that are good on their own (a well-placed group of queens). If genes interact randomly, crossover is just a big random jump.

| Strength | Weakness |
| --- | --- |
| Needs only a fitness function — no gradients, works on discrete or weird spaces | Many evaluations; slow compared with problem-specific methods |
| Population explores several regions in parallel | Many knobs: population size, rates, selection pressure, encoding |
| Easy to parallelise | No optimality guarantee; can converge prematurely |

scheduling · circuit &amp; antenna design · neural architecture search · game-level generation · feature selection · evolution strategies (CMA-ES) · genetic programming

> [!WARNING] Watch out
>
> Premature convergence: if selection is too strong or mutation too weak, the population becomes clones of one early good individual and stops exploring. Raise mutation, use tournaments of smaller size, or add diversity measures.

```question
What are the main operators of a genetic algorithm?

---

Selection (fitter individuals reproduce more), crossover (combine parts of two parents) and mutation (random small changes). Elitism optionally copies the best individuals unchanged into the next generation.
```

```question
How is a GA related to local beam search?

---

Both keep a set of states and favour good ones. A GA is stochastic beam search where successors are made by combining <em>two</em> parents (crossover) rather than modifying one.
```
