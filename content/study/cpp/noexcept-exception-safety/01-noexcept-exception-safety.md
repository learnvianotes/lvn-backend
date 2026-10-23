---
id: 5583d627-5e43-72f9-bd04-355c776bcd55
key: topic:cpp/noexcept-exception-safety
subject: cpp
topic: noexcept-exception-safety
title: noexcept & Exception Safety
slug: noexcept-exception-safety
order: 1
---

`noexcept` promises a function won't throw — enabling optimisations like moving elements during `vector` growth. Exception-safety guarantees describe what state is left behind when something <em>does</em> throw.

# `noexcept`

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

int safeAdd(int a, int b) noexcept { return a + b; }
void mayThrow() { throw 1; }

template <typename T>
void swapValues(T& a, T& b) noexcept(std::is_nothrow_move_constructible_v<T>) {   // conditional
    T tmp = std::move(a);
    a = std::move(b);
    b = std::move(tmp);
}

int main() {
    std::cout << std::boolalpha
              << noexcept(safeAdd(1, 2)) << ' '          // noexcept operator: compile-time query
              << noexcept(mayThrow()) << ' '
              << std::is_nothrow_move_constructible_v<std::string> << ' '
              << std::is_nothrow_move_constructible_v<std::vector<int>> << '\n';
    std::string a = "x", b = "y";
    swapValues(a, b);
    std::cout << a << b << '\n';
}
```

```text filename:Output
true false true true
yx
```

```cpp filename:C%2B%2B%20%E2%80%94%20throwing%20from%20noexcept%20terminates
#include <stdexcept>
void promise() noexcept {
    throw std::runtime_error("broken promise");   // compiles, but calls std::terminate at run time
}
int main() { promise(); }
```

- Destructors, `operator delete` and (by default) compiler-generated move operations of well-behaved members are `noexcept`.
- Mark move constructors/assignments and `swap` `noexcept` — containers depend on it.
- Don't mark functions `noexcept` if they might throw someday; removing it later breaks callers that relied on it.

# The exception-safety guarantees

| Guarantee | Promise if an exception is thrown | Example |
| --- | --- | --- |
| <strong>No-throw</strong> | Never throws | Destructors, `swap`, move operations |
| <strong>Strong</strong> | Commit-or-rollback: state is unchanged | `vector::push_back` (when the move ctor is `noexcept` or copyable) |
| <strong>Basic</strong> | No leaks, invariants hold, but state may have changed | Most operations |
| <strong>None</strong> | Anything goes — avoid | Code with raw `new`/`delete` |

# Getting the strong guarantee: copy-and-swap

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

class Inventory {
    std::vector<std::string> items_;
public:
    void addAll(const std::vector<std::string>& newItems) {
        std::vector<std::string> copy = items_;          // 1. work on a copy
        for (const auto& it : newItems) {
            if (it.empty()) throw std::invalid_argument("empty item");
            copy.push_back(it);
        }
        items_.swap(copy);                               // 2. commit with a no-throw swap
    }
    std::size_t size() const { return items_.size(); }
};

int main() {
    Inventory inv;
    inv.addAll({"pen", "ink"});
    try { inv.addAll({"cap", "", "pad"}); } catch (const std::exception& e) { std::cout << e.what() << '\n'; }
    std::cout << inv.size() << '\n';                      // still 2: nothing half-added
}
```

```text filename:Output
empty item
2
```

```question
Why are destructors implicitly noexcept?

---

Destructors run during stack unwinding. If one threw while another exception was already propagating, C++ couldn't handle two exceptions at once and would call `std::terminate`. Making them `noexcept` by default turns that into a clear rule: never let exceptions escape a destructor.
```
