---
id: 571a1a7c-7c5b-7244-9811-ef17cf8be29a
key: topic:cpp/auto-const-constexpr
subject: cpp
topic: auto-const-constexpr
title: auto, const & constexpr
slug: auto-const-constexpr
order: 1
---

`auto` lets the compiler deduce a type; `const` promises a value won't change; `constexpr` asks for it to be computed at compile time.

# `auto` type deduction

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <string>
#include <vector>

int main() {
    auto n = 42;              // int
    auto pi = 3.14;           // double
    auto s = std::string("hi");
    std::map<std::string, std::vector<int>> index{{"a", {1, 2}}};
    for (const auto& [key, list] : index)   // instead of spelling out the pair type
        std::cout << key << ": " << list.size() << '\n';
    std::cout << n << ' ' << pi << ' ' << s << '\n';
}
```

```text filename:Output
a: 2
42 3.14 hi
```

| You write | Deduced as | Why |
| --- | --- | --- |
| `auto x = ci;` (where `const int ci`) | `int` | Top-level `const` and references are dropped — you get a copy |
| `auto& r = ci;` | `const int&` | A reference keeps `const` |
| `const auto& r = expr;` | `const T&` | Read-only view, no copy — the default in range-`for` |
| `auto* p = &x;` | `int*` | Documents that it's a pointer |
| `auto&& r = expr;` | `T&` or `T&&` | Forwarding reference — binds to anything |
| `auto v = {1, 2};` | `std::initializer_list<int>` | Surprise! Braces with `=` deduce an initializer list |

> [!WARNING] Watch out
>
> `for (auto x : bigStrings)` copies every element. Use `const auto&` to read and `auto&` to modify.

# `const`

```cpp filename:C%2B%2B
#include <iostream>
int main() {
    const int maxUsers = 100;       // must be initialised; can't be changed later
    int value = 5;
    const int* p1 = &value;         // pointer to const int: *p1 is read-only
    int* const p2 = &value;         // const pointer: p2 can't be re-seated
    *p2 = 6;                        // OK — the int itself isn't const
    p1 = &maxUsers;                 // OK — p1 itself isn't const
    std::cout << *p1 << ' ' << value << '\n';
}
```

```text filename:Output
100 6
```

> [!NOTE] Reading trick
>
> Read pointer declarations <strong>right to left</strong>: `const int* p` → “p is a pointer to an int that is const”; `int* const p` → “p is a const pointer to int”. `const int* const p` → both.

```cpp filename:C%2B%2B
int main() {
    const int limit = 10;
    limit = 20;           // error: cannot assign to a const variable
    return limit;
}
```

# `constexpr` — compile-time values &amp; functions

```cpp filename:C%2B%2B
#include <array>
#include <iostream>

constexpr long long factorial(int n) {       // may run at compile time
    return n <= 1 ? 1 : n * factorial(n - 1);
}

int main() {
    constexpr auto f10 = factorial(10);      // computed by the compiler
    static_assert(factorial(5) == 120);      // checked at compile time
    std::array<int, factorial(4)> arr{};     // usable as an array size
    int n = 6;
    std::cout << f10 << ' ' << arr.size() << ' ' << factorial(n) << '\n';   // also callable at run time
}
```

```text filename:Output
3628800 24 720
```

| Keyword | Meaning |
| --- | --- |
| `const` | Can't be modified after initialisation. Value may be known only at run time. |
| `constexpr` variable | Must be a compile-time constant (implies `const`). |
| `constexpr` function | <em>Can</em> be evaluated at compile time if its arguments are constants; otherwise runs normally. |
| `consteval` function (C++20) | <em>Must</em> be evaluated at compile time (an “immediate function”). |
| `constinit` (C++20) | A static variable must be initialised at compile time, but can change later. |

```cpp filename:C%2B%2B
#include <iostream>
consteval int square(int x) { return x * x; }
int main() {
    constexpr int s = square(9);   // fine: argument is a constant
    std::cout << s << '\n';
    // int n = 3; square(n);       // error: n is not a constant expression
}
```

```text filename:Output
81
```

# `const` everywhere it applies

> [!TIP] Do
>
> Make variables, parameters (`const std::string&`) and member functions `const` whenever they don't mutate — the compiler then enforces your intent.

> [!DANGER] Avoid
>
> Using `#define MAX 100` for constants — macros ignore scope and types; use `constexpr int kMax = 100;`

```question
What's the difference between const and constexpr?

---

`const` means <em>read-only after initialisation</em>; the initial value may come from run-time input. `constexpr` means the value is a <em>compile-time constant</em> (or, for functions, that they can be evaluated at compile time). Every `constexpr` variable is `const`, but not the other way round.
```

```question
Does auto make C++ dynamically typed?

---

No. The type is deduced once, at compile time, from the initialiser, and never changes. `auto x = 1; x = "hi";` is a compile error.
```
