---
id: f0f49008-2bf3-7d02-906f-894af66a9909
key: topic:cpp/deque-list
subject: cpp
topic: deque-list
title: deque, list & forward_list
slug: deque-list-forward-list
order: 1
---

`std::deque` is a double-ended queue with O(1) push/pop at both ends and random access; `std::list` is a doubly linked list with O(1) splicing anywhere.

# `std::deque`

```cpp filename:C%2B%2B
#include <deque>
#include <iostream>
int main() {
    std::deque<int> d{3, 4};
    d.push_front(2);
    d.push_front(1);
    d.push_back(5);
    std::cout << d.front() << ' ' << d.back() << ' ' << d[2] << ' ' << d.size() << '\n';
    d.pop_front();
    d.pop_back();
    for (int x : d) std::cout << x;
    std::cout << '\n';
}
```

```text filename:Output
1 5 3 5
234
```

Internally a deque is an array of fixed-size blocks, so growing at either end never moves existing elements (references stay valid on push at the ends) — but elements aren't contiguous overall.

# `std::list`

```cpp filename:C%2B%2B
#include <iostream>
#include <iterator>
#include <list>

int main() {
    std::list<int> l{5, 1, 4, 1, 3};
    auto it = std::next(l.begin(), 2);     // no random access: walk there
    l.insert(it, 99);                      // O(1) once you have the iterator
    l.remove(1);                           // remove all 1s
    l.sort();                              // member sort (std::sort needs random access)
    for (int x : l) std::cout << x << ' ';
    std::cout << '\n';

    std::list<int> other{7, 8};
    l.splice(l.begin(), other);            // move nodes from other in O(1) — no copies
    l.unique();                            // drop consecutive duplicates
    l.reverse();
    for (int x : l) std::cout << x << ' ';
    std::cout << "| other size " << other.size() << '\n';
}
```

```text filename:Output
3 4 5 99
99 5 4 3 8 7 | other size 0
```

# `std::forward_list`

```cpp filename:C%2B%2B
#include <forward_list>
#include <iostream>
int main() {
    std::forward_list<int> fl{2, 3};       // singly linked: one pointer per node, no size()
    fl.push_front(1);
    fl.insert_after(fl.begin(), 10);       // only insert *after* a position
    for (int x : fl) std::cout << x << ' ';
    std::cout << '\n';
}
```

```text filename:Output
1 10 2 3
```

|  | `vector` | `deque` | `list` |
| --- | --- | --- | --- |
| Random access `[i]` | O(1) | O(1) | — |
| push/pop front | O(n) | <strong>O(1)</strong> | O(1) |
| Insert in middle | O(n) | O(n) | <strong>O(1)</strong> with iterator |
| Contiguous memory | Yes | No (chunks) | No (nodes) |
| Iterators stay valid on insert | No (reallocation) | No (but refs do at ends) | <strong>Yes</strong> |
| Memory overhead | Low | Medium | 2 pointers per element |

```question
When would you actually use std::list?

---

When you need iterators/references to stay valid while inserting and erasing elsewhere, or you splice elements between lists in O(1) — e.g. an LRU cache (list + hash map of iterators). For plain sequences, `vector` wins on speed and memory.
```
