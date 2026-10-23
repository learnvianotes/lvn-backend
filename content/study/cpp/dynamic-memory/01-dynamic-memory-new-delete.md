---
id: 0710436c-d30d-7327-b0f4-977866ea8902
key: topic:cpp/dynamic-memory
subject: cpp
topic: dynamic-memory
title: "Dynamic Memory: new & delete"
slug: dynamic-memory-new-delete
order: 1
---

`new` allocates an object on the heap and constructs it; `delete` destroys it and frees the memory. Every `new` needs exactly one matching `delete` — which is why modern C++ hides both inside smart pointers and containers.

# Syntax

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

int main() {
    int* n = new int(42);                  // one int
    std::string* s = new std::string("heap");
    int* arr = new int[4]{1, 2, 3, 4};     // array

    std::cout << *n << ' ' << *s << ' ' << s->size() << ' ' << arr[3] << '\n';

    delete n;          // single object → delete
    delete s;
    delete[] arr;      // array → delete[]
    n = nullptr;       // avoid a dangling pointer
}
```

```text filename:Output
42 heap 4 4
```

|  | `malloc` / `free` (C) | `new` / `delete` (C++) |
| --- | --- | --- |
| Constructs/destroys objects | No — raw bytes | Yes — calls constructor / destructor |
| Returns | `void*` (needs a cast in C++) | Typed `T*` |
| On failure | Returns `NULL` | Throws `std::bad_alloc` (or `nullptr` with `new (std::nothrow)`) |
| Size | You compute bytes | Computed from the type |
| Can be overloaded | No | Yes (`operator new`) |

# The classic bugs

> [!NOTE] Memory leak
>
> Forgetting `delete` (or an early `return`/exception skipping it). Memory is never reclaimed.

> [!NOTE] Double delete
>
> Deleting the same pointer twice — heap corruption.

> [!NOTE] Use after free
>
> Using memory after `delete` — a dangling pointer.

> [!NOTE] Mismatched forms
>
> `new[]` with `delete` (or `new` with `delete[]`) — undefined behaviour.

```cpp filename:C%2B%2B%20%E2%80%94%20use%20after%20free
#include <iostream>
int main() {
    int* p = new int(7);
    delete p;
    std::cout << *p << '\n';   // AddressSanitizer: heap-use-after-free
}
```

```cpp filename:C%2B%2B%20%E2%80%94%20mismatched%20delete
int main() {
    int* arr = new int[10];
    delete arr;                // clang -Wall rejects it; at run time ASan reports alloc-dealloc-mismatch
}
```

# Leaks via exceptions — and the fix

```cpp filename:C%2B%2B
#include <iostream>
#include <memory>
#include <stdexcept>
#include <vector>

void risky(bool fail) {
    // int* buf = new int[100];  ... delete[] buf;  ← leaks if anything in between throws
    auto buf = std::make_unique<int[]>(100);   // freed automatically, even on exceptions
    std::vector<int> better(100);              // or simply use a container
    buf[0] = better[0] = 1;
    if (fail) throw std::runtime_error("boom");
}

int main() {
    try { risky(true); } catch (const std::exception& e) { std::cout << "caught " << e.what() << ", no leak\n"; }
}
```

```text filename:Output
caught boom, no leak
```

> [!TIP] Do
>
> Use `std::vector`, `std::string`, `std::make_unique`, `std::make_shared` — they own memory and free it in their destructors (RAII).

> [!DANGER] Avoid
>
> Writing `new`/`delete` in application code. If you see a raw `delete`, ask who else might delete or use that pointer.

# 2-D dynamic arrays

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
int main() {
    int rows = 3, cols = 4;
    std::vector<std::vector<int>> grid(rows, std::vector<int>(cols, 0));   // no new/delete needed
    grid[2][3] = 9;
    std::vector<int> flat(rows * cols);                                  // one block: faster
    flat[2 * cols + 3] = 9;                                              // row-major index
    std::cout << grid[2][3] << ' ' << flat[11] << '\n';
}
```

```text filename:Output
9 9
```

```question
What's the difference between delete and delete\[\]?

---

`delete p` destroys one object; `delete[] p` destroys every element of an array allocated with `new T[n]` (the runtime stores the count) and frees the block. Mixing them is undefined behaviour.
```

```question
What happens if new fails?

---

Plain `new` throws `std::bad_alloc`; it never returns null. `new (std::nothrow) T` returns `nullptr` instead. Checking `if (p == nullptr)` after plain `new` is dead code.
```
