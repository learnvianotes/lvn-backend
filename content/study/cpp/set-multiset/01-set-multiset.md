---
id: 73839719-1c7d-7a28-8362-6ac99d65d97a
key: topic:cpp/set-multiset
subject: cpp
topic: set-multiset
title: set & multiset
slug: set-multiset
order: 1
---

`std::set` keeps unique keys in sorted order (a balanced binary search tree); `std::multiset` allows duplicates. Everything is O(log n).

# `std::set`

```cpp filename:C%2B%2B
#include <iostream>
#include <set>

int main() {
    std::set<int> s{5, 1, 4, 1, 3};              // duplicates dropped, sorted
    for (int x : s) std::cout << x << ' ';
    std::cout << '\n';

    auto [it, inserted] = s.insert(4);            // already there
    std::cout << inserted << ' ' << *it << '\n';
    std::cout << s.count(3) << s.contains(9) << '\n';   // contains: C++20
    s.erase(1);
    std::cout << *s.begin() << ' ' << *s.rbegin() << ' ' << s.size() << '\n';   // min, max

    std::cout << *s.lower_bound(4) << ' ' << *s.upper_bound(4) << '\n';   // first >= 4, first > 4
}
```

```text filename:Output
1 3 4 5
0 4
10
3 5 3
4 5
```

# Custom order

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <set>
#include <string>

struct ByLength {
    bool operator()(const std::string& a, const std::string& b) const {
        return a.size() != b.size() ? a.size() < b.size() : a < b;   // tie-break so distinct words stay distinct
    }
};

int main() {
    std::set<int, std::greater<int>> desc{3, 1, 2};
    for (int x : desc) std::cout << x;
    std::cout << '\n';
    std::set<std::string, ByLength> words{"banana", "fig", "apple", "kiwi", "pear"};
    for (const auto& w : words) std::cout << w << ' ';
    std::cout << '\n';
}
```

```text filename:Output
321
fig kiwi pear apple banana
```

> [!WARNING] Watch out
>
> Set elements are `const` — you can't modify a key in place (it would break the ordering). Erase and re-insert, or use C++17 `extract` to modify a node's key without reallocating.

# `std::multiset`

```cpp filename:C%2B%2B
#include <iostream>
#include <set>
int main() {
    std::multiset<int> ms{3, 1, 3, 2, 3};
    std::cout << ms.count(3) << ' ' << ms.size() << '\n';
    ms.erase(ms.find(3));           // erase ONE copy
    std::cout << ms.count(3) << '\n';
    ms.erase(3);                    // erase ALL copies
    for (int x : ms) std::cout << x;
    std::cout << '\n';
}
```

```text filename:Output
3 5
2
12
```

> [!NOTE] DSA use
>
> A `multiset` works as a <em>sliding-window sorted bag</em>: insert/erase in O(log n) and read the min/max from `begin()`/`rbegin()` — handy for “median / max of the last k elements” problems.

```question
How is std::set implemented and what are its complexities?

---

As a self-balancing binary search tree (a red-black tree in all major implementations). Insert, erase and find are O(log n); iteration visits keys in sorted order; `lower_bound`/`upper_bound` answer “first key ≥ / &gt; x” in O(log n).
```
