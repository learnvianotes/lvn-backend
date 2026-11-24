---
id: a0bab116-9537-73aa-8418-3408daa5ca51
key: topic:cpp/algorithms-basics
subject: cpp
topic: algorithms-basics
title: Searching & Counting Algorithms
slug: searching-counting-algorithms
order: 1
---

`<algorithm>` has \~100 well-tested, optimised functions that work on iterator ranges. Knowing the common ones replaces most hand-written loops.

# Find &amp; count

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<int> v{4, 8, 15, 16, 23, 42};

    auto it = std::find(v.begin(), v.end(), 15);
    std::cout << "15 at index " << (it - v.begin()) << '\n';
    if (std::find(v.begin(), v.end(), 99) == v.end()) std::cout << "99 not found\n";

    auto odd = std::find_if(v.begin(), v.end(), [](int x) { return x % 2 == 1; });
    std::cout << "first odd " << *odd << '\n';

    std::cout << std::count(v.begin(), v.end(), 42) << ' '
              << std::count_if(v.begin(), v.end(), [](int x) { return x > 10; }) << '\n';

    std::string s = "mississippi";
    std::cout << std::count(s.begin(), s.end(), 's') << '\n';
}
```

```text filename:Output
15 at index 2
99 not found
first odd 15
1 4
4
```

# Predicates over a range

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
int main() {
    std::vector<int> v{2, 4, 6, 7};
    auto even = [](int x) { return x % 2 == 0; };
    std::cout << std::all_of(v.begin(), v.end(), even)
              << std::any_of(v.begin(), v.end(), even)
              << std::none_of(v.begin(), v.end(), [](int x) { return x < 0; }) << '\n';

    auto [mn, mx] = std::minmax_element(v.begin(), v.end());
    std::cout << *mn << ' ' << *mx << ' ' << *std::max_element(v.begin(), v.end()) << '\n';
    std::cout << std::max({3, 9, 1}) << ' ' << std::min(5, 2) << ' ' << std::clamp(15, 0, 10) << '\n';

    std::vector<int> w{2, 4, 6, 8};
    std::cout << std::equal(v.begin(), v.begin() + 3, w.begin()) << '\n';     // first 3 equal?
    auto mm = std::mismatch(v.begin(), v.end(), w.begin());
    std::cout << *mm.first << " vs " << *mm.second << '\n';
}
```

```text filename:Output
011
2 7 7
9 2 10
1
7 vs 8
```

# Searching for sequences

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
int main() {
    std::vector<int> data{1, 2, 3, 1, 2, 3, 4};
    std::vector<int> pat{2, 3, 4};
    auto it = std::search(data.begin(), data.end(), pat.begin(), pat.end());
    std::cout << "pattern at " << (it - data.begin()) << '\n';
    auto adj = std::adjacent_find(data.begin(), data.end(), [](int a, int b) { return b < a; });
    std::cout << "first descent at " << (adj - data.begin()) << '\n';
}
```

```text filename:Output
pattern at 4
first descent at 2
```

| Algorithm | Returns | Complexity |
| --- | --- | --- |
| `find`, `find_if`, `find_if_not` | Iterator to first match or `last` | O(n) |
| `count`, `count_if` | Number of matches | O(n) |
| `all_of`, `any_of`, `none_of` | `bool` | O(n), short-circuits |
| `min_element`, `max_element`, `minmax_element` | Iterator(s) | O(n) |
| `equal`, `mismatch` | `bool` / pair of iterators | O(n) |
| `search`, `find_end`, `adjacent_find` | Iterator | O(n·m) / O(n) |
| `binary_search`, `lower_bound`, … | On <strong>sorted</strong> ranges | O(log n) |

```question
Why prefer std algorithms over raw loops?

---

They name the intent (`any_of` says more than a loop with a flag), they're correct and well-tested (no off-by-one), they're optimised (and some have parallel versions), and they compose with iterators and ranges. Sean Parent's advice: “no raw loops”.
```
