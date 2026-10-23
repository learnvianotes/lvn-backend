---
id: 8f9a761a-af8e-70a4-bcea-8f4297847a93
key: topic:c/padding-alignment
subject: c
topic: padding-alignment
title: Padding & Alignment
slug: padding-alignment
order: 1
---

CPUs load data fastest (or only) at addresses that are multiples of its size. The compiler therefore inserts invisible <strong>padding</strong> bytes into structs, so `sizeof` is often larger than the sum of the members.

```c filename:C
#include <stdio.h>
#include <stddef.h>

struct Bad  { char a; int b; char c; };      /* 1 + 3 pad + 4 + 1 + 3 pad */
struct Good { int b; char a; char c; };      /* 4 + 1 + 1 + 2 pad */

int main(void) {
    printf("Bad  = %zu bytes\n", sizeof(struct Bad));
    printf("Good = %zu bytes\n", sizeof(struct Good));
    printf("offsets in Bad: a=%zu b=%zu c=%zu\n",
           offsetof(struct Bad, a), offsetof(struct Bad, b), offsetof(struct Bad, c));
    printf("alignof(int)=%zu alignof(double)=%zu\n", _Alignof(int), _Alignof(double));
    return 0;
}
```

```text filename:Output
Bad  = 12 bytes
Good = 8 bytes
offsets in Bad: a=0 b=4 c=8
alignof(int)=4 alignof(double)=8
```

# The rules

1. <strong>Each member is aligned</strong>

   A member of type `T` starts at an offset that is a multiple of `_Alignof(T)` — padding is inserted before it if needed.

2. <strong>The struct is aligned</strong>

   The struct’s alignment is the largest alignment of any member.

3. <strong>Tail padding</strong>

   `sizeof` is rounded up to a multiple of the struct’s alignment, so that in an array every element is aligned too.

4. <strong>Order is kept</strong>

   The compiler never reorders members — the first member is always at offset 0.

| Offset | 0 | 1 | 2 | 3 | 4–7 | 8 | 9–11 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `struct Bad` | `a` | pad | pad | pad | `b` | `c` | pad |

# Minimising padding

```c filename:C
#include <stdio.h>

struct Messy  { char c1; double d; char c2; int i; short s; };
struct Sorted { double d; int i; short s; char c1; char c2; };   /* largest first */

int main(void) {
    printf("%zu %zu\n", sizeof(struct Messy), sizeof(struct Sorted));
    return 0;
}
```

```text filename:Output
32 16
```

> [!NOTE] Tip
>
> Order members from largest to smallest alignment. With arrays of millions of structs this halves memory use and improves cache behaviour.

# Packing (compiler extension)

```c filename:C
#include <stdio.h>
#include <stdint.h>

struct __attribute__((packed)) Header {     /* GCC/Clang; MSVC uses #pragma pack(1) */
    uint8_t  type;
    uint32_t length;
    uint16_t flags;
};

int main(void) {
    printf("packed size = %zu\n", sizeof(struct Header));
    return 0;
}
```

```text filename:Output
packed size = 7
```

> [!WARNING] Watch out
>
> Packed structs cause misaligned accesses — slower on x86, and a crash on some ARM/RISC CPUs if you take a pointer to a member. For file and network formats prefer reading bytes and assembling fields with shifts or `memcpy`.

# Explicit alignment (C11)

```c filename:C
#include <stdio.h>
#include <stdalign.h>
#include <stdint.h>

struct Cacheline { alignas(64) char data[64]; };   /* avoid false sharing between threads */

int main(void) {
    alignas(16) float v[4] = {0};
    printf("%zu %zu %d\n", alignof(struct Cacheline), sizeof(struct Cacheline),
           (int)((uintptr_t)v % 16 == 0));
    return 0;
}
```

```text filename:Output
64 64 1
```

```question
What is structure padding and why does it exist?

---

Unused bytes the compiler inserts between (and after) struct members so that each member sits at an address that is a multiple of its alignment. Aligned loads/stores are a single fast instruction; misaligned ones are slower or fault on some architectures.
```

```question
What is sizeof(struct { char c; double d; })?

---

16 on typical 64-bit platforms: `c` at offset 0, 7 bytes of padding, `d` at offset 8 (aligned to 8), total 16. Reversing the members gives 9 bytes of data rounded up to 16 as well (tail padding).
```

```question
How do you find the offset of a member?

---

`offsetof(type, member)` from `<stddef.h>`. It is used for serialisation, for generic containers and in the Linux kernel’s `container_of` macro to get from a member pointer back to the enclosing struct.
```
