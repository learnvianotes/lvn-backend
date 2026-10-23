---
id: f20c4761-cecc-73c6-b09c-f66127a0321b
key: topic:c/interview-questions
subject: c
topic: interview-questions
title: C Interview Questions
slug: c-interview-questions
order: 1
---

The questions that come up again and again in C and embedded interviews — each with a crisp answer. Most are covered in depth in the earlier topics.

# Output prediction warm-ups

```c filename:C%20%E2%80%94%20compiled%20with%20-Wno-sign-compare%20to%20allow%20the%20trap
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[] = "interview";
    char *p = s;
    printf("%zu %zu\n", sizeof s, strlen(s));        /* 10 9 */
    printf("%c %c\n", *p + 1, *(p + 1));             /* 'i'+1 = 'j', then 'n' */

    int a[] = {1, 2, 3, 4, 5};
    int *q = a + 1;
    printf("%d %d %td\n", q[2], *(a + 4), &a[4] - q);

    unsigned int u = 5;
    int i = -10;
    printf("%s\n", u + i > 5 ? "big" : "small");     /* i converts to unsigned */

    int x = 10;
    printf("%d\n", x >> 1 << 2);                     /* (10 >> 1) << 2 = 20 */
    printf("%d\n", 3 == 3.0);                        /* 3 converts to double */
    printf("%d\n", 'A' + 1);
    return 0;
}
```

```text filename:Output
10 9
j n
4 5 3
big
20
1
66
```

# Language fundamentals

```question
What are the storage classes in C?

---

`auto` (default for locals: block scope, automatic lifetime), `register` (auto + no address; historic hint), `static` (static lifetime; internal linkage at file scope; value persists between calls as a local), `extern` (declares an object/function defined elsewhere, external linkage), and C11 `_Thread_local`. `typedef` is grammatically a storage-class specifier too.
```

```question
What is the difference between declaration and definition?

---

A declaration tells the compiler a name and its type (`extern int x;`, `int f(void);`). A definition also creates the object or supplies the function body (`int x = 0;`, `int f(void) { … }`). A name can be declared many times but defined exactly once.
```

```question
What is a volatile variable? Give examples.

---

A variable whose value can change outside the program’s visible control flow, so the compiler must perform every read and write exactly as written: memory-mapped hardware registers, variables modified in signal handlers (`volatile sig_atomic_t`), and memory changed by DMA. It does not provide thread synchronisation.
```

```question
Explain const int \*p, int \*const p and const int \*const p.

---

Pointer to const int (can’t modify `*p`, can move `p`); const pointer to int (can modify `*p`, can’t move `p`); const pointer to const int (neither). Read the declaration right to left.
```

```question
What is the difference between ++i and i++ in a for loop?

---

None for `int` in a standalone increment — compilers generate identical code. The difference only matters when the expression’s value is used: `i++` yields the old value, `++i` the new one.
```

```question
What are sequence points and why do they matter?

---

Points in execution where all previous side effects are complete: the end of a full expression (`;`), after the first operand of `&&`, `||`, `?:` and `,`, and before a function call. Modifying an object twice (or modifying and reading it for another purpose) without an intervening sequence point is undefined behaviour — e.g. `i = i++`, `a[i] = i++`.
```

# Pointers and memory

```question
What is the difference between malloc and calloc? What does realloc do?

---

`malloc(n)` returns `n` uninitialised bytes; `calloc(count, size)` returns zeroed memory for `count × size` bytes with overflow checking. `realloc(p, n)` resizes a block, possibly moving it (copying the old contents); on failure it returns `NULL` and leaves the old block intact.
```

```question
What are dangling pointers, wild pointers and memory leaks?

---

A <em>dangling</em> pointer points to memory that has been freed or gone out of scope. A <em>wild</em> pointer was never initialised and holds a garbage address. A <em>leak</em> is allocated memory that is no longer referenced by any pointer, so it can never be freed.
```

```question
What is a NULL pointer vs a void pointer?

---

A null pointer is a <em>value</em> — a pointer of any type that points to nothing. A `void *` is a <em>type</em> — a generic pointer that can hold the address of any object but must be cast before dereferencing. A `void *` can itself be null.
```

```question
Can you return a pointer to a local variable?

---

No — the local’s lifetime ends when the function returns, so the pointer dangles. Return by value, use a `static` local (not reentrant), write into a caller-provided buffer, or return heap memory that the caller frees.
```

```question
What is the difference between arrays and pointers?

---

An array is a block of storage whose name decays to a pointer to its first element in most expressions; a pointer is a variable storing an address. `sizeof` differs (whole array vs pointer size), an array name can’t be assigned, and `&array` has type pointer-to-array.
```

```question
How do you find the size of an array passed to a function?

---

You can’t — it has decayed to a pointer. Pass the length as a separate parameter (or use a sentinel such as `'\0'` for strings, or wrap the array in a struct).
```

```question
What is memory alignment and structure padding?

---

Each type must be stored at an address that is a multiple of its alignment; the compiler inserts padding bytes between struct members and at the end to satisfy that for every member and for arrays of the struct. Ordering members from largest to smallest minimises padding.
```

```question
Explain stack vs heap.

---

The stack holds function frames (locals, return addresses); allocation is automatic and very fast but the size is limited and data dies when the function returns. The heap holds `malloc`’d memory; it is large and lives until `free`, but allocation is slower and the programmer manages the lifetime (leaks, use-after-free).
```

# Classic coding questions

```c filename:C
#include <stdio.h>
#include <string.h>

/* 1. reverse words in place: "the sky is blue" -> "blue is sky the" */
static void rev(char *a, char *b) { while (a < b) { char t = *a; *a++ = *b; *b-- = t; } }
void reverse_words(char *s) {
    size_t n = strlen(s);
    if (n == 0) return;
    rev(s, s + n - 1);                               /* reverse whole string */
    for (char *w = s; *w; ) {                        /* then each word */
        while (*w == ' ') w++;
        char *e = w;
        while (*e && *e != ' ') e++;
        if (e > w) rev(w, e - 1);
        w = e;
    }
}

/* 2. endianness check */
int is_little_endian(void) { unsigned x = 1; return *(unsigned char *)&x == 1; }

/* 3. my_atoi with sign and overflow saturation */
int my_atoi(const char *s) {
    long v = 0;
    int sign = 1;
    while (*s == ' ') s++;
    if (*s == '-' || *s == '+') sign = (*s++ == '-') ? -1 : 1;
    while (*s >= '0' && *s <= '9') {
        v = v * 10 + (*s++ - '0');
        if (v > 2147483648L) break;
    }
    v *= sign;
    if (v > 2147483647L) return 2147483647;
    if (v < -2147483648L) return (int)-2147483648L;
    return (int)v;
}

/* 4. count set bits, reverse bits of a byte */
unsigned char reverse_byte(unsigned char b) {
    unsigned char r = 0;
    for (int i = 0; i < 8; i++) { r = (unsigned char)((r << 1) | (b & 1)); b >>= 1; }
    return r;
}

int main(void) {
    char s[] = "the sky is blue";
    reverse_words(s);
    printf("%s\n", s);
    printf("little endian: %d\n", is_little_endian());
    printf("%d %d %d %d\n", my_atoi("  -42"), my_atoi("+17abc"), my_atoi("99999999999"), my_atoi("-99999999999"));
    printf("0x%02X\n", reverse_byte(0x01));
    return 0;
}
```

```text filename:Output
blue is sky the
little endian: 1
-42 17 2147483647 -2147483648
0x80
```

# Tricky questions

```question
What does printf return?

---

The number of characters written (excluding the terminating NUL), or a negative value on error. So `printf("%d", printf("hello"))` prints `hello5`.
```

```question
What is the output of sizeof on an expression with side effects, e.g. sizeof(i++)?

---

`i` is not incremented: `sizeof` does not evaluate its operand (except for variable-length arrays); it only inspects the type at compile time.
```

```question
How can you swap two variables without a temporary?

---

`a ^= b; b ^= a; a ^= b;` or `a = a + b; b = a - b; a = a - b;`. Both are curiosities: the XOR version fails if `a` and `b` are the same object (it zeroes it), and the arithmetic version can overflow. A temporary is clearer and just as fast.
```

```question
What is the difference between #include guards and #pragma once?

---

Both stop a header from being processed twice in one translation unit. Guards (`#ifndef X_H`) are standard and work everywhere; `#pragma once` is shorter, avoids guard-name collisions, and is supported by GCC, Clang and MSVC, but is not in the standard.
```

```question
Why is gets() dangerous and what replaces it?

---

`gets` reads a line into a buffer without knowing the buffer’s size, so any long input overflows it — it was the vector of the 1988 Morris worm. It was removed in C11. Use `fgets(buf, sizeof buf, stdin)` (and strip the newline).
```

```question
What is a memory-mapped register and how do you access it in C?

---

A hardware device register exposed at a fixed physical address. Access it through a pointer to `volatile` of the right width: `#define GPIO_OUT (*(volatile uint32_t *)0x40020014u)`, then `GPIO_OUT |= 1u << 5;`. `volatile` ensures every access actually reaches the hardware.
```

```question
What happens when you write int \*p = malloc(10); p\[10\] = 1;?

---

Undefined behaviour twice over: `malloc(10)` gives 10 <em>bytes</em> (2 ints on a 4-byte-int system, not 10 ints), and index 10 is far past the end. It may corrupt allocator metadata and crash later. Correct: `int *p = malloc(10 * sizeof *p);` and indexes 0–9.
```

```question
Does C use name mangling?

---

C has no name mangling: the symbol for `int add(int, int)` is just `add` (sometimes `_add`). That is why C functions can’t be overloaded, and why C++ code calling C uses `extern "C"` to turn off C++ mangling.
```
