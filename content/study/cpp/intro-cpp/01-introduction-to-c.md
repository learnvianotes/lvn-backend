---
id: eb4ab79c-12bb-7382-8adc-52630f4d4dd5
key: topic:cpp/intro-cpp
subject: cpp
topic: intro-cpp
title: Introduction to C++
slug: introduction-to-c
order: 1
---

A compiled, statically typed, multi-paradigm language that gives you C-level control of memory with high-level abstractions that cost nothing at run time.

> [!INFO]
>
> <strong>C++</strong> — a general-purpose language created by Bjarne Stroustrup (1979, “C with Classes”). Source is compiled <em>ahead of time</em> to native machine code — no virtual machine, no garbage collector.

# Why C++?

> [!NOTE] Performance
>
> Compiles to native code; you decide where every object lives (stack, heap, static). Used where latency matters: games, trading, browsers, databases.

> [!NOTE] Zero-overhead abstractions
>
> “What you don't use, you don't pay for; what you do use, you couldn't hand-code better.” Templates and inlining make `std::sort` as fast as hand-written C.

> [!NOTE] Multi-paradigm
>
> Procedural (like C), object-oriented (classes, virtual functions), generic (templates) and functional (lambdas, ranges) — mix as needed.

> [!NOTE] Deterministic cleanup
>
> Destructors run at a known point (end of scope) — the basis of <strong>RAII</strong>, C++'s answer to resource management.

# C vs C++

| Feature | C | C++ |
| --- | --- | --- |
| Paradigm | Procedural | Procedural + OOP + generic + functional |
| Structs | Data only | `class`/`struct` with methods, access control, inheritance |
| Memory | `malloc` / `free` | `new` / `delete`, but prefer containers &amp; smart pointers |
| Strings | `char*` + `<string.h>` | `std::string`, `std::string_view` |
| Pass by | Value or pointer | Value, pointer <strong>or reference</strong> (`int&`) |
| Overloading | No | Function &amp; operator overloading |
| Generic code | Macros / `void*` | Templates, concepts |
| Errors | Return codes, `errno` | Exceptions (plus return codes, `std::optional`) |
| Namespaces | No (one global scope) | `namespace` |
| Standard library | Small (`stdio`, `stdlib`…) | STL: containers, algorithms, threads, chrono, … |

> [!NOTE] Compatibility
>
> C++ is <em>almost</em> a superset of C — most C compiles as C++, but not all (e.g. `int *p = malloc(4);` needs a cast in C++, and `class`/`new` are keywords).

# Your first program

```cpp filename:C%2B%2B
#include <iostream>

int main() {
    std::cout << "Hello, C++!\n";
    int year = 2020;
    std::cout << "Standard: C++" << year % 100 << '\n';
    return 0;   // optional in main: falling off the end returns 0
}
```

```text filename:Output
Hello, C++!
Standard: C++20
```

# The standards

| Standard | Headline features |
| --- | --- |
| <strong>C++98/03</strong> | STL, templates, exceptions, `std::string` |
| <strong>C++11</strong> | The “modern C++” reset: `auto`, lambdas, move semantics, `nullptr`, smart pointers, range-`for`, `constexpr`, threads |
| <strong>C++14</strong> | Generic lambdas, `make_unique`, relaxed `constexpr` |
| <strong>C++17</strong> | Structured bindings, `optional`/`variant`/`any`, `string_view`, `if constexpr`, filesystem |
| <strong>C++20</strong> | Concepts, ranges, coroutines, modules, `<=>`, `std::format`, `std::span` |
| <strong>C++23</strong> | `std::print`, `std::expected`, `ranges::to`, deducing `this` |

> [!NOTE] Version
>
> These notes use <strong>C++20</strong> (every example is compiled with `clang++ -std=c++20`). C++23 features are mentioned where relevant.

```question
Is C++ an object-oriented language?

---

It <em>supports</em> OOP but doesn't force it. It's multi-paradigm: you can write procedural code, generic code with templates, or functional-style code with lambdas and ranges. A C++ program doesn't need a single class.
```

```question
Why is C++ faster than Java or Python?

---

It compiles straight to native code with aggressive optimisation (inlining, templates specialised per type), has no garbage-collector pauses and no interpreter/JIT warm-up, and lets you control memory layout (contiguous `std::vector`, objects on the stack). The trade-off is that memory safety is your responsibility.
```
