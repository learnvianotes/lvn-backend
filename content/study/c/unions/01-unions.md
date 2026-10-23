---
id: 753f7a31-979d-7d49-b339-387dd47167ab
key: topic:c/unions
subject: c
topic: unions
title: Unions
slug: unions
order: 1
---

A `union` is like a struct whose members all share the <strong>same memory</strong>. It is as large as its largest member, and only one member holds a meaningful value at a time.

```c filename:C
#include <stdio.h>

union Value {
    int i;
    float f;
    char bytes[8];
};

int main(void) {
    union Value v;
    printf("sizeof = %zu\n", sizeof v);      /* the largest member */
    v.i = 65;
    printf("i = %d\n", v.i);
    v.f = 2.5f;                               /* overwrites the same bytes */
    printf("f = %.1f\n", v.f);
    printf("same address: %d\n", (void *)&v.i == (void *)&v.f);
    return 0;
}
```

```text filename:Output
sizeof = 8
i = 65
f = 2.5
same address: 1
```

# Tagged unions (sum types)

Pair a union with an `enum` tag recording which member is active — the C equivalent of a variant or `enum` in Rust:

```c filename:C
#include <stdio.h>

typedef enum { SHAPE_CIRCLE, SHAPE_RECT } ShapeKind;

typedef struct {
    ShapeKind kind;                 /* the tag */
    union {                         /* anonymous union (C11) */
        struct { double r; } circle;
        struct { double w, h; } rect;
    };
} Shape;

double area(const Shape *s) {
    switch (s->kind) {
        case SHAPE_CIRCLE: return 3.14159 * s->circle.r * s->circle.r;
        case SHAPE_RECT:   return s->rect.w * s->rect.h;
    }
    return 0;
}

int main(void) {
    Shape shapes[] = {
        {.kind = SHAPE_CIRCLE, .circle = {1.0}},
        {.kind = SHAPE_RECT, .rect = {3, 4}},
    };
    for (int i = 0; i < 2; i++) printf("area = %.2f\n", area(&shapes[i]));
    printf("sizeof(Shape) = %zu\n", sizeof(Shape));
    return 0;
}
```

```text filename:Output
area = 3.14
area = 12.00
sizeof(Shape) = 24
```

# Inspecting bytes and endianness

```c filename:C
#include <stdio.h>
#include <stdint.h>

int main(void) {
    union { uint32_t word; uint8_t b[4]; } u = {.word = 0x11223344};
    printf("%02X %02X %02X %02X\n", u.b[0], u.b[1], u.b[2], u.b[3]);
    printf("%s-endian\n", u.b[0] == 0x44 ? "little" : "big");
    return 0;
}
```

```text filename:Output
44 33 22 11
little-endian
```

> [!NOTE] Key point
>
> Reading a union member other than the one last written (<em>type punning</em>) is allowed in C (it reinterprets the bytes; C++ forbids it). `memcpy` is the portable alternative in both languages.

|  | struct | union |
| --- | --- | --- |
| Memory | Each member has its own storage | All members overlap |
| `sizeof` | ≥ sum of members (plus padding) | Largest member (plus padding) |
| Active members | All at once | One at a time |
| Use | Records | Variants, memory saving, byte views |

```question
What is the difference between a structure and a union?

---

In a struct every member has its own storage, so all can hold values simultaneously and the size is at least the sum of the members. In a union all members start at the same address and share storage, so the size is that of the largest member and writing one member overwrites the others.
```

```question
How can you check the endianness of a machine?

---

Store a multi-byte integer such as `1` and inspect its first byte through a `unsigned char *` or a union: if the first byte is `1` the machine is little-endian (x86, ARM in its usual mode), otherwise big-endian.
```
