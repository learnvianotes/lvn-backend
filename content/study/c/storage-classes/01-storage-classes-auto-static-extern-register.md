---
id: 8054ab12-716e-7047-93aa-db864725e7c9
key: topic:c/storage-classes
subject: c
topic: storage-classes
title: "Storage Classes: auto, static, extern, register"
slug: storage-classes-auto-static-extern-register
order: 1
---

A storage-class specifier decides <em>where</em> a variable lives, <em>how long</em> it lives (lifetime) and <em>who can see it</em> (linkage).

| Specifier | Lifetime | Default value | Scope / linkage | Typical use |
| --- | --- | --- | --- | --- |
| `auto` (default for locals) | Until the block ends | Garbage | Block, no linkage | Ordinary local variables |
| `static` (local) | Whole program | 0 | Block, no linkage | Remember a value between calls |
| `static` (global / function) | Whole program | 0 | File only (<strong>internal</strong> linkage) | Hide helpers from other files |
| `extern` | Whole program | 0 (where defined) | All files (<strong>external</strong> linkage) | Share a global across files |
| `register` | Until the block ends | Garbage | Block | Historic hint; cannot take its address |
| `_Thread_local` (C11) | Per thread | 0 | As above | One copy per thread |

# static local: state that survives calls

```c filename:C
#include <stdio.h>

int next_id(void) {
    static int id = 0;      /* initialised once, before the program starts */
    int calls = 0;          /* automatic: recreated on every call */
    calls++;
    id++;
    printf("id=%d calls=%d\n", id, calls);
    return id;
}

int main(void) {
    next_id();
    next_id();
    next_id();
    return 0;
}
```

```text filename:Output
id=1 calls=1
id=2 calls=1
id=3 calls=1
```

# static at file level: private to the file

```c filename:C%20%E2%80%94%20counter.c%20(compile-checked)
/* counter.c */
static int count = 0;                 /* invisible to other .c files */

static void log_change(void) { }      /* helper, internal linkage */

void counter_increment(void) {
    count++;
    log_change();
}

int counter_value(void) { return count; }
```

# extern: one definition, many declarations

```c filename:C
#include <stdio.h>

extern int shared;             /* declaration: "defined somewhere else" */
void bump(void);

int main(void) {
    bump();
    bump();
    printf("shared = %d\n", shared);
    return 0;
}

int shared = 100;              /* the one definition (normally in another .c file) */

void bump(void) { shared += 5; }
```

```text filename:Output
shared = 110
```

> [!NOTE] Key point
>
> Put `extern int shared;` in a header, and `int shared = 0;` in exactly <strong>one</strong> `.c` file. Functions are `extern` by default, so `extern` on a prototype is redundant.

# register

```c filename:C
int main(void) {
    register int i = 0;
    int *p = &i;            /* error: address of register variable requested */
    return *p;
}
```

Modern compilers ignore `register` for optimisation — they allocate registers far better than humans. Its only remaining effect is forbidding `&`. (`auto` in C means “automatic storage”; C23 repurposes it for type inference like C++.)

```question
What are the differences between a static local variable and a global variable?

---

Both have static storage duration (they live for the whole program and are zero-initialised). A `static` local is only <em>visible</em> inside its function (block scope), whereas a global is visible to the whole file and — unless declared `static` — to other files via `extern`.
```

```question
What does static mean for a function?

---

It gives the function <em>internal linkage</em>: it can only be called from the translation unit that defines it. This is C’s way of making a function private and avoids name clashes between files.
```

```question
Can a static variable be initialised with a non-constant expression?

---

No, not in C. Objects with static storage duration must be initialised with constant expressions because the initial values are baked into the executable’s data segment before `main` runs. (C++ allows dynamic initialisation.)
```
