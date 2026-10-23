---
id: 473fb5a8-cec7-75cb-a2b7-5bd5634f51c5
key: topic:c/const-pointers
subject: c
topic: const-pointers
title: const with Pointers
slug: const-with-pointers
order: 1
---

`const` can protect the <em>pointed-to data</em>, the <em>pointer itself</em>, or both. Read the declaration <strong>right to left</strong>.

| Declaration | Read as | Change `*p`? | Change `p`? |
| --- | --- | --- | --- |
| `int *p` | pointer to int | Yes | Yes |
| `const int *p` (= `int const *p`) | pointer to const int | <strong>No</strong> | Yes |
| `int *const p` | const pointer to int | Yes | <strong>No</strong> |
| `const int *const p` | const pointer to const int | <strong>No</strong> | <strong>No</strong> |

```c filename:C
#include <stdio.h>

int main(void) {
    int a = 1, b = 2;

    const int *to_const = &a;     /* read-only view */
    to_const = &b;                /* OK: pointer can move */

    int *const fixed = &a;        /* pointer is fixed */
    *fixed = 10;                  /* OK: data can change */

    const int *const both = &b;
    printf("%d %d %d\n", *to_const, a, *both);
    return 0;
}
```

```text filename:Output
2 10 2
```

```c filename:C%20%E2%80%94%20both%20assignments%20are%20compile%20errors
int main(void) {
    int a = 1, b = 2;
    const int *to_const = &a;
    *to_const = 5;                /* error: read-only */
    int *const fixed = &a;
    fixed = &b;                   /* error: pointer is const */
    return 0;
}
```

# const in function parameters

```c filename:C
#include <stdio.h>
#include <ctype.h>

/* const promises: "I will only read the characters" */
int count_upper(const char *s) {
    int n = 0;
    for (; *s; s++)                 /* moving the pointer is fine */
        if (isupper((unsigned char)*s)) n++;
    return n;
}

int main(void) {
    char name[] = "Hello World";
    printf("%d\n", count_upper(name));   /* char * -> const char * is implicit */
    printf("%d\n", count_upper("ABC"));
    return 0;
}
```

```text filename:Output
2
3
```

> [!NOTE] Key point
>
> Converting `T *` → `const T *` is implicit and safe. The reverse (`const T *` → `T *`) needs a cast, and writing through the result to a truly `const` object is undefined behaviour.

> [!TIP] Do
>
> Mark every pointer parameter you only read as `const` — `size_t strlen(const char *s)`, `void print(const struct item *it)`.

> [!DANGER] Avoid
>
> Cast `const` away to “make it compile”.

```question
What is the difference between const char \*p, char const \*p and char \*const p?

---

The first two are identical: a (modifiable) pointer to read-only `char`s. The third is a read-only pointer to modifiable `char`s — `p` must be initialised and can never point elsewhere. Rule: `const` applies to what is on its left, or to the right if nothing is on the left.
```

```question
Can a const variable be modified through a pointer?

---

Only by casting away `const`, and if the object was <em>defined</em> `const` the result is undefined behaviour (it may live in read-only memory, or the compiler may have folded its value into the code).
```
