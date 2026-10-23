---
id: 4ceb8dd2-4709-7714-8121-f137adbcc87d
key: topic:cpp/control-flow
subject: cpp
topic: control-flow
title: Control Flow
slug: control-flow
order: 1
---

`if`, `switch`, `for`, `while`, `do-while` — plus the modern additions: range-based `for`, `if`/`switch` with an initializer, and `[[fallthrough]]`.

# `if` / `else` and the ternary

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <string>

int main() {
    int score = 72;
    if (score >= 90)      std::cout << "A\n";
    else if (score >= 70) std::cout << "B\n";
    else                  std::cout << "C\n";

    std::string parity = (score % 2 == 0) ? "even" : "odd";
    std::cout << parity << '\n';

    std::map<std::string, int> stock{{"apple", 3}};
    if (auto it = stock.find("apple"); it != stock.end())   // C++17: init; condition
        std::cout << "apples: " << it->second << '\n';      // `it` is scoped to the if/else
}
```

```text filename:Output
B
even
apples: 3
```

# `switch`

```cpp filename:C%2B%2B
#include <iostream>
void describe(char op) {
    switch (op) {
        case '+':
        case '-':
            std::cout << op << " is additive\n";
            break;
        case '*':
            std::cout << "* is multiplicative\n";
            [[fallthrough]];              // intentional: silences the warning
        case '/':
            std::cout << "  (binary operator)\n";
            break;
        default:
            std::cout << op << " unknown\n";
    }
}
int main() { describe('-'); describe('*'); describe('?'); }
```

```text filename:Output
- is additive
* is multiplicative
  (binary operator)
? unknown
```

> [!WARNING] Watch out
>
> `switch` works only on integral and enum types (not `std::string`), and a missing `break` falls through into the next case. You can't declare an initialised variable across case labels without braces: `case 1: { int x = 5; … } break;`.

# Loops

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
int main() {
    std::vector<int> v{3, 1, 4, 1, 5};
    for (std::size_t i = 0; i < v.size(); ++i) std::cout << v[i];   // classic index loop
    std::cout << '\n';
    for (int x : v) std::cout << x * 2 << ' ';                       // range-based for
    std::cout << '\n';
    for (int& x : v) x += 10;                                        // reference: modify in place
    std::cout << v.front() << '\n';

    int n = 1;
    while (n < 100) n *= 3;
    std::cout << n << '\n';

    int tries = 0;
    do { ++tries; } while (tries < 0);   // body runs at least once
    std::cout << tries << '\n';
}
```

```text filename:Output
31415
6 2 8 2 10
13
243
1
```

# `break`, `continue` and nested loops

```cpp filename:C%2B%2B
#include <iostream>
int main() {
    for (int i = 1; i <= 10; ++i) {
        if (i % 2 == 0) continue;   // skip evens
        if (i > 7) break;           // stop the loop
        std::cout << i << ' ';
    }
    std::cout << '\n';

    bool found = false;              // leaving nested loops: use a flag (or a function + return)
    for (int r = 0; r < 3 && !found; ++r)
        for (int c = 0; c < 3; ++c)
            if (r * c == 2) { std::cout << r << ',' << c << '\n'; found = true; break; }
}
```

```text filename:Output
1 3 5 7
1,2
```

| Loop | Use when |
| --- | --- |
| `for (init; cond; step)` | You need the index or a custom step |
| `for (auto& x : range)` | Visit every element — the default choice |
| `while (cond)` | Number of iterations isn't known up front |
| `do { } while (cond);` | Body must run at least once (e.g. menu loops) |

```question
How does the range-based for loop work under the hood?

---

`for (auto x : r) body` is rewritten to roughly `auto&& __r = r; for (auto it = begin(__r), e = end(__r); it != e; ++it) { auto x = *it; body }`. So it works for any type with `begin()`/`end()` — arrays, all STL containers, `std::string`, ranges and your own classes.
```
