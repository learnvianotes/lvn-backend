---
id: a2cb09e0-000d-78f0-bde5-4d640bafbc42
key: topic:cpp/arrays-span
subject: cpp
topic: arrays-span
title: Arrays, std::array & std::span
slug: arrays-std-array-std-span
order: 1
---

C arrays are fixed-size blocks that decay to pointers. `std::array` is the same thing with value semantics and a size; `std::span` is a non-owning view over any contiguous sequence.

# C-style arrays

```cpp filename:C%2B%2B
#include <iostream>
#include <iterator>

int main() {
    int a[5] = {1, 2, 3};                 // remaining elements are zero-initialised
    int b[] = {4, 5, 6};                  // size deduced: 3
    int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};

    std::cout << a[3] << ' ' << std::size(b) << ' ' << sizeof(a) / sizeof(a[0]) << '\n';
    std::cout << grid[1][2] << '\n';
    for (int x : b) std::cout << x;       // range-for works: the size is part of the type
    std::cout << '\n';
}
```

```text filename:Output
0 3 5
6
456
```

> [!WARNING] Watch out
>
> An array passed to a function <strong>decays</strong> to a pointer — `sizeof` inside the function gives the pointer size, and bounds are never checked. Arrays can't be copied or assigned with `=` either.

# `std::array<T, N>`

```cpp filename:C%2B%2B
#include <algorithm>
#include <array>
#include <iostream>

std::array<int, 3> doubled(std::array<int, 3> arr) {   // passed & returned by value — just works
    for (int& x : arr) x *= 2;
    return arr;
}

int main() {
    std::array<int, 5> a{5, 3, 9, 1, 7};
    std::sort(a.begin(), a.end());
    std::cout << a.size() << ' ' << a.front() << ' ' << a.back() << '\n';

    auto copy = a;                 // arrays are copyable
    copy[0] = 100;
    std::cout << a[0] << ' ' << (a == copy) << '\n';

    auto d = doubled({1, 2, 3});
    std::cout << d[2] << '\n';

    try {
        std::cout << a.at(10) << '\n';      // bounds-checked access
    } catch (const std::out_of_range& e) {
        std::cout << "out_of_range\n";
    }
}
```

```text filename:Output
5 1 9
1 0
6
out_of_range
```

|  | C array `T[N]` | `std::array<T,N>` | `std::vector<T>` |
| --- | --- | --- | --- |
| Size | Fixed, compile time | Fixed, compile time | Dynamic |
| Storage | Inline (stack/static) | Inline (stack/static) | Heap |
| Knows its size | Only in scope of declaration | `.size()` | `.size()` |
| Copy / compare with `=` `==` | No | Yes | Yes |
| Decays to pointer | Yes | No (`.data()` if needed) | No |
| Bounds check | Never | `.at()` | `.at()` |

# `std::span` (C++20)

A `span<T>` is a pointer + length — a cheap <em>view</em>. Write one function that accepts a C array, `std::array` or `std::vector`:

```cpp filename:C%2B%2B
#include <array>
#include <iostream>
#include <span>
#include <vector>

int sum(std::span<const int> xs) {
    int s = 0;
    for (int x : xs) s += x;
    return s;
}

int main() {
    int raw[] = {1, 2, 3};
    std::array<int, 2> arr{10, 20};
    std::vector<int> vec{100, 200, 300, 400};
    std::cout << sum(raw) << ' ' << sum(arr) << ' ' << sum(vec) << '\n';
    std::span<int> part(vec.data() + 1, 2);        // a sub-range
    part[0] = 0;                                    // writes through to vec
    std::cout << sum(part) << ' ' << vec[1] << ' ' << sum(std::span(vec).first(2)) << '\n';
}
```

```text filename:Output
6 30 1000
300 0 100
```

> [!WARNING] Watch out
>
> Like any view, a `span` doesn't own memory — it dangles if the vector reallocates or is destroyed.

```question
Why can't you get the size of an array inside a function that receives it?

---

Because `void f(int arr[])` is really `void f(int* arr)` — the array decayed to a pointer and the length isn't part of a pointer. Pass the size separately, take `std::array<int, N>&`, a template `T (&arr)[N]`, or a `std::span`.
```
