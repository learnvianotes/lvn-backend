---
id: 1cf24e65-8526-7d55-861f-ab963d7c31c0
key: topic:cpp/preprocessor-macros
subject: cpp
topic: preprocessor-macros
title: Preprocessor & Macros
slug: preprocessor-macros
order: 1
---

Before compilation, the preprocessor rewrites the source text: it pastes headers, expands macros and keeps or drops code with `#if`. It knows nothing about types or scopes.

# Directives

| Directive | Does |
| --- | --- |
| `#include <x>` / `#include "x"` | Paste a header (system paths / project paths first) |
| `#define NAME value` | Object-like macro: textual replacement |
| `#define F(a, b) (…)` | Function-like macro |
| `#undef NAME` | Remove a macro |
| `#if` / `#ifdef` / `#ifndef` / `#elif` / `#else` / `#endif` | Conditional compilation |
| `#pragma once` | Include guard (non-standard but universal) |
| `#error msg` | Stop compilation with a message |

# Macros and their traps

```cpp filename:C%2B%2B
#include <iostream>

#define SQUARE_BAD(x) x * x
#define SQUARE(x) ((x) * (x))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

constexpr int square(int x) { return x * x; }       // the C++ way: typed, scoped, evaluated once

int main() {
    std::cout << SQUARE_BAD(2 + 3) << ' ' << SQUARE(2 + 3) << ' ' << square(2 + 3) << '\n';   // 2 + 3 * 2 + 3
    int i = 5;
    int m = MAX(i++, 0);                             // i++ is evaluated TWICE
    std::cout << m << ' ' << i << '\n';
}
```

```text filename:Output
11 25 25
6 7
```

> [!WARNING] Watch out
>
> Macros ignore scope and types, evaluate arguments multiple times and are invisible to the debugger. Use `constexpr` variables, `inline`/`constexpr` functions, templates and `enum class` instead.

# Where macros are still useful

```cpp filename:C%2B%2B
#include <iostream>

#define STRINGIFY(x) #x                         // # turns an argument into a string literal
#define CONCAT(a, b) a##b                       // ## pastes tokens
#define LOG_VAR(v) std::cout << #v << " = " << (v) << '\n'

#ifndef NDEBUG
#define DEBUG_ONLY(code) code
#else
#define DEBUG_ONLY(code)
#endif

int main() {
    int CONCAT(user, Count) = 3;                 // declares userCount
    LOG_VAR(userCount * 2);
    std::cout << STRINGIFY(hello world) << '\n';
    std::cout << __LINE__ << ' ' << (__cplusplus >= 202002L) << '\n';   // predefined macros
    DEBUG_ONLY(std::cout << "debug build\n";)
}
```

```text filename:Output
userCount * 2 = 6
hello world
17 1
debug build
```

| Predefined macro | Value |
| --- | --- |
| `__FILE__`, `__LINE__` | Current file name and line (C++20: prefer `std::source_location`) |
| `__cplusplus` | Standard version, e.g. `202002L` for C++20 |
| `NDEBUG` | Defined in release builds (`-DNDEBUG`) — disables `assert` |
| `_WIN32`, `__linux__`, `__APPLE__` | Target platform |
| `__GNUC__`, `__clang__`, `_MSC_VER` | Compiler |

# `assert`

```cpp filename:C%2B%2B
#include <cassert>
#include <iostream>
int divide(int a, int b) {
    assert(b != 0 && "divisor must be non-zero");   // checked only when NDEBUG is not defined
    return a / b;
}
int main() { std::cout << divide(10, 2) << '\n'; }
```

```text filename:Output
5
```

```question
Why prefer constexpr over #define for constants?

---

A `constexpr` constant has a type (so the compiler checks its uses), respects namespaces and scopes, shows up in the debugger, and can't be silently redefined elsewhere. A `#define` is blind text replacement that can clash with any identifier of the same name in any header included later.
```
