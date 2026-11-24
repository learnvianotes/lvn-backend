---
id: e13ada24-9e8d-7533-9992-ab9e417830a4
key: topic:cpp/structured-bindings
subject: cpp
topic: structured-bindings
title: Structured Bindings
slug: structured-bindings
order: 1
---

C++17 `auto [a, b] = expr;` unpacks a pair, tuple, array or plain struct into named variables in one line.

# What can be unpacked

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <string>
#include <tuple>

struct Point { int x; int y; };

std::tuple<int, double, std::string> record() { return {7, 9.5, "ok"}; }

int main() {
    auto [x, y] = Point{3, 4};                  // aggregate struct: by member order
    std::cout << x + y << '\n';

    int arr[3] = {10, 20, 30};
    auto [a, b, c] = arr;                        // C array
    std::cout << a << b << c << '\n';

    auto [id, score, status] = record();         // tuple
    std::cout << id << ' ' << score << ' ' << status << '\n';

    std::map<std::string, int> ages{{"ada", 36}, {"bob", 25}};
    for (const auto& [name, age] : ages)         // pairs in a map
        std::cout << name << '=' << age << ' ';
    std::cout << '\n';

    if (auto [it, inserted] = ages.insert({"ada", 99}); !inserted)
        std::cout << "ada already " << it->second << '\n';
}
```

```text filename:Output
7
102030
7 9.5 ok
ada=36 bob=25
ada already 36
```

# Copy or reference?

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
int main() {
    std::pair<int, int> p{1, 2};
    auto [a, b] = p;      // binds to a hidden *copy* of p
    a = 100;
    auto& [c, d] = p;     // binds to p itself
    c = 50;
    std::cout << p.first << ' ' << p.second << '\n';
}
```

```text filename:Output
50 2
```

- `auto [..]` — copy of the whole object; `auto& [..]` — refer to the original; `const auto& [..]` — read-only view.
- The number of names must match exactly; you can't skip one (use a dummy name like `_` or `[[maybe_unused]]`).
- For your own classes with private members, enable it by specialising `std::tuple_size`/`std::tuple_element` and providing `get<N>` (advanced).

```question
How would you swap-return two values from a function in modern C++?

---

Return a `std::pair`/`std::tuple` or, better, a small named `struct`, and unpack at the call site with structured bindings: `auto [quotient, remainder] = divide(17, 5);`.
```
