---
id: b3e966e4-c0ec-7920-bcae-d24890a599e5
key: topic:c/memory-bugs
subject: c
topic: memory-bugs
title: Common Memory Bugs
slug: common-memory-bugs
order: 1
---

C’s most expensive bugs are memory errors: they compile silently, often <em>seem</em> to work, and later crash or become security holes. Sanitizers (`-fsanitize=address,undefined`) and Valgrind find them.

| Bug | What it is | Caught by |
| --- | --- | --- |
| Buffer overflow | Read/write past the end (or before the start) of a buffer | ASan, `-D_FORTIFY_SOURCE` |
| Use after free | Access through a pointer to freed memory | ASan, Valgrind |
| Double free | `free` the same block twice | ASan, glibc checks |
| Memory leak | Lose the last pointer to a block without freeing it | LeakSanitizer, Valgrind |
| Dangling stack pointer | Use a pointer to a local after its function returned | Compiler warning, ASan (use-after-return) |
| Uninitialised read | Read a variable / malloc’d memory before writing it | `-Wuninitialized`, MSan, Valgrind |
| Invalid free | `free` a pointer not from `malloc` (stack array, `p + 1`) | ASan |
| NULL dereference | Use a pointer that is `NULL` (e.g. unchecked `malloc`) | Crash (SIGSEGV), UBSan |

# Heap buffer overflow

```c filename:C
#include <stdlib.h>
#include <string.h>

int main(void) {
    char *name = malloc(5);
    strcpy(name, "Alice");        /* needs 6 bytes: 5 letters + '\0' */
    free(name);
    return 0;
}
```

```text filename:AddressSanitizer%20(trimmed)
==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x602000000955
WRITE of size 6 at 0x602000000955 thread T0
0x602000000955 is located 0 bytes after 5-byte region [0x602000000950,0x602000000955)
```

# Use after free

```c filename:C
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *p = malloc(sizeof *p);
    if (!p) return 1;
    *p = 42;
    free(p);
    printf("%d\n", *p);           /* the block now belongs to the allocator */
    return 0;
}
```

```text filename:AddressSanitizer%20(trimmed)
==ERROR: AddressSanitizer: heap-use-after-free on address 0x602000000950
READ of size 4 at 0x602000000950 thread T0
freed by thread T0 here: ... in free
previously allocated by thread T0 here: ... in malloc
```

# Double free

```c filename:C
#include <stdlib.h>

int main(void) {
    char *buf = malloc(16);
    free(buf);
    free(buf);                    /* second free of the same block */
    return 0;
}
```

```text filename:AddressSanitizer%20(trimmed)
==ERROR: AddressSanitizer: attempting double-free on 0x602000000950 in thread T0
```

# Invalid free

```c filename:C
#include <stdlib.h>

int main(void) {
    int *a = malloc(4 * sizeof *a);
    if (!a) return 1;
    a++;                          /* lost the original pointer */
    free(a);                      /* not the address malloc returned */
    return 0;
}
```

# Stack buffer overflow &amp; use after scope

```c filename:C%20%E2%80%94%20stack-use-after-scope%20caught%20by%20AddressSanitizer
#include <stdio.h>

int main(void) {
    int *p;
    {
        int inner = 7;
        p = &inner;
    }                             /* inner's lifetime ends here */
    printf("%d\n", *p);
    return 0;
}
```

# Memory leak

```c filename:C%20%E2%80%94%20a%20leak%20runs%20%E2%80%9Cfine%E2%80%9D%2C%20which%20is%20exactly%20the%20danger
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *greet(const char *name) {
    char *s = malloc(strlen(name) + 7);
    if (s) { strcpy(s, "Hello "); strcat(s, name); }
    return s;                      /* the caller now owns s */
}

int main(void) {
    for (int i = 0; i < 3; i++) {
        char *msg = greet("Bob");
        if (msg) puts(msg);
        /* missing free(msg): each iteration leaks 10 bytes */
    }
    return 0;
}
```

```text filename:Output
Hello Bob
Hello Bob
Hello Bob
```

```text filename:LeakSanitizer%20on%20Linux%20(illustrative)
==ERROR: LeakSanitizer: detected memory leaks
Direct leak of 30 byte(s) in 3 object(s) allocated from:
    #0 in malloc
    #1 in greet main.c:6
```

> [!NOTE] Key point
>
> Leaks don’t crash — they grow memory use until a long-running server is killed. Run tests under `-fsanitize=address` on Linux (LeakSanitizer is on by default there) or `valgrind --leak-check=full`.

# Uninitialised reads

```c filename:C%20%E2%80%94%20rejected%3A%20variable%20'total'%20is%20uninitialized%20when%20used
#include <stdio.h>

int main(void) {
    int total;
    for (int i = 0; i < 3; i++) total += i;    /* total starts as garbage */
    printf("%d\n", total);
    return 0;
}
```

# Defensive habits

- Initialise every variable at declaration; `= {0}` for arrays and structs.
- Check every `malloc` / `fopen` / `realloc` result.
- Set pointers to `NULL` after `free`; keep one clear owner per allocation.
- Pass buffer sizes everywhere; prefer `snprintf`, `fgets`, `strncat`/`memcpy` with explicit lengths.
- Build debug and test runs with `-g -fsanitize=address,undefined`; run Valgrind in CI.
- Use the `goto cleanup` pattern so every exit path frees what was allocated.

```question
What is a dangling pointer and how do you avoid it?

---

A pointer that still holds the address of an object whose lifetime has ended — freed heap memory, or a local of a function that returned. Avoid it by setting pointers to `NULL` after `free`, never returning addresses of locals, and having a clear ownership rule for every allocation.
```

```question
What is the difference between a memory leak and a dangling pointer?

---

A leak is memory that is still allocated but no longer reachable (no pointer to it) — wasted but harmless to correctness. A dangling pointer is the opposite: a pointer still exists but the memory is gone — using it is undefined behaviour.
```

```question
How does AddressSanitizer work?

---

The compiler instruments every memory access with a check against <em>shadow memory</em> that records which bytes are addressable. The runtime surrounds allocations with poisoned <em>redzones</em> and quarantines freed blocks, so overflows and use-after-free hit poisoned bytes and are reported immediately with stack traces. Cost: \~2× slowdown and more memory.
```
