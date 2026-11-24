---
id: c2b8e9fc-d21d-7076-ae92-4efaebddb8ee
key: topic:cpp/variadic-templates
subject: cpp
topic: variadic-templates
title: Variadic Templates & Fold Expressions
slug: variadic-templates-fold-expressions
order: 1
---

A <em>parameter pack</em> (`typename... Args`) lets a template accept any number of arguments of any types — how `std::make_unique`, `std::tuple` and `emplace_back` work.

# Fold expressions (C++17)

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

template <typename... Ts>
auto sum(Ts... xs) { return (xs + ... + 0); }            // binary right fold with init 0

template <typename... Ts>
void printAll(const Ts&... xs) {
    ((std::cout << xs << ' '), ...);                     // unary fold over the comma operator
    std::cout << "(" << sizeof...(xs) << " args)\n";    // number of elements in the pack
}

template <typename... Ts>
bool allPositive(Ts... xs) { return ((xs > 0) && ...); }

int main() {
    std::cout << sum(1, 2, 3, 4) << ' ' << sum() << ' ' << sum(1.5, 2) << '\n';
    printAll(1, "two", 3.0, std::string("four"), 'v');
    std::cout << allPositive(1, 5, 9) << allPositive(1, -5) << '\n';
}
```

```text filename:Output
10 0 3.5
1 two 3 four v (5 args)
10
```

| Fold | Expands to |
| --- | --- |
| `(pack op ...)` | `x1 op (x2 op (x3 op x4))` |
| `(... op pack)` | `((x1 op x2) op x3) op x4` |
| `(pack op ... op init)` | `x1 op (x2 op (… op init))` — works for an empty pack |

# Recursive style (pre-C++17)

```cpp filename:C%2B%2B
#include <iostream>

void logAll() { std::cout << '\n'; }                 // base case: empty pack

template <typename T, typename... Rest>
void logAll(const T& first, const Rest&... rest) {  // peel off one argument per call
    std::cout << '[' << first << ']';
    logAll(rest...);                              // pack expansion
}

int main() { logAll("id", 42, 3.5); }
```

```text filename:Output
[id][42][3.5]
```

# Forwarding a pack

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <string>
#include <utility>

struct User {
    std::string name;
    int age;
    User(std::string n, int a) : name(std::move(n)), age(a) {}
};

template <typename T, typename... Args>
std::unique_ptr<T> create(Args&&... args) {                    // a hand-written make_unique
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

int main() {
    auto u = create<User>("Ada", 36);
    std::cout << u->name << ' ' << u->age << '\n';
}
```

```text filename:Output
Ada 36
```

```question
What does sizeof...(args) return?

---

The number of elements in the parameter pack, as a compile-time constant. It doesn't evaluate the arguments or measure their byte sizes.
```
