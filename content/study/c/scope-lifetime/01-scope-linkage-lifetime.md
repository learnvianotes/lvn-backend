---
id: e18fcc35-9733-74c3-bbbd-daf15a634a5a
key: topic:c/scope-lifetime
subject: c
topic: scope-lifetime
title: Scope, Linkage & Lifetime
slug: scope-linkage-lifetime
order: 1
---

Three independent questions about every identifier: <em>where</em> can the name be used (scope), <em>how long</em> does the object exist (storage duration) and <em>can other files see it</em> (linkage).

# Scope — where a name is visible

| Scope | Begins / ends | Example |
| --- | --- | --- |
| Block | Declaration → closing `}` | Locals, loop variables `for (int i…)` |
| File | Declaration → end of translation unit | Globals, functions |
| Function | Whole function | Only `goto` labels |
| Function prototype | End of the prototype | `int f(int n);` — the name `n` |

```c filename:C
#include <stdio.h>

int x = 1;                           /* file scope */

int main(void) {
    printf("global x = %d\n", x);
    int x = 2;                       /* shadows the global */
    {
        int x = 3;                   /* shadows the outer local */
        printf("inner x = %d\n", x);
    }
    printf("local x = %d\n", x);
    for (int i = 0; i < 1; i++) {
        printf("i = %d\n", i);
    }
    /* i is out of scope here */
    return 0;
}
```

```text filename:Output
global x = 1
inner x = 3
local x = 2
i = 0
```

# Storage duration — how long the object lives

| Duration | Objects | Lifetime | Where |
| --- | --- | --- | --- |
| Automatic | Locals, parameters | Until the block exits | Stack |
| Static | Globals, `static` locals, string literals | Whole program | `.data` / `.bss` / `.rodata` |
| Allocated | `malloc` / `calloc` / `realloc` | Until `free` | Heap |
| Thread (C11) | `_Thread_local` | Lifetime of the thread | Per-thread storage |

# Lifetime ends while a pointer lives on

```c filename:C%20%E2%80%94%20rejected%3A%20returning%20the%20address%20of%20a%20local%20variable
#include <stdio.h>

int *make_counter(void) {
    int count = 0;
    return &count;           /* address of a local that dies on return */
}

int main(void) {
    int *p = make_counter();
    printf("%d\n", *p);
    return 0;
}
```

```text filename:Compiler
main.c:5:13: error: address of stack memory associated with local variable 'count' returned [-Werror,-Wreturn-stack-address]
```

Fixes: return the value itself, use a `static` local, let the caller pass a buffer, or allocate with `malloc` (caller frees).

# Linkage — can other files see it?

> [!NOTE] External
>
> Globals and functions by default. The same name in every file refers to one object.

> [!NOTE] Internal
>
> `static` at file scope. Private to one translation unit.

> [!NOTE] None
>
> Locals and parameters. Every declaration is a distinct object.

```question
What is the difference between scope and lifetime?

---

Scope is a compile-time property of a <em>name</em> (the region of source where it can be used). Lifetime is a run-time property of an <em>object</em> (when its storage exists). A `static` local has block scope but lives for the whole program; a `malloc`ed object has no name at all but lives until `free`.
```

```question
What is variable shadowing?

---

Declaring a variable in an inner scope with the same name as one in an outer scope; the inner name hides the outer one until its block ends. It is legal but confusing — `-Wshadow` warns about it.
```
