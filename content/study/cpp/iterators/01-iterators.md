---
id: be0f1edd-4ecb-7045-9734-3cbb977fdae1
key: topic:cpp/iterators
subject: cpp
topic: iterators
title: Iterators
slug: iterators
order: 1
---

An iterator is a generalised pointer: it points to an element, `*it` reads it, `++it` moves on. Iterators are the glue that lets any algorithm run on any container.

# Basics

```cpp filename:C%2B%2B
#include <iostream>
#include <iterator>
#include <vector>

int main() {
    std::vector<int> v{10, 20, 30, 40};
    for (auto it = v.begin(); it != v.end(); ++it) std::cout << *it << ' ';   // [begin, end)
    std::cout << '\n';
    for (auto it = v.rbegin(); it != v.rend(); ++it) std::cout << *it << ' '; // reverse
    std::cout << '\n';

    auto it = v.begin() + 2;                    // random access
    std::cout << *it << ' ' << it[1] << ' ' << (it - v.begin()) << '\n';
    std::cout << *std::next(v.begin()) << ' ' << *std::prev(v.end()) << ' ' << std::distance(v.begin(), v.end()) << '\n';

    for (auto cit = v.cbegin(); cit != v.cend(); ++cit) { /* *cit = 0; would not compile */ }
}
```

```text filename:Output
10 20 30 40
40 30 20 10
30 40 2
20 40 4
```

> [!NOTE] Half-open ranges
>
> `end()` points <strong>one past</strong> the last element — it marks the end and must never be dereferenced. An empty container has `begin() == end()`.

# Iterator categories

| Category | Supports | Example containers |
| --- | --- | --- |
| Input / Output | Single pass: `++`, `*` (read or write) | `istream_iterator` / `ostream_iterator`, `back_inserter` |
| Forward | Multi-pass `++` | `forward_list`, `unordered_*` |
| Bidirectional | + `--` | `list`, `set`, `map` |
| Random access | + `it + n`, `it[n]`, `<`, `it2 - it1` | `deque` |
| Contiguous (C++20) | + elements adjacent in memory | `vector`, `array`, `string`, raw arrays |

Algorithms state what they need: `std::sort` requires random access (so `std::list` has its own `sort()`), `std::reverse` needs bidirectional, `std::find` just input.

# Iterator adaptors

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <iterator>
#include <sstream>
#include <vector>

int main() {
    std::istringstream in("5 3 8 1");
    std::vector<int> v(std::istream_iterator<int>{in}, std::istream_iterator<int>{});   // read all ints

    std::vector<int> evens;
    std::copy_if(v.begin(), v.end(), std::back_inserter(evens), [](int x) { return x % 2 == 0; });

    std::copy(v.begin(), v.end(), std::ostream_iterator<int>(std::cout, ","));   // print with separator
    std::cout << " evens=" << evens.size() << '\n';
}
```

```text filename:Output
5,3,8,1, evens=1
```

# Making your own class iterable

```cpp filename:C%2B%2B
#include <iostream>

class Range {                                   // like Python's range(lo, hi)
    int lo_, hi_;
public:
    Range(int lo, int hi) : lo_(lo), hi_(hi) {}
    struct iterator {
        int cur;
        int operator*() const { return cur; }
        iterator& operator++() { ++cur; return *this; }
        bool operator==(const iterator&) const = default;
    };
    iterator begin() const { return {lo_}; }
    iterator end() const { return {hi_}; }
};

int main() {
    for (int i : Range(3, 7)) std::cout << i << ' ';
    std::cout << '\n';
}
```

```text filename:Output
3 4 5 6
```

> [!WARNING] Watch out
>
> An iterator is only valid while its container isn't restructured: e.g. a `vector` reallocation or erasing the element it points to invalidates it. Using an invalidated iterator is undefined behaviour.

```question
Why does the STL use half-open ranges \[begin, end)?

---

An empty range is simply `begin == end`, the length is `end - begin`, loops are `while (it != end)`, and ranges split cleanly: `[a, m)` and `[m, b)` share no element and miss none. It also allows `end()` for containers where a “last element” pointer would be awkward.
```
