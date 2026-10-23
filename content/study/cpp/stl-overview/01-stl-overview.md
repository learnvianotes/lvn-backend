---
id: c893e061-e7f1-7ff5-b72b-1ab33d954085
key: topic:cpp/stl-overview
subject: cpp
topic: stl-overview
title: STL Overview
slug: stl-overview
order: 1
---

The Standard Template Library is three ideas that plug together: <strong>containers</strong> hold data, <strong>iterators</strong> walk it, <strong>algorithms</strong> process it — all generic, all zero-overhead.

Container → Iterators `begin()`/`end()` → Algorithm

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <list>
#include <vector>

int main() {
    std::vector<int> v{4, 1, 3};
    std::list<int> l{4, 1, 3};
    // The same algorithm works on any container through iterators:
    std::cout << *std::max_element(v.begin(), v.end()) << ' '
              << *std::max_element(l.begin(), l.end()) << '\n';
    std::cout << std::count(v.begin(), v.end(), 3) << '\n';
}
```

```text filename:Output
4 4
1
```

# Container families

| Family | Containers | Organised by |
| --- | --- | --- |
| <strong>Sequence</strong> | `vector`, `deque`, `list`, `forward_list`, `array` | Position (the order you insert) |
| <strong>Ordered associative</strong> | `set`, `multiset`, `map`, `multimap` | Sorted keys (red-black tree) |
| <strong>Unordered associative</strong> | `unordered_set/_multiset`, `unordered_map/_multimap` | Hash of the key |
| <strong>Adaptors</strong> | `stack`, `queue`, `priority_queue` | A restricted interface over another container |
| <strong>Views</strong> (non-owning) | `string_view`, `span`, ranges views | Refer to someone else's data |

# Complexity cheat sheet

| Container | Access | Search | Insert/erase at end | Insert/erase in middle / front |
| --- | --- | --- | --- | --- |
| `vector` | O(1) random | O(n) | O(1) amortised | O(n) |
| `deque` | O(1) random | O(n) | O(1) | O(1) at front, O(n) middle |
| `list` | O(n) | O(n) | O(1) | O(1) given an iterator |
| `set` / `map` | — | O(log n) | O(log n) | O(log n) |
| `unordered_set` / `unordered_map` | — | O(1) avg, O(n) worst | O(1) avg | O(1) avg |
| `priority_queue` | O(1) top | — | push/pop O(log n) | — |

# Choosing a container

1. <strong>Default</strong>

   `std::vector` — contiguous, cache-friendly, fastest for most workloads, even with some middle inserts.

2. <strong>Need lookup by key?</strong>

   `std::unordered_map`/`unordered_set` for speed; `std::map`/`set` when you need sorted order or range queries (`lower_bound`).

3. <strong>Push/pop at both ends?</strong>

   `std::deque`.

4. <strong>LIFO / FIFO / “always give me the max”?</strong>

   `std::stack` / `std::queue` / `std::priority_queue`.

5. <strong>Many inserts/erases in the middle with stable iterators?</strong>

   `std::list` — rarely the right answer in practice.

```question
Why is std::vector usually faster than std::list even for insertions?

---

A vector's elements are contiguous, so iterating and shifting elements is sequential memory access that the CPU cache and prefetcher love. A list node is a separate heap allocation; finding the insertion point means chasing pointers with a cache miss per node, which usually costs more than the O(n) shift in a vector for realistic sizes.
```
