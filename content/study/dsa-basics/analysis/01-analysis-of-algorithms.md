---
id: e5ba2811-3113-7344-b6f5-0ec9a0e57cda
key: topic:dsa-basics/analysis
subject: dsa-basics
topic: analysis
title: Analysis of Algorithms
slug: analysis-of-algorithms
order: 1
---

Before writing a single data structure you need a way to say <em>how fast</em> and <em>how much memory</em> an algorithm uses without timing it on one particular computer. Asymptotic notation, loop analysis and recurrences are that language — every other topic in these notes ends with a line written in it.

> [!INFO]
>
> <strong>Algorithm analysis</strong> — the process of determining the amount of time (<strong>time complexity</strong>) and memory (<strong>space complexity</strong>) an algorithm needs as a function of its input size `n`, independent of hardware, language or compiler.

# Why analyse algorithms?

> [!NOTE] Predict before you build
>
> Count operations on paper and you know whether a solution will finish for `n = 10⁶` before implementing it — no benchmark needed.

> [!NOTE] Machine-independent
>
> A faster laptop changes the constant, never the <em>shape</em> of the curve. `O(n²)` loses to `O(n log n)` on every machine once `n` is large enough.

> [!NOTE] Compare and choose
>
> Two correct algorithms for the same problem are compared by their order of growth — the standard interview follow-up is always “can you do better?”.

> [!NOTE] Common vocabulary
>
> “Linear”, “logarithmic”, “quadratic” are precise claims about how running time scales, understood by every engineer.

We count <strong>elementary operations</strong> (comparisons, assignments, arithmetic) rather than seconds, and we care about the <strong>order of growth</strong> — how the count scales when `n` doubles — not the exact number. Constants and lower-order terms are dropped: `3n² + 10n + 7` is simply `O(n²)`.

# Asymptotic notation: Big-O, Omega, Theta

Asymptotic analysis describes the growth of a function `f(n)` (the operation count) as `n → ∞` by comparing it with a simpler function `g(n)`. Three bounds are used:

> [!NOTE] Big-O — upper bound
>
> `f(n) = O(g(n))` if there are constants `c > 0` and `n₀` such that `f(n) ≤ c·g(n)` for all `n ≥ n₀`. “It grows <strong>no faster</strong> than `g`.” This is what we usually quote.

> [!NOTE] Omega — lower bound
>
> `f(n) = Ω(g(n))` if `f(n) ≥ c·g(n)` for all `n ≥ n₀`. “It grows <strong>at least</strong> as fast as `g`.” Used to prove problems need a minimum amount of work (comparison sorting is `Ω(n log n)`).

> [!NOTE] Theta — tight bound
>
> `f(n) = Θ(g(n))` if `c₁·g(n) ≤ f(n) ≤ c₂·g(n)` for all `n ≥ n₀` — both `O` and `Ω` hold. “It grows <strong>exactly</strong> like `g`.”

`f(n) = O(g(n)) ⇔ ∃ c > 0, n₀ : f(n) ≤ c · g(n) for all n ≥ n₀`

> [!TIP] Worked example
>
> `f(n) = 3n² + 10n + 7`. For `n ≥ 1`, `10n ≤ 10n²` and `7 ≤ 7n²`, so `f(n) ≤ 20n²` — pick `c = 20`, `n₀ = 1` and `f(n) = O(n²)`. Also `f(n) ≥ 3n²`, so `f(n) = Ω(n²)`, and therefore `f(n) = Θ(n²)`.

| Expression | Simplified | Why |
| --- | --- | --- |
| `5n + 20` | `O(n)` | drop the constant factor 5 and the lower-order term 20 |
| `n² + n log n` | `O(n²)` | `n log n` grows slower than `n²` |
| `2ⁿ + n¹⁰⁰` | `O(2ⁿ)` | any exponential eventually beats any polynomial |
| `log₂ n` vs `log₁₀ n` | both `O(log n)` | logarithms of different bases differ by a constant factor (`log₂ n = 3.32 · log₁₀ n`) |
| `n + m` | `O(n + m)` | two independent sizes stay in the answer — neither can be dropped |
| `100` | `O(1)` | constant — does not depend on `n` at all |

> [!WARNING] Big-O is not “worst case”
>
> `O`, `Ω`, `Θ` are <strong>bounds on a function</strong>; <em>best case</em>, <em>worst case</em> and <em>average case</em> are <strong>which input</strong> you analyse. They are independent: linear search is `Θ(1)` in the best case and `Θ(n)` in the worst case. When someone says “the algorithm is `O(n²)`” they almost always mean the worst-case running time is `Θ(n²)` — say which case you mean.

> [!NOTE] Key point
>
> Because `O` is only an upper bound, `n = O(n²)` is technically true — but useless. Always give the <strong>tightest</strong> bound you can prove; that is why `Θ` is the honest answer in a proof and `O` is the everyday shorthand for it.

# Big-O growth table

The classes below cover almost every algorithm you will meet, from fastest to slowest. The right-hand column is the rule of thumb for coding interviews and contests: roughly `10⁸` simple operations run in about a second.

| Class | Name | `n = 10` | `n = 100` | `n = 1000` | Largest `n` in \~1 s | Typical example |
| --- | --- | --- | --- | --- | --- | --- |
| `O(1)` | constant | 1 | 1 | 1 | any | array index, hash lookup, push/pop |
| `O(log n)` | logarithmic | 3 | 7 | 10 | any | binary search, balanced BST operations |
| `O(√n)` | square root | 3 | 10 | 32 | `10¹⁶` | trial-division primality test |
| `O(n)` | linear | 10 | 100 | 1 000 | `10⁸` | linear search, one pass over an array |
| `O(n log n)` | linearithmic | 33 | 664 | 9 966 | `5·10⁶` | merge sort, heap sort, sorting then scanning |
| `O(n²)` | quadratic | 100 | 10⁴ | 10⁶ | `10⁴` | bubble/insertion sort, all pairs |
| `O(n³)` | cubic | 1 000 | 10⁶ | 10⁹ | `500` | naive matrix multiplication, Floyd–Warshall |
| `O(2ⁿ)` | exponential | 1 024 | 1.3·10³⁰ | 10³⁰¹ | `25` | all subsets, naive recursion with two branches |
| `O(n!)` | factorial | 3.6·10⁶ | 9·10¹⁵⁷ | — | `11` | all permutations, brute-force TSP |

```text filename:Order%20of%20growth%2C%20fastest%20to%20slowest
O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)
───────────────────────────────▶ slower growth, smaller feasible n
```

> [!WARNING] Pitfall
>
> Big-O hides constants, so for <em>small</em> `n` a “worse” algorithm can win: insertion sort (`O(n²)`) beats merge sort on arrays of 10–20 elements, which is exactly why library sorts switch to it for tiny sub-arrays. Big-O tells you what happens as `n` grows, not which program is faster on your input.

# How to analyse a loop

Almost all non-recursive analysis reduces to one question per loop: <strong>how many times does the body run as a function of </strong><strong>`n`</strong><strong>?</strong> Then combine the loops with two rules.

1. <strong>Find the loop variable's path</strong>

   Write down its start value, its stop condition and how it changes per iteration (`+1`, `+k`, `×2`, squared…).

2. <strong>Solve for the iteration count</strong>

   `i = 0, 1, 2, … n−1` → `n` iterations. `i = n, n−k, n−2k…` → `n/k`. `i = 1, 2, 4, 8 … n` → `log₂ n`. `i = 2, 2², 2⁴, 2⁸ … n` → `log log n`.

3. <strong>Nested loops multiply</strong>

   If the inner loop runs `g(n)` times for each of `f(n)` outer iterations, the total is `f(n) · g(n)`. When the inner count depends on `i`, <strong>sum</strong> it: `Σ i` for `i = 1..n` is `n(n+1)/2 = Θ(n²)`.

4. <strong>Sequential loops add</strong>

   Loop A then loop B costs `A + B`; keep only the dominant term (`n² + n = O(n²)`), but keep both when sizes are independent (`O(n + m)`).

5. <strong>Charge the body</strong>

   Multiply the iteration count by the cost of the body. A body that itself calls an `O(log n)` function inside an `O(n)` loop gives `O(n log n)`.

6. <strong>Drop constants and lower-order terms</strong>

   `3n + 5 → O(n)`; `n²/2 + n → O(n²)`. Keep the tightest class that remains.

| Loop variable moves… | Example | Iterations | Class |
| --- | --- | --- | --- |
| by a constant (`+1`, `−1`) | `for i in range(n)` | `n` | `O(n)` |
| by a constant `k` | `while x >= b: x -= b` | `n / k` | `O(n)` — the `1/k` is a constant |
| multiplied / divided by `c` | `while x < n: x *= c` | `log_c n` | `O(log n)` |
| raised to a power `c` | `while x < n: x = x ** c` | `log log n` | `O(log log n)` |
| inner loop `0..n` for every outer `0..n` | `for i … for j …` | `n · n` | `O(n²)` |
| inner loop `i..n` (triangle) | `for i … for j in range(i, n)` | `n(n+1)/2` | `O(n²)` — half the square is still a square |
| inner loop doubles | `for i … j = 1; while j <= n: j *= 2` | `n · log n` | `O(n log n)` |

# Loop pattern: linear and fractional increments

The learner's original four examples are kept here, instrumented to <strong>print their iteration count</strong> so the complexity is visible. `add` decrements `b` by one per iteration, so it runs `b` times — `O(b)`. `subtract` removes `b` from `a` per iteration, so it runs `a / b` times — still linear in `a` for a fixed `b`, because `1/b` is a constant factor.

```python filename:Python
def add(a, b):              # result += 1 while b counts down: O(b)
    result, steps = a, 0
    while b > 0:
        result += 1
        b -= 1
        steps += 1
    return result, steps

def subtract(a, b):         # how many times does b fit in a? O(a / b)
    count, steps = 0, 0
    while a >= b:
        a -= b
        count += 1
        steps += 1
    return count, steps

for a, b in [(5, 7), (5, 70)]:
    r, s = add(a, b)
    print(f"add({a}, {b}) = {r} after {s} iterations")
for a, b in [(100, 10), (1000, 10)]:
    r, s = subtract(a, b)
    print(f"subtract({a}, {b}) = {r} after {s} iterations")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int steps;                          // iteration counter shared by both functions

int add(int a, int b) {             // result += 1 while b counts down: O(b)
    int result = a;
    steps = 0;
    while (b > 0) { result++; b--; steps++; }
    return result;
}

int subtract(int a, int b) {        // how many times does b fit in a? O(a / b)
    int count = 0;
    steps = 0;
    while (a >= b) { a -= b; count++; steps++; }
    return count;
}

int main() {
    int adds[2][2] = {{5, 7}, {5, 70}};
    for (auto& ab : adds) {
        int r = add(ab[0], ab[1]);
        cout << "add(" << ab[0] << ", " << ab[1] << ") = " << r << " after " << steps << " iterations\n";
    }
    int subs[2][2] = {{100, 10}, {1000, 10}};
    for (auto& ab : subs) {
        int r = subtract(ab[0], ab[1]);
        cout << "subtract(" << ab[0] << ", " << ab[1] << ") = " << r << " after " << steps << " iterations\n";
    }
}
```

```java filename:Java
public class Main {
    static int steps;                       // iteration counter shared by both functions

    static int add(int a, int b) {          // result += 1 while b counts down: O(b)
        int result = a;
        steps = 0;
        while (b > 0) { result++; b--; steps++; }
        return result;
    }

    static int subtract(int a, int b) {     // how many times does b fit in a? O(a / b)
        int count = 0;
        steps = 0;
        while (a >= b) { a -= b; count++; steps++; }
        return count;
    }

    public static void main(String[] args) {
        int[][] adds = {{5, 7}, {5, 70}};
        for (int[] ab : adds) {
            int r = add(ab[0], ab[1]);
            System.out.println("add(" + ab[0] + ", " + ab[1] + ") = " + r + " after " + steps + " iterations");
        }
        int[][] subs = {{100, 10}, {1000, 10}};
        for (int[] ab : subs) {
            int r = subtract(ab[0], ab[1]);
            System.out.println("subtract(" + ab[0] + ", " + ab[1] + ") = " + r + " after " + steps + " iterations");
        }
    }
}
```

```javascript filename:JavaScript
function add(a, b) {                // result += 1 while b counts down: O(b)
    let result = a, steps = 0;
    while (b > 0) { result++; b--; steps++; }
    return [result, steps];
}

function subtract(a, b) {           // how many times does b fit in a? O(a / b)
    let count = 0, steps = 0;
    while (a >= b) { a -= b; count++; steps++; }
    return [count, steps];
}

for (const [a, b] of [[5, 7], [5, 70]]) {
    const [r, s] = add(a, b);
    console.log(`add(${a}, ${b}) = ${r} after ${s} iterations`);
}
for (const [a, b] of [[100, 10], [1000, 10]]) {
    const [r, s] = subtract(a, b);
    console.log(`subtract(${a}, ${b}) = ${r} after ${s} iterations`);
}
```

```text filename:Output
add(5, 7) = 12 after 7 iterations
add(5, 70) = 75 after 70 iterations
subtract(100, 10) = 10 after 10 iterations
subtract(1000, 10) = 100 after 100 iterations
```

Time O(n) — n iterations, or n/k for a step of k · Space O(1)

> [!NOTE] Key point
>
> Ten times the input → ten times the iterations: that proportionality <strong>is</strong> linear time. `subtract(1000, 10)` runs 100 times, not 1000, but the `1/10` is a constant and disappears in Big-O.

# Loop pattern: logarithmic and log-log scaling

When the loop variable is <strong>multiplied</strong> by a constant `c` each round, it reaches `n` after `log_c n` rounds — a thousandfold larger input adds only a handful of iterations. When the variable is <strong>raised to a power</strong> each round (`2 → 4 → 16 → 256 → 65536`), the exponent itself doubles, so the loop runs `log log n` times — practically constant.

```python filename:Python
def multiply(n, c):          # result *= c until it reaches n: log_c(n) iterations
    result, steps = 1, 0
    while result < n:
        result *= c
        steps += 1
    return result, steps

def exponent(n, c):          # result = result ** c: the exponent doubles each time → log log n
    result, steps = 2, 0
    while result < n:
        result = result ** c
        steps += 1
    return result, steps

for n, c in [(1000, 10), (1024, 2), (1000000, 2)]:
    r, s = multiply(n, c)
    print(f"multiply({n}, {c}) = {r} after {s} iterations")
for n, c in [(65536, 2), (1000000000, 2)]:
    r, s = exponent(n, c)
    print(f"exponent({n}, {c}) = {r} after {s} iterations")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int steps;

long long multiply(long long n, long long c) {   // result *= c until it reaches n: log_c(n)
    long long result = 1;
    steps = 0;
    while (result < n) { result *= c; steps++; }
    return result;
}

long long ipow(long long base, long long e) {    // integer power for the log-log loop
    long long r = 1;
    for (long long i = 0; i < e; i++) r *= base;
    return r;
}

long long exponent(long long n, long long c) {   // result = result^c: exponent doubles → log log n
    long long result = 2;
    steps = 0;
    while (result < n) { result = ipow(result, c); steps++; }
    return result;
}

int main() {
    long long m[3][2] = {{1000, 10}, {1024, 2}, {1000000, 2}};
    for (auto& nc : m) {
        long long r = multiply(nc[0], nc[1]);
        cout << "multiply(" << nc[0] << ", " << nc[1] << ") = " << r << " after " << steps << " iterations\n";
    }
    long long e[2][2] = {{65536, 2}, {1000000000, 2}};
    for (auto& nc : e) {
        long long r = exponent(nc[0], nc[1]);
        cout << "exponent(" << nc[0] << ", " << nc[1] << ") = " << r << " after " << steps << " iterations\n";
    }
}
```

```java filename:Java
public class Main {
    static int steps;

    static long multiply(long n, long c) {     // result *= c until it reaches n: log_c(n)
        long result = 1;
        steps = 0;
        while (result < n) { result *= c; steps++; }
        return result;
    }

    static long ipow(long base, long e) {      // integer power for the log-log loop
        long r = 1;
        for (long i = 0; i < e; i++) r *= base;
        return r;
    }

    static long exponent(long n, long c) {     // result = result^c: exponent doubles → log log n
        long result = 2;
        steps = 0;
        while (result < n) { result = ipow(result, c); steps++; }
        return result;
    }

    public static void main(String[] args) {
        long[][] m = {{1000, 10}, {1024, 2}, {1000000, 2}};
        for (long[] nc : m) {
            long r = multiply(nc[0], nc[1]);
            System.out.println("multiply(" + nc[0] + ", " + nc[1] + ") = " + r + " after " + steps + " iterations");
        }
        long[][] e = {{65536, 2}, {1000000000L, 2}};
        for (long[] nc : e) {
            long r = exponent(nc[0], nc[1]);
            System.out.println("exponent(" + nc[0] + ", " + nc[1] + ") = " + r + " after " + steps + " iterations");
        }
    }
}
```

```javascript filename:JavaScript
function multiply(n, c) {        // result *= c until it reaches n: log_c(n) iterations
    let result = 1, steps = 0;
    while (result < n) { result *= c; steps++; }
    return [result, steps];
}

function exponent(n, c) {        // result = result ** c: exponent doubles each time → log log n
    let result = 2, steps = 0;
    while (result < n) { result = result ** c; steps++; }
    return [result, steps];
}

for (const [n, c] of [[1000, 10], [1024, 2], [1000000, 2]]) {
    const [r, s] = multiply(n, c);
    console.log(`multiply(${n}, ${c}) = ${r} after ${s} iterations`);
}
for (const [n, c] of [[65536, 2], [1000000000, 2]]) {
    const [r, s] = exponent(n, c);
    console.log(`exponent(${n}, ${c}) = ${r} after ${s} iterations`);
}
```

```text filename:Output
multiply(1000, 10) = 1000 after 3 iterations
multiply(1024, 2) = 1024 after 10 iterations
multiply(1000000, 2) = 1048576 after 20 iterations
exponent(65536, 2) = 65536 after 4 iterations
exponent(1000000000, 2) = 4294967296 after 5 iterations
```

Time O(log n) for multiply, O(log log n) for exponent · Space O(1)

> [!NOTE] Key point
>
> `multiply(1000000, 2)` needs only 20 rounds and `exponent(10⁹, 2)` only 5. Whenever you see a loop variable that <em>halves</em> or <em>doubles</em> — binary search, heap sift, exponentiation by squaring — think `log n`.

# Loop pattern: nested and sequential loops

Nested loops <strong>multiply</strong>; loops one after another <strong>add</strong>. The program below counts the body executions of three classic nestings for `n = 8` so you can match each count to its formula.

```python filename:Python
n = 8

square = 0
for i in range(n):
    for j in range(n):           # inner runs n times for each of n outer → n²
        square += 1

triangle = 0
for i in range(n):
    for j in range(i, n):        # inner runs n-i times: n + (n-1) + … + 1 = n(n+1)/2
        triangle += 1

doubling = 0
for i in range(n):
    j = 1
    while j <= n:                # inner doubles: log2(n) + 1 rounds → n log n
        doubling += 1
        j *= 2

sequential = 0
for i in range(n):               # one loop then another: n + n = 2n → O(n)
    sequential += 1
for i in range(n):
    sequential += 1

print("n =", n)
print(f"square (i in 0..n, j in 0..n): {square} = n*n")
print(f"triangle (i in 0..n, j in i..n): {triangle} = n(n+1)/2")
print(f"doubling (i in 0..n, j = 1,2,4..n): {doubling} = n * (log2 n + 1)")
print(f"sequential (loop n then loop n): {sequential} = 2n")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

int main() {
    int n = 8;

    int square = 0;
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++) square++;          // n * n

    int triangle = 0;
    for (int i = 0; i < n; i++)
        for (int j = i; j < n; j++) triangle++;        // n + (n-1) + … + 1 = n(n+1)/2

    int doubling = 0;
    for (int i = 0; i < n; i++)
        for (int j = 1; j <= n; j *= 2) doubling++;    // inner doubles: log2(n) + 1 rounds

    int sequential = 0;
    for (int i = 0; i < n; i++) sequential++;          // n + n = 2n → O(n)
    for (int i = 0; i < n; i++) sequential++;

    cout << "n = " << n << "\n";
    cout << "square (i in 0..n, j in 0..n): " << square << " = n*n\n";
    cout << "triangle (i in 0..n, j in i..n): " << triangle << " = n(n+1)/2\n";
    cout << "doubling (i in 0..n, j = 1,2,4..n): " << doubling << " = n * (log2 n + 1)\n";
    cout << "sequential (loop n then loop n): " << sequential << " = 2n\n";
}
```

```java filename:Java
public class Main {
    public static void main(String[] args) {
        int n = 8;

        int square = 0;
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++) square++;          // n * n

        int triangle = 0;
        for (int i = 0; i < n; i++)
            for (int j = i; j < n; j++) triangle++;        // n + (n-1) + … + 1 = n(n+1)/2

        int doubling = 0;
        for (int i = 0; i < n; i++)
            for (int j = 1; j <= n; j *= 2) doubling++;    // inner doubles: log2(n) + 1 rounds

        int sequential = 0;
        for (int i = 0; i < n; i++) sequential++;          // n + n = 2n → O(n)
        for (int i = 0; i < n; i++) sequential++;

        System.out.println("n = " + n);
        System.out.println("square (i in 0..n, j in 0..n): " + square + " = n*n");
        System.out.println("triangle (i in 0..n, j in i..n): " + triangle + " = n(n+1)/2");
        System.out.println("doubling (i in 0..n, j = 1,2,4..n): " + doubling + " = n * (log2 n + 1)");
        System.out.println("sequential (loop n then loop n): " + sequential + " = 2n");
    }
}
```

```javascript filename:JavaScript
const n = 8;

let square = 0;
for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) square++;          // n * n

let triangle = 0;
for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) triangle++;        // n + (n-1) + … + 1 = n(n+1)/2

let doubling = 0;
for (let i = 0; i < n; i++)
    for (let j = 1; j <= n; j *= 2) doubling++;    // inner doubles: log2(n) + 1 rounds

let sequential = 0;
for (let i = 0; i < n; i++) sequential++;          // n + n = 2n → O(n)
for (let i = 0; i < n; i++) sequential++;

console.log("n =", n);
console.log(`square (i in 0..n, j in 0..n): ${square} = n*n`);
console.log(`triangle (i in 0..n, j in i..n): ${triangle} = n(n+1)/2`);
console.log(`doubling (i in 0..n, j = 1,2,4..n): ${doubling} = n * (log2 n + 1)`);
console.log(`sequential (loop n then loop n): ${sequential} = 2n`);
```

```text filename:Output
n = 8
square (i in 0..n, j in 0..n): 64 = n*n
triangle (i in 0..n, j in i..n): 36 = n(n+1)/2
doubling (i in 0..n, j = 1,2,4..n): 32 = n * (log2 n + 1)
sequential (loop n then loop n): 16 = 2n
```

Time O(n²), O(n²), O(n log n), O(n) respectively · Space O(1)

> [!WARNING] Pitfall
>
> “The inner loop starts at `i`, so it is only half the work — `O(n²/2)`, which is better.” It is not: `n²/2` is `Θ(n²)`. Halving a quadratic leaves a quadratic; only a change in the <em>shape</em> (e.g. doubling instead of incrementing) changes the class.

# Recurrence relations for recursive algorithms

A recursive algorithm's running time is defined in terms of itself: the cost of the current call plus the cost of the recursive calls it makes. Writing that down gives a <strong>recurrence relation</strong>; solving it gives the complexity.

> [!INFO]
>
> <strong>Recurrence relation</strong> — an equation that expresses `T(n)`, the time for input size `n`, in terms of `T` on smaller inputs plus the work done outside the recursive calls, with a base case such as `T(1) = Θ(1)`. Example: merge sort is `T(n) = 2T(n/2) + Θ(n)`.

| Algorithm | Recurrence | What it says | Solution |
| --- | --- | --- | --- |
| Linear recursion (sum of `n` numbers, factorial) | `T(n) = T(n−1) + Θ(1)` | one call of size `n−1`, constant work | `Θ(n)` |
| Binary search | `T(n) = T(n/2) + Θ(1)` | one call on half the input | `Θ(log n)` |
| Merge sort | `T(n) = 2T(n/2) + Θ(n)` | two halves plus a linear merge | `Θ(n log n)` |
| Selection sort written recursively | `T(n) = T(n−1) + Θ(n)` | one smaller call plus a linear scan | `Θ(n²)` |
| Tower of Hanoi | `T(n) = 2T(n−1) + Θ(1)` | two calls on `n−1` discs | `Θ(2ⁿ)` |
| Naive Fibonacci | `T(n) = T(n−1) + T(n−2) + Θ(1)` | two calls, barely smaller | `Θ(φⁿ) ≈ Θ(1.618ⁿ)` |
| Strassen matrix multiply | `T(n) = 7T(n/2) + Θ(n²)` | seven half-size products | `Θ(n^log₂7) ≈ Θ(n^2.81)` |

Three methods solve a recurrence:

> [!NOTE] Substitution method
>
> <strong>Guess</strong> the answer (e.g. `T(n) = O(n log n)`), then prove it by induction: assume it holds for all smaller sizes, substitute into the recurrence, and show it still holds for `n`. Rigorous but needs a good guess.

> [!NOTE] Recursion tree method
>
> <strong>Draw</strong> the calls as a tree. Write the non-recursive work at every node, sum each level, then sum the levels. It makes the guess for substitution obvious and is the way to <em>see</em> why merge sort is `n log n`.

> [!NOTE] Master method
>
> A <strong>template</strong> for `T(n) = aT(n/b) + f(n)`: compare `f(n)` with `n^(log_b a)` and read off the answer. Covers most divide-and-conquer algorithms in one line.

# Recursion tree: why merge sort is n log n

For `T(n) = 2T(n/2) + n` every level of the tree does `n` work in total — the input is split in half but there are twice as many pieces. There are `log₂ n` levels of splitting plus the leaves, so the total is `n · (log₂ n + 1) = Θ(n log n)`.

```text filename:Recursion%20tree%20of%20T(n)%20%3D%202T(n%2F2)%20%2B%20n
level 0:                 n                       work: n
                      /     \
level 1:          n/2         n/2                work: 2 · n/2  = n
                 /   \       /   \
level 2:       n/4   n/4   n/4   n/4             work: 4 · n/4  = n
                …     …     …     …
level log n:   1  1  1  1  1  1  1  1   (n leaves)  work: n · 1 = n
                                                  ─────────────────
                                      total: n · (log₂ n + 1) = Θ(n log n)
```

The program below evaluates that recurrence exactly for powers of two and prints the total next to the closed form — the two columns agree at every size.

```python filename:Python
def T(n):                        # T(n) = 2 T(n/2) + n, T(1) = 1
    if n == 1:
        return 1
    return 2 * T(n // 2) + n

def closed(n):                   # n * (log2 n + 1)
    log2 = 0
    while (1 << log2) < n:
        log2 += 1
    return n * (log2 + 1)

for n in [1, 2, 4, 8, 16, 1024]:
    print(f"n = {n}: T(n) = {T(n)}, n*(log2 n + 1) = {closed(n)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

long long T(long long n) {               // T(n) = 2 T(n/2) + n, T(1) = 1
    if (n == 1) return 1;
    return 2 * T(n / 2) + n;
}

long long closed(long long n) {          // n * (log2 n + 1)
    int log2 = 0;
    while ((1LL << log2) < n) log2++;
    return n * (log2 + 1);
}

int main() {
    for (long long n : {1, 2, 4, 8, 16, 1024})
        cout << "n = " << n << ": T(n) = " << T(n) << ", n*(log2 n + 1) = " << closed(n) << "\n";
}
```

```java filename:Java
public class Main {
    static long T(long n) {                  // T(n) = 2 T(n/2) + n, T(1) = 1
        if (n == 1) return 1;
        return 2 * T(n / 2) + n;
    }

    static long closed(long n) {             // n * (log2 n + 1)
        int log2 = 0;
        while ((1L << log2) < n) log2++;
        return n * (log2 + 1);
    }

    public static void main(String[] args) {
        for (long n : new long[]{1, 2, 4, 8, 16, 1024})
            System.out.println("n = " + n + ": T(n) = " + T(n) + ", n*(log2 n + 1) = " + closed(n));
    }
}
```

```javascript filename:JavaScript
function T(n) {                          // T(n) = 2 T(n/2) + n, T(1) = 1
    if (n === 1) return 1;
    return 2 * T(Math.floor(n / 2)) + n;
}

function closed(n) {                     // n * (log2 n + 1)
    let log2 = 0;
    while ((1 << log2) < n) log2++;
    return n * (log2 + 1);
}

for (const n of [1, 2, 4, 8, 16, 1024])
    console.log(`n = ${n}: T(n) = ${T(n)}, n*(log2 n + 1) = ${closed(n)}`);
```

```text filename:Output
n = 1: T(n) = 1, n*(log2 n + 1) = 1
n = 2: T(n) = 4, n*(log2 n + 1) = 4
n = 4: T(n) = 12, n*(log2 n + 1) = 12
n = 8: T(n) = 32, n*(log2 n + 1) = 32
n = 16: T(n) = 80, n*(log2 n + 1) = 80
n = 1024: T(n) = 11264, n*(log2 n + 1) = 11264
```

Time Θ(n log n) — the recurrence's solution · Space O(log n) recursion depth

# Master theorem

For divide-and-conquer recurrences of the form `T(n) = a·T(n/b) + f(n)` with `a ≥ 1` subproblems each of size `n/b` (`b > 1`), the answer depends on which wins: the leaves (`n^(log_b a)` of them, each `Θ(1)`) or the root's work `f(n)`.

`T(n) = a · T(n / b) + f(n) — compare f(n) with n^(log_b a)`

| Case | Condition | Meaning | Result |
| --- | --- | --- | --- |
| 1 — leaves dominate | `f(n) = O(n^(log_b a − ε))` for some `ε > 0` | `f(n)` is polynomially <em>smaller</em> than `n^(log_b a)` | `T(n) = Θ(n^(log_b a))` |
| 2 — balanced | `f(n) = Θ(n^(log_b a))` | every level does the same work; there are `log n` levels | `T(n) = Θ(n^(log_b a) · log n)` |
| 3 — root dominates | `f(n) = Ω(n^(log_b a + ε))` and `a·f(n/b) ≤ c·f(n)` for some `c < 1` | `f(n)` is polynomially <em>larger</em>; the top call does most of the work | `T(n) = Θ(f(n))` |

| Recurrence | `a`, `b` | `n^(log_b a)` | `f(n)` | Case | Solution |
| --- | --- | --- | --- | --- | --- |
| `T(n) = 2T(n/2) + n` (merge sort) | 2, 2 | `n¹` | `n` | 2 | `Θ(n log n)` |
| `T(n) = T(n/2) + 1` (binary search) | 1, 2 | `n⁰ = 1` | `1` | 2 | `Θ(log n)` |
| `T(n) = 4T(n/2) + n` | 4, 2 | `n²` | `n` | 1 | `Θ(n²)` |
| `T(n) = 8T(n/2) + n²` (naive matrix multiply) | 8, 2 | `n³` | `n²` | 1 | `Θ(n³)` |
| `T(n) = 7T(n/2) + n²` (Strassen) | 7, 2 | `n^2.81` | `n²` | 1 | `Θ(n^log₂7)` |
| `T(n) = 2T(n/2) + n²` | 2, 2 | `n` | `n²` | 3 | `Θ(n²)` |
| `T(n) = T(n/2) + n` | 1, 2 | `1` | `n` | 3 | `Θ(n)` |
| `T(n) = 2T(n/2) + n log n` | 2, 2 | `n` | `n log n` | none — not polynomially larger | `Θ(n log² n)` (extended form) |

1. <strong>Identify </strong><strong>`a`</strong><strong>, </strong><strong>`b`</strong><strong>, </strong><strong>`f(n)`</strong>

   `a` = number of recursive calls, `b` = the factor the input shrinks by, `f(n)` = the work done outside the calls (splitting, merging, scanning).

2. <strong>Compute the critical exponent</strong>

   `p = log_b a`. Examples: `a = 2, b = 2 → p = 1`; `a = 4, b = 2 → p = 2`; `a = 1, b = 2 → p = 0`.

3. <strong>Compare </strong><strong>`f(n)`</strong><strong> with </strong><strong>`n^p`</strong>

   Smaller by a polynomial factor → case 1. Equal → case 2. Larger by a polynomial factor → case 3 (check regularity).

4. <strong>Read off </strong><strong>`T(n)`</strong>

   `Θ(n^p)`, `Θ(n^p log n)` or `Θ(f(n))`.

> [!WARNING] When it does not apply
>
> The master theorem does <strong>not</strong> apply when the sub-problems are not of size `n/b` (`T(n) = T(n−1) + …` — use the recursion tree or unroll by hand), when `a < 1`, or when `f(n)` differs from `n^(log_b a)` by less than a polynomial factor (`n log n` vs `n` is only a `log` apart — a gap between cases 2 and 3). `T(n) = 2T(n/2) + n log n` is the standard trap.

# Space complexity vs auxiliary space

| Term | What is counted | Example: sum an array of `n` numbers iteratively |
| --- | --- | --- |
| <strong>Space complexity</strong> | all memory the algorithm needs — the input itself <strong>plus</strong> any extra | `O(n)` — the array has to be there |
| <strong>Auxiliary space</strong> | only the <strong>extra</strong> memory beyond the input: temporaries, new arrays, hash maps, the recursion stack | `O(1)` — one accumulator |

Interviewers nearly always mean <strong>auxiliary space</strong> when they ask “what is the space complexity?”, because it is what distinguishes solutions: sorting in place is `O(1)` auxiliary, merge sort's buffer is `O(n)`, and a recursive solution pays for its call stack. Recursion is the classic hidden cost — each pending call keeps a frame alive until it returns.

> [!TIP] Example
>
> <strong>Input:</strong> `n = 5`<br><strong>Output:</strong> `sum = 15, deepest call stack = 6 frames (n + 1: the base-case call add_recursion(0) is a frame too)`

```python filename:Python
depth = 0
max_depth = 0

def add_recursion(n):            # each pending call holds a frame: O(n) auxiliary space
    global depth, max_depth
    depth += 1
    max_depth = max(max_depth, depth)
    result = 0 if n <= 0 else n + add_recursion(n - 1)
    depth -= 1
    return result

def add_iterative(n):            # a counter and an accumulator: O(1) auxiliary space
    total = 0
    for i in range(1, n + 1):
        total += i
    return total

for n in (5, 50):
    max_depth = 0
    print(f"add_recursion({n}) = {add_recursion(n)}, max depth = {max_depth}")
print(f"add_iterative(50) = {add_iterative(50)}, extra variables = 2")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <algorithm>
using namespace std;

int depth = 0, maxDepth = 0;

int addRecursion(int n) {            // each pending call holds a frame: O(n) auxiliary space
    depth++;
    maxDepth = max(maxDepth, depth);
    int result = n <= 0 ? 0 : n + addRecursion(n - 1);
    depth--;
    return result;
}

int addIterative(int n) {            // a counter and an accumulator: O(1) auxiliary space
    int total = 0;
    for (int i = 1; i <= n; i++) total += i;
    return total;
}

int main() {
    for (int n : {5, 50}) {
        maxDepth = 0;
        int r = addRecursion(n);
        cout << "add_recursion(" << n << ") = " << r << ", max depth = " << maxDepth << "\n";
    }
    cout << "add_iterative(50) = " << addIterative(50) << ", extra variables = 2\n";
}
```

```java filename:Java
public class Main {
    static int depth = 0, maxDepth = 0;

    static int addRecursion(int n) {         // each pending call holds a frame: O(n) auxiliary space
        depth++;
        maxDepth = Math.max(maxDepth, depth);
        int result = n <= 0 ? 0 : n + addRecursion(n - 1);
        depth--;
        return result;
    }

    static int addIterative(int n) {         // a counter and an accumulator: O(1) auxiliary space
        int total = 0;
        for (int i = 1; i <= n; i++) total += i;
        return total;
    }

    public static void main(String[] args) {
        for (int n : new int[]{5, 50}) {
            maxDepth = 0;
            int r = addRecursion(n);
            System.out.println("add_recursion(" + n + ") = " + r + ", max depth = " + maxDepth);
        }
        System.out.println("add_iterative(50) = " + addIterative(50) + ", extra variables = 2");
    }
}
```

```javascript filename:JavaScript
let depth = 0, maxDepth = 0;

function addRecursion(n) {           // each pending call holds a frame: O(n) auxiliary space
    depth++;
    maxDepth = Math.max(maxDepth, depth);
    const result = n <= 0 ? 0 : n + addRecursion(n - 1);
    depth--;
    return result;
}

function addIterative(n) {           // a counter and an accumulator: O(1) auxiliary space
    let total = 0;
    for (let i = 1; i <= n; i++) total += i;
    return total;
}

for (const n of [5, 50]) {
    maxDepth = 0;
    const r = addRecursion(n);
    console.log(`add_recursion(${n}) = ${r}, max depth = ${maxDepth}`);
}
console.log(`add_iterative(50) = ${addIterative(50)}, extra variables = 2`);
```

```text filename:Output
add_recursion(5) = 15, max depth = 6
add_recursion(50) = 1275, max depth = 51
add_iterative(50) = 1275, extra variables = 2
```

Time O(n) time for both · Space O(n) auxiliary (recursive) vs O(1) (iterative)

> [!WARNING] Pitfall
>
> Counting the recursion stack is the step most people forget: the recursive sum <em>looks</em> like it uses no memory, yet `n + 1` frames are alive at the deepest point. Python stops at about 1000 frames with `RecursionError`; C++ and Java crash with a stack overflow a few thousand frames later. Depth, not the number of calls, is what costs space — a function that makes `2ⁿ` calls but is never more than `n` deep uses `O(n)` stack.

# Interview Q&amp;A

```question
What is the difference between Big-O, Big-Omega and Big-Theta?

---

`O(g)` is an upper bound (grows no faster than `g`), `Ω(g)` a lower bound (grows at least as fast), `Θ(g)` a tight bound (both). All three are statements about a function's growth, not about best or worst case. In everyday use “`O(n log n)`” is shorthand for “the worst case is `Θ(n log n)`”.
```

```question
Why do we ignore constants and lower-order terms?

---

Because they depend on the machine, the compiler and the exact operation mix — and because for large `n` they do not change which algorithm wins: `100n` beats `n²` as soon as `n > 100`. Asymptotic notation captures what survives all those details: the shape of the growth curve. Constants still matter when choosing between two algorithms of the <em>same</em> class.
```

```question
Can an O(n²) algorithm be faster than an O(n log n) one?

---

Yes, for small inputs or when the constant factors differ a lot. Insertion sort beats merge sort below roughly 20 elements, which is why production sorts (Timsort, introsort) switch to it for small sub-arrays. Big-O describes behaviour as `n → ∞`, not the timing of a particular run.
```

```question
How do you find the time complexity of nested loops?

---

Count the body executions: multiply independent loop counts (`n × n = n²`), sum dependent ones (`Σ (n − i) = n(n+1)/2 = Θ(n²)`), and multiply by the body's own cost. Watch the increment: `i += 1` gives `n`, `i *= 2` gives `log n`, `i = i²` gives `log log n`.
```

```question
What is the master theorem and when can you not use it?

---

For `T(n) = aT(n/b) + f(n)` it compares `f(n)` with `n^(log_b a)`: polynomially smaller → `Θ(n^(log_b a))`; equal → `Θ(n^(log_b a) log n)`; polynomially larger (with the regularity condition) → `Θ(f(n))`. It does not apply to subtract-and-conquer recurrences like `T(n−1)`, to `a < 1`, or when `f(n)` and `n^(log_b a)` differ by only a logarithmic factor (`2T(n/2) + n log n`), which needs the extended version or a recursion tree.
```

```question
What is the difference between space complexity and auxiliary space?

---

Space complexity counts everything including the input; auxiliary space counts only the extra memory the algorithm allocates — temporaries, new containers and the recursion stack. Interviewers mean auxiliary space: an in-place sort is `O(1)`, merge sort is `O(n)`, and a recursive function is at least `O(depth)`.
```

```question
What is amortised analysis?

---

Averaging the cost of an operation over a long sequence rather than looking at the worst single call. Appending to a dynamic array occasionally costs `O(n)` to resize, but doubling the capacity makes the total for `n` appends `O(n)`, so each append is <strong>amortised</strong> `O(1)`. It is a guarantee about the sequence, not a probability — unlike average-case analysis.
```
