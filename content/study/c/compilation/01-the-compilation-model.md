---
id: d7db4cb8-1330-7525-b5fb-023e8f1a0cc4
key: topic:c/compilation
subject: c
topic: compilation
title: The Compilation Model
slug: the-compilation-model
order: 1
---

Turning `main.c` into an executable is four separate stages: preprocess → compile → assemble → link. Knowing them makes compiler and linker errors easy to read.

`main.c` → Preprocessor → `main.i` → Compiler → `main.s` → Assembler → `main.o` → Linker → `a.out`

# The four stages

1. <strong>Preprocessing (</strong><strong>`cpp`</strong><strong>)</strong>

   Text substitution: expands `#include` (pastes header files in), `#define` macros, `#if` conditionals, strips comments. Output: one big <em>translation unit</em> (`-E`).

2. <strong>Compilation (</strong><strong>`cc1`</strong><strong>)</strong>

   Parses the C, type-checks it, optimises it and emits <strong>assembly</strong> for the target CPU (`-S`). Syntax and type errors happen here.

3. <strong>Assembly (</strong><strong>`as`</strong><strong>)</strong>

   Converts assembly into machine code in an <strong>object file</strong> (`.o`) with a symbol table — unresolved references to functions defined elsewhere are left as holes (`-c`).

4. <strong>Linking (</strong><strong>`ld`</strong><strong>)</strong>

   Combines object files and libraries (`libc`, `-lm`…), resolves every symbol to an address, and writes the executable. “undefined reference” errors happen here.

```filename:Terminal
$ gcc -E main.c -o main.i      # stop after preprocessing
$ gcc -S main.c -o main.s      # stop after compiling (assembly)
$ gcc -c main.c -o main.o      # stop after assembling (object file)
$ gcc main.o util.o -o app     # link object files into an executable
$ gcc -save-temps main.c       # keep main.i, main.s, main.o all at once
$ nm main.o                    # list symbols (U = undefined, T = defined text)
```

# Essential gcc / clang flags

| Flag | Meaning |
| --- | --- |
| `-o name` | Name of the output file (default `a.out`). |
| `-std=c17` | Language standard (`c89`, `c99`, `c11`, `c17`, `c2x`/`c23`, or `gnu17` with extensions). |
| `-Wall -Wextra` | Turn on the important warnings. <strong>Always use them.</strong> |
| `-Werror` | Treat warnings as errors (good in CI). |
| `-pedantic` | Warn about non-standard extensions. |
| `-g` | Include debug info (for `gdb` / `lldb`). |
| `-O0 -O1 -O2 -O3 -Os` | Optimisation level (none → aggressive; `-Os` for size). |
| `-I dir` / `-L dir` / `-lname` | Add a header search path / library search path / link `libname`. |
| `-D NAME=val` | Define a macro from the command line (like `#define NAME val`). |
| `-fsanitize=address,undefined` | Runtime checks for memory errors and undefined behaviour (ASan / UBSan). |

# Warnings are free bug reports

Every sample in these notes is compiled with `-Wall -Wextra -Werror`. This one is rejected at compile time because the format string does not match the argument:

```c filename:C
#include <stdio.h>

int main(void) {
    double price = 9.99;
    printf("%d\n", price);   /* %d expects int, got double */
    return 0;
}
```

```text filename:Compiler
main.c:5:20: error: format specifies type 'int' but the argument has type 'double' [-Werror,-Wformat]
    5 |     printf("%d\n", price);   /* %d expects int, got double */
      |             ~~     ^~~~~
      |             %f
```

# Compile-time vs link-time errors

| Error | Stage | Typical cause |
| --- | --- | --- |
| `expected ';'` | Compile | Syntax error |
| `implicit declaration of function` | Compile | Missing `#include` or prototype |
| `undefined reference to 'foo'` | Link | Function declared but never defined / `.o` or `-l` library not linked |
| `multiple definition of 'x'` | Link | Global <em>defined</em> in a header included by two `.c` files |
| `undefined reference to 'sqrt'` | Link | Forgot `-lm` (math library) on some Linux toolchains |

```question
What is a translation unit?

---

One `.c` file after preprocessing — the source plus every header it includes, with macros expanded. The compiler works on one translation unit at a time; the linker joins them.
```

```question
What is the difference between a compiler error and a linker error?

---

A compiler error means a single file is not valid C (syntax, types, undeclared names). A linker error means every file compiled fine, but a symbol that was <em>declared</em> and used was never <em>defined</em> in any object file or library (or was defined twice).
```

```question
Static vs dynamic linking?

---

Static linking copies library code into the executable (`.a` archives) — bigger binary, no runtime dependency. Dynamic linking (`.so` / `.dylib` / `.dll`) records a reference that the loader resolves when the program starts — smaller binaries, shared updates, but the library must be present.
```
