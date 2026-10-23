---
id: 86ee0b6a-528c-7e95-8fe9-019e946038a8
key: topic:cpp/pointers
subject: cpp
topic: pointers
title: Pointers
slug: pointers
order: 1
---

A pointer is a variable that holds the <em>address</em> of an object. `&x` takes an address, `*p` follows it.

> [!INFO]
>
> <strong>Pointer</strong> — an object of type `T*` whose value is the memory address of a `T` (or `nullptr`). The pointer and the object it points to are separate — each can be `const` independently.

# Basics

```cpp filename:C%2B%2B
#include <iostream>
int main() {
    int x = 10;
    int* p = &x;          // p holds x's address
    *p = 20;              // write through the pointer
    std::cout << x << ' ' << *p << ' ' << (p == &x) << '\n';

    int y = 7;
    p = &y;               // re-point to another object
    std::cout << *p << '\n';

    int** pp = &p;        // pointer to pointer
    **pp = 8;
    std::cout << y << ' ' << sizeof(p) << '\n';   // every data pointer is 8 bytes on 64-bit
}
```

```text filename:Output
20 20 1
7
8 8
```

| Expression | Meaning |
| --- | --- |
| `int* p;` | Declare `p` as pointer to `int` (uninitialised — dangerous) |
| `int* p = nullptr;` | Null pointer — points to nothing |
| `&x` | Address of `x` |
| `*p` | The object `p` points to (dereference) |
| `p->m` | Member `m` of the pointed-to object = `(*p).m` |
| `p + n` | Address `n` <em>elements</em> further (scaled by `sizeof(T)`) |
| `p[i]` | `*(p + i)` |

# Pointer arithmetic &amp; arrays

```cpp filename:C%2B%2B
#include <iostream>
int main() {
    int arr[5] = {10, 20, 30, 40, 50};
    int* p = arr;                 // array decays to a pointer to its first element
    std::cout << *(p + 2) << ' ' << p[3] << '\n';
    int* end = arr + 5;           // one-past-the-end: may be compared, never dereferenced
    for (int* it = arr; it != end; ++it) std::cout << *it / 10;
    std::cout << '\n' << (end - p) << '\n';   // difference = number of elements (ptrdiff_t)
}
```

```text filename:Output
30 40
12345
5
```

# `nullptr` vs `NULL` vs `0`

```cpp filename:C%2B%2B
#include <iostream>
void f(int)   { std::cout << "f(int)\n"; }
void f(int*)  { std::cout << "f(int*)\n"; }
int main() {
    f(0);          // 0 is an int → f(int)
    f(nullptr);    // nullptr has its own type → f(int*)
    int* p = nullptr;
    if (!p) std::cout << "null\n";
}
```

```text filename:Output
f(int)
f(int*)
null
```

> [!NOTE] Key point
>
> Always use `nullptr` (C++11). `NULL` is a macro for `0` (or `0L`) and picks integer overloads.

# Pointer dangers

> [!NOTE] Null dereference
>
> `*p` when `p == nullptr` — crash (undefined behaviour). Check before use.

> [!NOTE] Dangling pointer
>
> Points to an object that was destroyed (freed heap memory, a local that went out of scope).

> [!NOTE] Wild pointer
>
> Never initialised — holds garbage. Always initialise pointers.

> [!NOTE] Out of bounds
>
> Arithmetic past the array — reads/writes someone else's memory.

```cpp filename:C%2B%2B%20%E2%80%94%20dangling%20pointer%20(ASan%20catches%20it)
#include <iostream>
int main() {
    int* p = nullptr;
    {
        int local = 5;
        p = &local;
    }                         // local destroyed here — p now dangles
    std::cout << *p << '\n';  // AddressSanitizer: stack-use-after-scope
}
```

# `const` and pointers

| Declaration | Can change `*p`? | Can change `p`? |
| --- | --- | --- |
| `int* p` | Yes | Yes |
| `const int* p` (= `int const* p`) | No | Yes |
| `int* const p` | Yes | No |
| `const int* const p` | No | No |

```question
What's the difference between a pointer and a reference?

---

A pointer is an object holding an address: it can be null, re-pointed, and has its own address; you dereference it explicitly. A reference is an <em>alias</em> for an existing object: it must be initialised, can't be null or re-seated, and is used with ordinary syntax. Prefer references for parameters; use pointers when “no object” or re-pointing is needed.
```

```question
What is the size of a pointer?

---

It depends on the platform, not the pointee: 8 bytes on 64-bit systems, 4 on 32-bit. `sizeof(char*) == sizeof(double*)`. (Pointers to members can be larger.)
```
