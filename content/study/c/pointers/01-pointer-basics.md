---
id: 34356b5e-d2a1-7451-92e0-e9fa2e42af9d
key: topic:c/pointers
subject: c
topic: pointers
title: Pointer Basics
slug: pointer-basics
order: 1
---

A pointer is a variable that holds the <em>address</em> of another object. `&` takes an address, `*` follows one. Pointers are what make C fast, flexible — and dangerous.

> [!INFO]
>
> <strong>Pointer</strong> — an object whose value is a memory address, together with the <em>type</em> of what lives there. `int *p` means “`p` points to an `int`” — the type tells the compiler how many bytes to read through it and how far `p + 1` moves.

# Declare, take an address, dereference

```c filename:C
#include <stdio.h>

int main(void) {
    int x = 10;
    int *p = &x;          /* p holds the address of x */

    printf("x = %d, *p = %d\n", x, *p);
    *p = 20;              /* write through the pointer */
    printf("x = %d\n", x);
    printf("p == &x ? %d\n", p == &x);
    printf("sizeof p = %zu, sizeof *p = %zu\n", sizeof p, sizeof *p);
    return 0;
}
```

```text filename:Output
x = 10, *p = 10
x = 20
p == &x ? 1
sizeof p = 8, sizeof *p = 4
```

| Expression | Meaning | Value here |
| --- | --- | --- |
| `x` | The `int` itself | 20 |
| `&x` | Address of `x` (type `int *`) | e.g. `0x16fdff1ac` |
| `p` | The address stored in `p` | same as `&x` |
| `*p` | The `int` at that address | 20 |
| `&p` | Address of the pointer variable (type `int **`) | another address |

# Printing addresses

```c filename:C%20%E2%80%94%20addresses%20change%20on%20every%20run%20(ASLR)%2C%20so%20no%20fixed%20output
#include <stdio.h>

int main(void) {
    int a = 1;
    double d = 2.0;
    printf("&a = %p\n&d = %p\n", (void *)&a, (void *)&d);
    return 0;
}
```

> [!NOTE] Key point
>
> `%p` expects a `void *`; cast other pointer types. Addresses differ between runs because of <em>address space layout randomisation</em>.

# NULL and pointer states

> [!NOTE] Valid
>
> Points to a live object of the right type — the only state you may dereference.

> [!NOTE] NULL
>
> `p = NULL;` — explicitly points nowhere. Test with `if (p)` / `if (p != NULL)`. Dereferencing it crashes.

> [!NOTE] Wild / uninitialised
>
> `int *p;` holds garbage. Dereferencing it writes to a random address.

> [!NOTE] Dangling
>
> Pointed to an object whose lifetime ended (freed or out of scope).

```c filename:C
#include <stdio.h>

int find(const int *a, int n, int key, const int **where) {
    for (int i = 0; i < n; i++)
        if (a[i] == key) { *where = &a[i]; return 1; }
    *where = NULL;
    return 0;
}

int main(void) {
    int nums[] = {4, 8, 15};
    const int *hit;
    if (find(nums, 3, 8, &hit)) printf("found %d at index %td\n", *hit, hit - nums);
    if (!find(nums, 3, 99, &hit) && hit == NULL) printf("99 not found, hit is NULL\n");
    return 0;
}
```

```text filename:Output
found 8 at index 1
99 not found, hit is NULL
```

# Dereferencing NULL

```c filename:C%20%E2%80%94%20NULL%20dereference%20(UBSan%3A%20load%20of%20null%20pointer%3B%20without%20it%2C%20a%20segfault)
#include <stdio.h>

int main(void) {
    int *p = NULL;
    printf("%d\n", *p);      /* segmentation fault */
    return 0;
}
```

> [!WARNING] Watch out
>
> `int* a, b;` declares <strong>one</strong> pointer (`a`) and one `int` (`b`) — the `*` binds to the name, not the type. Write `int *a, *b;` or one declaration per line.

```question
What is the size of a pointer?

---

It depends on the platform, not on the pointed-to type: 8 bytes on 64-bit systems, 4 on 32-bit. `sizeof(char *) == sizeof(double *)` on all mainstream platforms (function pointers can differ on exotic ones).
```

```question
What is the difference between NULL, 0 and '\\0'?

---

`NULL` is a null <em>pointer</em> constant (usually `((void *)0)`). `0` is an integer that also acts as a null pointer constant in pointer context. `'\0'` is the NUL <em>character</em> (an `int` with value 0) used to terminate strings. They compare equal to zero but mean different things — use each in its own role. C23 adds `nullptr`.
```

```question
Why use pointers at all?

---

To let functions modify caller data (out-parameters), to pass large objects cheaply, to work with dynamically allocated memory, to build linked data structures (lists, trees, graphs), to iterate arrays efficiently and to implement callbacks via function pointers.
```
