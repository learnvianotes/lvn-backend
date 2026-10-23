---
id: 2f941845-4021-7739-a6ae-272e017906e7
key: topic:cpp/random
subject: cpp
topic: random
title: Random Numbers with <random>
slug: random-numbers-with-random
order: 1
---

Modern C++ separates <em>engines</em> (sources of random bits) from <em>distributions</em> (shape the bits into the numbers you want). Forget `rand() % n`.

# Engine + distribution

```cpp filename:C%2B%2B
#include <iostream>
#include <random>

int main() {
    std::mt19937 rng(12345);                             // Mersenne Twister, fixed seed → reproducible
    std::uniform_int_distribution<int> dice(1, 6);       // inclusive range
    std::uniform_real_distribution<double> unit(0.0, 1.0);

    for (int i = 0; i < 5; ++i) std::cout << dice(rng) << ' ';
    std::cout << '\n';

    int counts[7] = {};
    for (int i = 0; i < 60000; ++i) ++counts[dice(rng)];
    bool roughlyUniform = true;
    for (int f = 1; f <= 6; ++f) roughlyUniform &= counts[f] > 9500 && counts[f] < 10500;
    std::cout << "uniform: " << roughlyUniform << '\n';

    double u = unit(rng);
    std::cout << (u >= 0.0 && u < 1.0) << '\n';
}
```

Exact numbers from a seeded engine are reproducible for a given standard library, but <em>distributions</em> are implementation-defined, so libc++ and libstdc++ may print different dice rolls for the same seed.

# Seeding

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <random>
#include <vector>

int main() {
    std::random_device rd;                               // non-deterministic seed source (OS entropy)
    std::mt19937 rng(rd());                              // different sequence every run
    std::vector<int> deck{1, 2, 3, 4, 5, 6, 7, 8};
    std::shuffle(deck.begin(), deck.end(), rng);
    std::sort(deck.begin(), deck.end());
    std::cout << deck.front() << deck.back() << '\n';    // deterministic after sorting
}
```

```text filename:Output
18
```

| Distribution | Produces |
| --- | --- |
| `uniform_int_distribution<int>(a, b)` | Integers in \[a, b\] |
| `uniform_real_distribution<double>(a, b)` | Reals in \[a, b) |
| `normal_distribution<double>(mean, sd)` | Gaussian |
| `bernoulli_distribution(p)` | `true` with probability p |
| `discrete_distribution<int>{w...}` | Index i with probability ∝ wᵢ |
| `poisson_distribution`, `exponential_distribution` | Counts, waiting times |

> [!TIP] Do
>
> Create <strong>one</strong> engine (seeded once) and reuse it; pass it by reference to functions that need randomness.

> [!DANGER] Avoid
>
> Re-creating `std::mt19937 rng(std::random_device{}())` on every call, or `rand() % 6` (biased, low quality, global state).

> [!WARNING] Watch out
>
> `std::mt19937` is fast and statistically good but <strong>not</strong> cryptographically secure — never use it for passwords, tokens or keys.

```question
What's wrong with rand() % n?

---

`rand()` has implementation-defined (often poor) quality and a range that may be as small as 32767; `% n` introduces <em>modulo bias</em> when `RAND_MAX + 1` isn't a multiple of `n`; and it uses hidden global state that's not thread-safe. `<random>` fixes all three.
```
