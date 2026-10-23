---
id: 4f0fc33e-1fdf-7e36-8824-fac1047aefa2
key: topic:c/bit-fields
subject: c
topic: bit-fields
title: Bit-fields
slug: bit-fields
order: 1
---

A bit-field is a struct member with an explicit width in bits. It packs several small values into one integer — flags, compact records, protocol headers.

```c filename:C%20%E2%80%94%20compiled%20with%20-Wno-bitfield-constant-conversion%20to%20show%20the%20truncation
#include <stdio.h>

struct Flags {
    unsigned int visible  : 1;
    unsigned int editable : 1;
    unsigned int priority : 3;     /* 0..7 */
    unsigned int reserved : 3;
};

struct Date {                      /* day 1-31, month 1-12, year offset 0-127 */
    unsigned int day   : 5;
    unsigned int month : 4;
    unsigned int year  : 7;
};

int main(void) {
    struct Flags f = {.visible = 1, .priority = 5};
    f.editable = 1;
    printf("%u %u %u, sizeof = %zu\n", f.visible, f.editable, f.priority, sizeof f);

    f.priority = 9;                /* 9 doesn't fit in 3 bits: stored modulo 8 */
    printf("priority now %u\n", f.priority);

    struct Date d = {29, 9, 26};   /* 2026 as an offset from 2000 */
    printf("%02u/%02u/%u in %zu bytes\n", d.day, d.month, 2000 + d.year, sizeof d);
    return 0;
}
```

```text filename:Output
1 1 5, sizeof = 4
priority now 1
29/09/2026 in 4 bytes
```

# Rules and limits

- Allowed types: `unsigned int`, `signed int`, `_Bool` (and others as an extension). Use `unsigned` — the signedness of a plain `int` bit-field is implementation-defined.
- You <strong>cannot</strong> take the address of a bit-field (`&f.visible` is an error) or make arrays of them.
- Layout (bit order, whether fields straddle storage units, padding) is <strong>implementation-defined</strong> — don’t use bit-fields to match an external binary format portably.
- An unnamed field `unsigned : 0;` forces the next field to start in a new storage unit.
- Reading/writing a bit-field compiles to load-mask-shift-store — slower than a plain `int`, and not atomic.

# Bit-fields vs masks

| Bit-fields | Manual masks (`flags & MASK`) |
| --- | --- |
| Readable: `f.priority = 5` | Verbose: `f = (f & ~PRIO_MASK) &#124; (5u << PRIO_SHIFT)` |
| Layout implementation-defined | Layout exactly what you write |
| Can’t take address, can’t pass a set of flags easily | Flags combine naturally: `READ &#124; WRITE` |
| Good for in-memory compact records | Good for hardware registers, file/network formats |

```question
Can you take the address of a bit-field member?

---

No. Bit-fields may start in the middle of a byte, and pointers address whole bytes, so `&s.field` is a compile error. `sizeof` can't be applied to a bit-field either.
```

```question
What is the size of struct { unsigned a:3; unsigned b:5; }?

---

Typically 4 bytes: both fields fit into one `unsigned int` storage unit (8 bits used), and the struct is padded to the alignment of `unsigned int`. The exact layout is implementation-defined.
```
