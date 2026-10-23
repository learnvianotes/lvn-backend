---
id: ddcdc60c-23c1-77c2-92aa-6345278d2278
key: topic:c/memory-layout
subject: c
topic: memory-layout
title: Memory Layout of a C Program
slug: memory-layout-of-a-c-program
order: 1
---

A running C program’s address space is split into segments: code, read-only data, initialised data, zero-initialised data (bss), the heap growing up and the stack growing down.

| Segment | Holds | Lifetime | Notes |
| --- | --- | --- | --- |
| <strong>Text</strong> (`.text`) | Machine code of functions | Program | Read-only + executable; shared between processes |
| <strong>Read-only data</strong> (`.rodata`) | String literals, `const` globals | Program | Writing crashes |
| <strong>Data</strong> (`.data`) | Initialised globals / `static`s (`int g = 5;`) | Program | Values stored in the executable file |
| <strong>BSS</strong> (`.bss`) | Zero / uninitialised globals / `static`s | Program | Only the size is stored; zero-filled at load |
| <strong>Heap</strong> | `malloc` / `calloc` / `realloc` | Until `free` | Grows upward; managed by the allocator |
| <strong>Stack</strong> | Locals, parameters, return addresses | Until the function returns | Grows downward; \~8 MB default on Linux/macOS main thread |

high addresses: <strong>stack</strong> ↓ → (free space) → ↑ <strong>heap</strong> → <strong>.bss</strong> → <strong>.data</strong> → <strong>.rodata</strong> → low addresses: <strong>.text</strong>

```c filename:C%20%E2%80%94%20addresses%20differ%20per%20run%20and%20platform%20(no%20fixed%20output)
#include <stdio.h>
#include <stdlib.h>

int initialised = 42;          /* .data */
int zeroed;                    /* .bss  */
const char *msg = "literal";   /* pointer in .data, the characters in .rodata */

void where(void) { }           /* .text */

int main(void) {
    int local = 1;                              /* stack */
    static int counter;                         /* .bss (static, zero) */
    int *heap = malloc(sizeof *heap);           /* heap  */
    if (!heap) return 1;
    printf("text   %p\n", (void *)(size_t)where);
    printf("rodata %p\n", (const void *)msg);
    printf("data   %p\n", (void *)&initialised);
    printf("bss    %p %p\n", (void *)&zeroed, (void *)&counter);
    printf("heap   %p\n", (void *)heap);
    printf("stack  %p\n", (void *)&local);
    free(heap);
    return 0;
}
```

# Inspecting the segments

```filename:Terminal
$ size ./app                      # text / data / bss sizes (Linux)
   text    data     bss     dec     hex filename
   1845     616       8    2469     9a5 ./app
$ objdump -h ./app                # section headers
$ nm ./app | grep ' [bBdD] '      # symbols in bss (b/B) and data (d/D)
$ ulimit -s                       # stack size limit in KB
8192
```

# Stack vs heap

|  | Stack | Heap |
| --- | --- | --- |
| Allocation | Automatic (move the stack pointer) | Explicit `malloc` / `free` |
| Speed | Very fast | Slower (allocator bookkeeping, possible system call) |
| Size | Small, fixed limit | Large — limited by RAM / address space |
| Lifetime | Ends when the function returns | Until you `free` it |
| Failure mode | Stack overflow (crash) | `malloc` returns `NULL`; leaks, fragmentation |
| Typical bugs | Returning addresses of locals, huge arrays, deep recursion | Leaks, use-after-free, double free |

# Stack frames

Each call pushes a <em>frame</em>: return address, saved registers, parameters that don’t fit in registers, and locals. Returning pops it — which is exactly why a pointer to a local is dangling after the return.

```c filename:C
#include <stdio.h>

int depth(int n) {
    char pad[1024];                /* 1 KB of stack per call */
    pad[0] = (char)n;
    if (n == 0) return pad[0];
    return depth(n - 1) + 1;
}

int main(void) {
    printf("%d frames deep, fine\n", depth(100));    /* ~100 KB of stack */
    return 0;
}
```

```text filename:Output
100 frames deep, fine
```

> [!WARNING] Watch out
>
> `char big[16 * 1024 * 1024];` as a local, or unbounded recursion, overflows the stack. Put large buffers on the heap or make them `static`.

```question
Where are string literals stored?

---

In a read-only data segment (`.rodata`), with static storage duration. Identical literals may share storage. Modifying one is undefined behaviour and usually crashes.
```

```question
What is the difference between .data and .bss?

---

Both hold objects with static storage duration. `.data` holds those with a non-zero initialiser — their initial bytes are stored in the executable. `.bss` holds zero-initialised ones; the file records only the total size and the loader zero-fills it, keeping executables small.
```

```question
Why does the stack grow down and the heap grow up?

---

Historically, so both could share one free region between them and each could grow until they met, without choosing a fixed split in advance. Modern systems use separate mappings with guard pages, but the convention remains on most architectures.
```
