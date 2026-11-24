---
id: 94f692df-fc7a-7505-b7ff-33f8b8e141c7
key: topic:cpp/modern-cpp-tour
subject: cpp
topic: modern-cpp-tour
title: Modern C++ Feature Tour (11 → 23)
slug: modern-c-feature-tour-11-23
order: 1
---

A quick map of what each standard added, with the features you'll actually use and be asked about.

# C++11 — the big one

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <unordered_map>
#include <vector>

enum class Color { Red, Green };                             // scoped enums

int main() {
    auto v = std::vector<int>{1, 2, 3};                      // auto + brace init
    for (auto x : v) std::cout << x;                         // range-for
    std::cout << '\n';
    auto p = std::shared_ptr<int>(new int(7));               // smart pointers
    std::unordered_map<int, int> m{{1, 1}};                  // hash containers
    int* none = nullptr;                                     // nullptr
    auto sq = [](int x) { return x * x; };                   // lambdas
    static_assert(sizeof(int) >= 4);                         // static_assert
    constexpr int k = 3;                                     // constexpr
    std::vector<std::unique_ptr<int>> owners;
    owners.push_back(std::make_unique<int>(1));              // move semantics (make_unique is C++14)
    std::cout << *p + sq(k) + m[1] + (none == nullptr) + *owners[0] << '\n';
    Color c = Color::Green;
    std::cout << static_cast<int>(c) << '\n';
}
```

```text filename:Output
123
19
1
```

| Standard | Language | Library |
| --- | --- | --- |
| <strong>C++11</strong> | `auto`, `decltype`, lambdas, rvalue refs &amp; move, `nullptr`, `constexpr`, range-for, `enum class`, `override`/`final`, variadic templates, `= default`/`= delete`, uniform init, `noexcept` | `unique_ptr`/`shared_ptr`, `unordered_*`, `thread`/`mutex`/`atomic`, `chrono`, `random`, `tuple`, `array`, `function` |
| <strong>C++14</strong> | Generic lambdas, return-type deduction, relaxed `constexpr`, binary literals, digit separators `1'000` | `make_unique`, `std::exchange` |
| <strong>C++17</strong> | Structured bindings, `if constexpr`, `if (init; cond)`, fold expressions, CTAD, inline variables, guaranteed copy elision, nested namespaces | `optional`, `variant`, `any`, `string_view`, `filesystem`, parallel algorithms, `gcd`/`lcm` |
| <strong>C++20</strong> | Concepts, `<=>`, designated initialisers, `consteval`/`constinit`, coroutines, modules, `using enum`, lambda templates | Ranges, `format`, `span`, `jthread`, `stop_token`, `latch`/`barrier`/`semaphore`, calendar &amp; time zones, `contains()`, `starts_with()` |
| <strong>C++23</strong> | Deducing `this`, `if consteval`, multidimensional `operator[]`, `auto(x)` decay copy | `print`/`println`, `expected`, `ranges::to`, `views::zip/enumerate/chunk`, `flat_map`, `mdspan`, `stacktrace` |

# C++17 &amp; C++20 in one program

```cpp filename:C%2B%2B
#include <algorithm>
#include <compare>
#include <concepts>
#include <format>
#include <iostream>
#include <map>
#include <optional>
#include <ranges>
#include <span>
#include <string>
#include <vector>

struct Version {
    int major{}, minor{};
    auto operator<=>(const Version&) const = default;           // C++20 spaceship
};

std::optional<int> parse(std::string_view s) {                 // C++17 optional + string_view
    int n = 0;
    for (char c : s) { if (c < '0' || c > '9') return std::nullopt; n = n * 10 + (c - '0'); }
    return n;
}

std::integral auto total(std::span<const int> xs) {            // C++20 concepts + span
    int s = 0;
    for (int x : xs) s += x;
    return s;
}

int main() {
    std::map<std::string, Version> deps{{"fmt", {.major = 10, .minor = 1}}, {"boost", {1, 84}}};  // designated init
    for (const auto& [name, ver] : deps)                                                          // structured bindings
        std::cout << std::format("{:<6}{}.{}\n", name, ver.major, ver.minor);                     // std::format
    std::cout << (Version{1, 84} < Version{10, 1}) << '\n';

    std::vector<int> nums{5, 3, 8};
    std::ranges::sort(nums);                                                                      // ranges
    if (auto n = parse("42"); n) std::cout << *n + total(nums) << '\n';                           // if-init
    std::cout << deps.contains("fmt") << '\n';
}
```

```text filename:Output
boost 1.84
fmt   10.1
1
58
1
```

# Features to know by name

> [!NOTE] Coroutines (C++20)
>
> Functions that can suspend (`co_await`, `co_yield`, `co_return`). The language provides the machinery; you need a library type (e.g. C++23 `std::generator`) to use them comfortably.

> [!NOTE] Modules (C++20)
>
> `import std;` / `export module math;` replace textual `#include`: faster builds, no macro leakage. Toolchain support is still maturing.

> [!NOTE] std::expected (C++23)
>
> Return a value <em>or</em> an error without exceptions: `std::expected<int, std::string> parse(...)`.

> [!NOTE] Deducing this (C++23)
>
> `void f(this auto& self)` — one member function for const/non-const, recursive lambdas, CRTP without templates.

```question
What were the most important changes in C++11?

---

Move semantics and rvalue references (cheap transfers of resources), smart pointers (safe ownership), lambdas, `auto`, range-based for, a memory model with `std::thread`/atomics, `nullptr`, `constexpr`, `enum class`, `override`/`final` and variadic templates. Together they made “modern C++” — code without manual `new`/`delete`.
```
