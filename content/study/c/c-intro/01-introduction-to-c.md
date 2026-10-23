---
id: ba39edee-458a-7d6c-b04e-069f4553e49f
key: topic:c/c-intro
subject: c
topic: c-intro
title: Introduction to C
slug: introduction-to-c
order: 1
---

A small, fast, portable systems language — the language of operating systems, embedded devices, databases and the runtimes of most other languages.

> [!INFO]
>
> <strong>C</strong> — a statically typed, compiled, <em>procedural</em> language that gives you direct access to memory through pointers and maps closely to what the hardware actually does. It trusts the programmer: there is no garbage collector, no bounds checking and no exceptions.

# A short history

| Year | Milestone |
| --- | --- |
| 1972 | Dennis Ritchie creates C at Bell Labs (successor of B) to rewrite <strong>UNIX</strong>. |
| 1978 | <em>The C Programming Language</em> (K&amp;R) by Kernighan &amp; Ritchie — the de-facto standard, “K&amp;R C”. |
| 1989 / 1990 | <strong>C89 / C90</strong> — the first ANSI / ISO standard (“ANSI C”). Function prototypes, `void`, `const`. |
| 1999 | <strong>C99</strong> — `//` comments, `long long`, `<stdint.h>`, `bool`, VLAs, designated initializers, `inline`, mixed declarations. |
| 2011 | <strong>C11</strong> — `_Generic`, `_Static_assert`, anonymous structs/unions, `<threads.h>`, `<stdatomic.h>`, `_Alignas`; `gets` removed. |
| 2018 | <strong>C17</strong> (C18) — bug-fix release of C11, no new features. The default standard for these notes. |
| 2024 | <strong>C23</strong> — `bool`/`true`/`false` as keywords, `nullptr`, `constexpr`, `typeof`, `#embed`, binary literals `0b1010`, `[[attributes]]`. |

# Why learn C?

> [!NOTE] Close to the machine
>
> You see memory, addresses and bytes. Understanding C explains how every higher-level language works underneath.

> [!NOTE] Everywhere
>
> Linux, Windows and macOS kernels, embedded firmware, SQLite, Redis, Git, CPython, the JVM, Nginx — all C.

> [!NOTE] Fast & small
>
> No runtime or VM; a C binary is just machine code. Predictable performance and tiny footprint.

> [!NOTE] Portable
>
> A C compiler exists for practically every CPU ever made. The standard library is small and everywhere.

# The trade-off

| C gives you | C does NOT give you |
| --- | --- |
| Raw pointers and manual memory control | Garbage collection, bounds checks, null safety |
| Structs, unions, functions | Classes, inheritance, templates, exceptions |
| A tiny standard library | Built-in strings, lists, maps, networking |
| Speed and control | Protection from <strong>undefined behaviour</strong> — mistakes compile and silently misbehave |

# Hello, world

```c filename:C
#include <stdio.h>

int main(void) {
    printf("Hello, world!\n");
    return 0;
}
```

```text filename:Output
Hello, world!
```

```filename:Terminal
$ gcc hello.c -o hello        # compile (or: clang hello.c -o hello)
$ ./hello                     # run
Hello, world!
$ echo $?                     # exit status returned by main
0
```

> [!NOTE] Syntax basics
>
> C is case-sensitive, every statement ends with `;`, and blocks are delimited by `{ }`. Whitespace and indentation don’t matter to the compiler.

```question
Is C a high-level or low-level language?

---

It is usually called a <em>middle-level</em> language: it has high-level constructs (functions, loops, structs, types) but also low-level access (pointers, bit manipulation, manual memory) that maps almost one-to-one onto machine instructions.
```

```question
What is the difference between C and C++?

---

C++ started as “C with classes” and is (almost) a superset of C. It adds classes, templates, references, RAII, exceptions, namespaces and a large standard library (STL). C stays small and procedural. Some valid C is not valid C++ (e.g. implicit `void *` conversion from `malloc`, designated-initializer order, `int new;`).
```
