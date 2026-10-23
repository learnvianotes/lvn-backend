---
id: e681f77a-8543-768b-9d27-b219ba001134
key: topic:c/recursion
subject: c
topic: recursion
title: Recursion
slug: recursion
order: 1
---

A recursive function calls itself on a smaller problem until it reaches a <em>base case</em>. Each call gets its own stack frame, so depth is limited by the stack size.

# Anatomy

```c filename:C
#include <stdio.h>

unsigned long long factorial(unsigned n) {
    if (n <= 1) return 1;              /* base case */
    return n * factorial(n - 1);       /* recursive case: smaller input */
}

int main(void) {
    for (unsigned i = 0; i <= 5; i++) printf("%u! = %llu\n", i, factorial(i));
    printf("20! = %llu\n", factorial(20));
    return 0;
}
```

```text filename:Output
0! = 1
1! = 1
2! = 2
3! = 6
4! = 24
5! = 120
20! = 2432902008176640000
```

# How the call stack unwinds

```c filename:C
#include <stdio.h>

void count(int n, int depth) {
    if (n == 0) { printf("%*sbase\n", depth * 2, ""); return; }
    printf("%*senter %d\n", depth * 2, "", n);
    count(n - 1, depth + 1);
    printf("%*sleave %d\n", depth * 2, "", n);
}

int main(void) {
    count(3, 0);
    return 0;
}
```

```text filename:Output
enter 3
  enter 2
    enter 1
      base
    leave 1
  leave 2
leave 3
```

# Classic recursive functions

```c filename:C
#include <stdio.h>

int gcd(int a, int b) { return b == 0 ? a : gcd(b, a % b); }   /* Euclid, tail-recursive */

long power(long base, int exp) {                                /* fast exponentiation O(log n) */
    if (exp == 0) return 1;
    long half = power(base, exp / 2);
    return exp % 2 ? half * half * base : half * half;
}

int sum_digits(int n) { return n < 10 ? n : n % 10 + sum_digits(n / 10); }

void hanoi(int n, char from, char to, char via) {
    if (n == 0) return;
    hanoi(n - 1, from, via, to);
    printf("move disk %d %c->%c\n", n, from, to);
    hanoi(n - 1, via, to, from);
}

int main(void) {
    printf("gcd=%d pow=%ld digits=%d\n", gcd(84, 36), power(3, 13), sum_digits(98765));
    hanoi(2, 'A', 'C', 'B');
    return 0;
}
```

```text filename:Output
gcd=12 pow=1594323 digits=35
move disk 1 A->B
move disk 2 A->C
move disk 1 B->C
```

# Exponential blow-up and memoisation

```c filename:C
#include <stdio.h>

static long calls = 0;

long fib_naive(int n) {
    calls++;
    return n < 2 ? n : fib_naive(n - 1) + fib_naive(n - 2);
}

long memo[91];
long fib_memo(int n) {
    if (n < 2) return n;
    if (memo[n]) return memo[n];
    return memo[n] = fib_memo(n - 1) + fib_memo(n - 2);
}

int main(void) {
    printf("fib(25) = %ld using %ld calls\n", fib_naive(25), calls);
    printf("fib(90) = %ld\n", fib_memo(90));
    return 0;
}
```

```text filename:Output
fib(25) = 75025 using 242785 calls
fib(90) = 2880067194370816120
```

| Recursion | Iteration |
| --- | --- |
| Natural for trees, divide &amp; conquer, backtracking | Natural for linear scans |
| Uses O(depth) stack — risk of <strong>stack overflow</strong> | O(1) extra space |
| Function-call overhead | No call overhead |
| Tail calls <em>may</em> be optimised at `-O2` (not guaranteed by C) | Always constant stack |

> [!WARNING] Watch out
>
> Missing or unreachable base case → infinite recursion → <em>stack overflow</em> (segfault). Default stacks are only \~8 MB on Linux/macOS main threads, often much less on threads and embedded targets.

```question
What is tail recursion?

---

A call is a <em>tail call</em> when it is the last action of the function (`return f(n - 1, acc * n);`). The compiler can then reuse the current stack frame, turning recursion into a loop. C compilers do this at higher optimisation levels, but the standard does not guarantee it.
```

```question
What is the time complexity of naive recursive Fibonacci?

---

O(φⁿ) ≈ O(1.618ⁿ) calls because every call branches into two overlapping subproblems. Memoisation or a bottom-up loop makes it O(n).
```
