---
id: 5cfc0c50-a9bc-71b2-a49e-6dc80f3f47c4
key: topic:cpp/vector
subject: cpp
topic: vector
title: std::vector
slug: std-vector
order: 1
---

A dynamic array: contiguous storage that grows automatically. The container you should reach for first.

# Core operations

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v;                      // empty
    std::vector<int> zeros(5);               // 5 × 0
    std::vector<int> sevens(3, 7);           // 3 × 7
    std::vector<int> list{1, 2, 3};          // initializer list

    v.push_back(10);                         // append
    v.emplace_back(20);                      // construct in place
    v.insert(v.begin(), 5);                  // insert at front: O(n)
    std::cout << v.size() << ' ' << v.front() << ' ' << v.back() << ' ' << v[1] << '\n';

    v.pop_back();                            // remove last
    v.erase(v.begin());                      // remove first: O(n)
    std::cout << v.size() << ' ' << v[0] << '\n';

    list.resize(5);                          // grow with zeros
    std::cout << list[4] << ' ' << zeros.size() << ' ' << sevens[2] << '\n';
    list.clear();
    std::cout << list.empty() << '\n';
}
```

```text filename:Output
3 5 20 10
1 10
0 5 7
1
```

# Size vs capacity

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
int main() {
    std::vector<int> v;
    std::size_t lastCap = 0;
    for (int i = 0; i < 100; ++i) {
        v.push_back(i);
        if (v.capacity() != lastCap) { lastCap = v.capacity(); std::cout << lastCap << ' '; }
    }
    std::cout << '\n';
    std::vector<int> r;
    r.reserve(100);                    // one allocation up front
    std::cout << r.size() << ' ' << r.capacity() << '\n';
    v.resize(10);
    v.shrink_to_fit();                 // non-binding request to release spare capacity
    std::cout << v.size() << ' ' << v.capacity() << '\n';
}
```

```text filename:Output
1 2 4 8 16 32 64 128
0 100
10 10
```

> [!NOTE] Growth
>
> When full, `push_back` allocates a bigger buffer (libc++ and libstdc++ double it; MSVC grows by 1.5×), moves the elements over and frees the old one. Each element is moved O(1) times on average → <strong>amortised O(1)</strong> append. If you know the final size, `reserve` it.

# Iterator invalidation

| Operation | Invalidates |
| --- | --- |
| `push_back` / `emplace_back` / `insert` causing reallocation | <strong>All</strong> iterators, pointers, references |
| `insert` without reallocation | Those at or after the insertion point |
| `erase` | Those at or after the erased element |
| `reserve`, `shrink_to_fit` | All, if the capacity changes |

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
int main() {
    std::vector<int> v{1, 2, 3, 4, 5, 6};
    for (auto it = v.begin(); it != v.end(); ) {     // erase while iterating: use the returned iterator
        if (*it % 2 == 0) it = v.erase(it);
        else ++it;
    }
    for (int x : v) std::cout << x;
    std::cout << '\n';
    std::erase_if(v, [](int x) { return x > 3; });   // C++20 one-liner
    for (int x : v) std::cout << x;
    std::cout << '\n';
}
```

```text filename:Output
135
13
```

# 2-D vectors &amp; useful members

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
int main() {
    std::vector<std::vector<int>> grid(3, std::vector<int>(4, 0));   // 3 rows × 4 cols
    grid[1][2] = 5;
    std::cout << grid.size() << 'x' << grid[0].size() << ' ' << grid[1][2] << '\n';

    std::vector<int> a{1, 2, 3}, b{1, 2, 4};
    std::cout << (a < b) << (a == b) << '\n';        // lexicographic comparison
    a.swap(b);                                       // O(1)
    a.assign(2, 9);                                  // replace contents
    int* raw = a.data();                             // pointer to the contiguous buffer
    std::cout << a.size() << ' ' << raw[1] << ' ' << b.back() << '\n';
}
```

```text filename:Output
3x4 5
10
2 9 3
```

> [!WARNING] Watch out
>
> `v[i]` doesn't check bounds (out-of-range is UB); `v.at(i)` throws `std::out_of_range`. And `std::vector<bool>` is a space-optimised bit-packed specialisation: `&v[0]` isn't a `bool*` and its elements aren't real references.

```question
What happens when you push\_back into a full vector?

---

It allocates a larger block (typically 2× or 1.5× the capacity), move-constructs (or copies, if the move constructor isn't `noexcept`) the existing elements into it, constructs the new element, destroys the old elements and frees the old block. All iterators, pointers and references into the vector are invalidated.
```

```question
What's the difference between reserve and resize?

---

`reserve(n)` only changes <em>capacity</em> — it allocates room for `n` elements without creating any; `size()` is unchanged. `resize(n)` changes <em>size</em>: it creates value-initialised elements (or destroys extras), so `v[n-1]` becomes valid.
```
