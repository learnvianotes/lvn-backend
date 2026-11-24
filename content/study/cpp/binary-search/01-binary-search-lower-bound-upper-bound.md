---
id: f8ead5b8-40d3-79f3-8ea7-77cfaaeb45e5
key: topic:cpp/binary-search
subject: cpp
topic: binary-search
title: "Binary Search: lower_bound & upper_bound"
slug: binary-search-lower-bound-upper-bound
order: 1
---

On a <strong>sorted</strong> range, the STL's binary searches answer “where would x go?” in O(log n). `lower_bound` is the one to remember.

# The four functions

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 3, 3, 3, 5, 8};
    //                 0  1  2  3  4  5
    auto lb = std::lower_bound(v.begin(), v.end(), 3);   // first element >= 3
    auto ub = std::upper_bound(v.begin(), v.end(), 3);   // first element >  3
    std::cout << (lb - v.begin()) << ' ' << (ub - v.begin()) << " count=" << (ub - lb) << '\n';

    std::cout << std::binary_search(v.begin(), v.end(), 5)
              << std::binary_search(v.begin(), v.end(), 4) << '\n';

    auto [lo, hi] = std::equal_range(v.begin(), v.end(), 3);
    std::cout << (lo - v.begin()) << ' ' << (hi - v.begin()) << '\n';

    auto pos = std::lower_bound(v.begin(), v.end(), 6);   // insertion point that keeps v sorted
    v.insert(pos, 6);
    for (int x : v) std::cout << x;
    std::cout << '\n';
    std::cout << (std::lower_bound(v.begin(), v.end(), 100) == v.end()) << '\n';   // all smaller → end()
}
```

```text filename:Output
1 4 count=3
10
1 4
1333568
1
```

| Call | Returns |
| --- | --- |
| `lower_bound(x)` | First position with element <strong>≥ x</strong> |
| `upper_bound(x)` | First position with element <strong>&gt; x</strong> |
| `equal_range(x)` | `{lower_bound, upper_bound}` — all elements equal to x |
| `binary_search(x)` | `bool` only |

# Common recipes

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{2, 4, 4, 7, 9};
    int x = 5;
    // largest element < x
    auto it = std::lower_bound(v.begin(), v.end(), x);
    if (it != v.begin()) std::cout << "floor-ish " << *std::prev(it) << '\n';
    // number of elements <= 4
    std::cout << "count<=4 " << (std::upper_bound(v.begin(), v.end(), 4) - v.begin()) << '\n';

    // descending data: pass the same comparator used to sort
    std::vector<int> d{9, 7, 4, 2};
    auto p = std::lower_bound(d.begin(), d.end(), 5, std::greater<>());   // first element <= 5
    std::cout << *p << '\n';
}
```

```text filename:Output
floor-ish 4
count<=4 3
4
```

# Binary search on the answer

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>

// Minimum capacity to ship all packages within `days` days (LeetCode 1011 style).
bool canShip(const std::vector<int>& w, int days, int cap) {
    int used = 1, load = 0;
    for (int x : w) {
        if (x > cap) return false;
        if (load + x > cap) { ++used; load = 0; }
        load += x;
    }
    return used <= days;
}

int main() {
    std::vector<int> w{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    int lo = 1, hi = 55;                        // answer is in [lo, hi]
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;           // avoids overflow of (lo + hi)
        if (canShip(w, 5, mid)) hi = mid;       // feasible: try smaller
        else lo = mid + 1;
    }
    std::cout << lo << '\n';
}
```

```text filename:Output
15
```

> [!NOTE] Sets & maps
>
> For `std::set`/`std::map` use the <strong>member</strong> `s.lower_bound(x)` (O(log n)). `std::lower_bound(s.begin(), s.end(), x)` also compiles, but tree iterators aren't random access, so it's O(n).

```question
What's the difference between lower\_bound and upper\_bound?

---

`lower_bound(x)` returns the first position whose element is not less than `x` (≥ x); `upper_bound(x)` the first whose element is greater than `x`. Their difference is the number of elements equal to `x`; if `x` is absent both return the same insertion point.
```
