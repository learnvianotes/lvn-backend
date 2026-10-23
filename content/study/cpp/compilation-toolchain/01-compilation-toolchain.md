---
id: 2a190d96-58f4-7378-bd79-7bc31e56bd87
key: topic:cpp/compilation-toolchain
subject: cpp
topic: compilation-toolchain
title: Compilation & Toolchain
slug: compilation-toolchain
order: 1
---

Turning `.cpp` files into an executable takes four stages — knowing them explains most “undefined reference” and “multiple definition” errors.

# The build pipeline

`main.cpp` → Preprocessor → Compiler → Assembler → Linker → `./app`

1. <strong>Preprocess</strong>

   Handles `#include` (pastes the header text in), `#define` macros and `#if` conditionals. Output: one big <em>translation unit</em>.

2. <strong>Compile</strong>

   Parses and type-checks the translation unit, instantiates templates, optimises, and emits assembly.

3. <strong>Assemble</strong>

   Turns assembly into an <strong>object file</strong> (`main.o`) — machine code with unresolved symbol references.

4. <strong>Link</strong>

   Combines object files and libraries, resolving every symbol to exactly one definition. Output: the executable.

```filename:Terminal
$ clang++ -std=c++20 -Wall -Wextra -O2 main.cpp -o app   # all four stages in one go
$ ./app

$ clang++ -E main.cpp -o main.ii       # stop after preprocessing
$ clang++ -S main.cpp -o main.s        # stop after compiling (assembly)
$ clang++ -c main.cpp -o main.o        # stop after assembling (object file)
$ clang++ main.o util.o -o app         # link object files
```

# Useful compiler flags

| Flag | Meaning |
| --- | --- |
| `-std=c++20` | Pick the language standard (`c++17`, `c++23`, …) |
| `-Wall -Wextra -Wpedantic` | Turn on warnings — always use them |
| `-Werror` | Treat warnings as errors |
| `-O0` / `-O2` / `-O3` | Optimisation level (debug → release) |
| `-g` | Include debug info (for `gdb`/`lldb`) |
| `-fsanitize=address,undefined` | Catch memory errors and UB at run time (ASan/UBSan) |
| `-I dir` / `-L dir` / `-lname` | Header search path / library path / link a library |
| `-D NAME=val` | Define a macro (like `#define`) |

# Headers vs source files

A <strong>declaration</strong> says a name exists; a <strong>definition</strong> creates it. Headers hold declarations so every `.cpp` can use them; exactly one `.cpp` holds each definition.

```cpp filename:C%2B%2B%20%E2%80%94%20header
// math_utils.h — the interface
#pragma once              // include guard: paste this header at most once per TU

int square(int x);        // declaration only
inline int cube(int x) {  // `inline` lets a definition live in a header
    return x * x * x;
}
```

```cpp filename:C%2B%2B
#include <iostream>
// In a real project: #include "math_utils.h" and square() lives in math_utils.cpp.
int square(int x);                    // what the header provides
int main() { std::cout << square(7) << '\n'; }
int square(int x) { return x * x; }   // what math_utils.cpp provides
```

```text filename:Output
49
```

> [!NOTE] Undefined reference
>
> <em>Linker</em> error: something was declared and used but never defined (or the `.cpp` defining it wasn't linked).

> [!NOTE] Multiple definition
>
> <em>Linker</em> error: two translation units both define the same non-`inline` function/variable — e.g. a function body in a header included twice.

> [!INFO]
>
> <strong>One Definition Rule (ODR)</strong> — every function or variable may be <em>declared</em> many times but <em>defined</em> exactly once in the program — except `inline` functions/variables, templates and classes, which may be defined in every TU as long as all definitions are identical.

# Include guards

```cpp filename:C%2B%2B%20%E2%80%94%20classic%20guard
#ifndef POINT_H           // classic guard — works everywhere
#define POINT_H
struct Point { int x, y; };
#endif
```

# Build systems

Real projects don't type compiler commands — <strong>CMake</strong> generates the build (Make/Ninja/Xcode) from a `CMakeLists.txt`:

```filename:Terminal
# CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(app CXX)
set(CMAKE_CXX_STANDARD 20)
add_executable(app main.cpp math_utils.cpp)

$ cmake -S . -B build && cmake --build build
```

```question
What's the difference between a compile error and a linker error?

---

A compile error is found while checking a single translation unit (syntax, types, undeclared names). A linker error happens after every file compiled fine, when symbols are stitched together: a missing definition (<em>undefined reference</em>) or two definitions (<em>multiple definition</em>).
```

```question
Why do templates usually live entirely in headers?

---

The compiler generates code for a template only when it sees it used with concrete types, and it needs the full definition at that point. If the definition were in a `.cpp`, other translation units couldn't instantiate it and you'd get undefined-reference errors.
```
