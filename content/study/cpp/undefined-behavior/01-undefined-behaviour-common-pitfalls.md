---
id: 54fbb944-1abc-7c00-88c2-af370168e321
key: topic:cpp/undefined-behavior
subject: cpp
topic: undefined-behavior
title: Undefined Behaviour & Common Pitfalls
slug: undefined-behaviour-common-pitfalls
order: 1
---

Undefined behaviour (UB) means the standard places <em>no requirements</em> on what happens. The program may crash, work by accident, or be “optimised” into something surprising. Know the usual suspects.

> [!INFO]
>
> <strong>Undefined behaviour</strong> — the result of executing an operation the standard doesn't define — e.g. out-of-bounds access or signed overflow. Compilers assume UB never happens and optimise on that assumption, so its effects can show up far from the bug.

# The usual suspects

| UB | Example | Tool that catches it |
| --- | --- | --- |
| Out-of-bounds access | `v[v.size()]`, `arr[10]` on `int arr[10]` | ASan, `.at()`, `-D_GLIBCXX_ASSERTIONS` |
| Use after free / dangling | Reference into a vector that grew, returning `&local` | ASan |
| Uninitialised read | `int x; if (x) …` | `-Wall` (sometimes), MSan, Valgrind |
| Signed integer overflow | `INT_MAX + 1` | UBSan |
| Null dereference | `*p` with `p == nullptr` | Crash / UBSan |
| Data race | Two threads write a non-atomic variable | TSan |
| Shift out of range | `1 << 32` on a 32-bit `int`, negative shift | UBSan |
| Strict-aliasing violation | `*(int*)&someFloat` | `-fstrict-aliasing` warnings; use `memcpy`/`bit_cast` |
| Modifying a const object | `const_cast` then write | — |
| Missing `return` in a non-void function | Falling off the end | `-Wreturn-type` (error in clang) |

# Sanitizers find UB for you

```cpp filename:C%2B%2B%20%E2%80%94%20heap%20buffer%20overflow
#include <iostream>
#include <vector>
int main() {
    std::vector<int> v(3);
    int* data = v.data();
    std::cout << data[3] << '\n';     // one past the end → AddressSanitizer: heap-buffer-overflow
}
```

```cpp filename:C%2B%2B%20%E2%80%94%20oversized%20shift
#include <iostream>
int main(int argc, char**) {
    int shift = 31 + argc;            // 32 at run time
    std::cout << (1 << shift) << '\n'; // UBSan: shift exponent 32 is too large for 32-bit type 'int'
}
```

```filename:Terminal
$ clang++ -std=c++20 -g -fsanitize=address,undefined main.cpp && ./a.out   # memory errors + UB
$ clang++ -std=c++20 -g -fsanitize=thread main.cpp && ./a.out              # data races
```

# Classic pitfalls (not all UB, all bugs)

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>

int main() {
    // 1. Integer division before conversion
    double avg = 7 / 2;                     // 3, not 3.5
    std::cout << avg << '\n';

    // 2. Assignment instead of comparison (clang warns; parentheses silence it)
    int x = 0;
    if ((x = 5)) std::cout << "always true\n";

    // 3. Unsigned wrap-around
    std::vector<int> empty;
    std::cout << (empty.size() - 1 > 0) << '\n';   // true: 18446744073709551615 > 0

    // 4. Copy in range-for
    std::vector<std::string> names{"a", "b"};
    for (auto n : names) n += "!";          // modifies copies
    std::cout << names[0] << '\n';

    // 5. Char arithmetic
    std::string s = "abc";
    std::cout << s[0] + s[1] << '\n';       // 195 — chars promote to int
}
```

```text filename:Output
3
always true
1
a
195
```

> [!WARNING] Watch out
>
> “It works on my machine” means nothing for UB. A different compiler, optimisation level or input can change the behaviour. Always test with `-Wall -Wextra` and sanitizers on.

```question
What's the difference between undefined, unspecified and implementation-defined behaviour?

---

<strong>Undefined</strong>: no requirements at all (out-of-bounds, signed overflow). <strong>Unspecified</strong>: one of several valid outcomes, not documented (order of evaluating function arguments). <strong>Implementation-defined</strong>: one outcome the implementation must document (`sizeof(long)`, whether `char` is signed).
```

```question
Why doesn't C++ just check array bounds?

---

Zero-overhead philosophy: checks cost time in tight loops, and many accesses are provably in range. C++ gives you the choice — `at()`, `std::span` with hardening, debug-mode library assertions, sanitizers in testing — without charging code that doesn't need it.
```
