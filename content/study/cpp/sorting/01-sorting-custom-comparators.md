---
id: c39f1202-1b8d-7ddf-9be1-9eb48c588a05
key: topic:cpp/sorting
subject: cpp
topic: sorting
title: Sorting & Custom Comparators
slug: sorting-custom-comparators
order: 1
---

`std::sort` is an introsort: O(n log n) worst case, not stable. Its relatives handle stability, partial results and selection.

# `std::sort` and comparators

```cpp filename:C%2B%2B
#include <algorithm>
#include <functional>
#include <iostream>
#include <string>
#include <vector>

struct Employee { std::string name; int dept; int salary; };

int main() {
    std::vector<int> v{5, 2, 9, 1, 5, 6};
    std::sort(v.begin(), v.end());                         // ascending
    std::sort(v.begin(), v.end(), std::greater<>());       // descending
    for (int x : v) std::cout << x;
    std::cout << '\n';

    std::vector<std::string> words{"kiwi", "fig", "banana", "apple"};
    std::sort(words.begin(), words.end(), [](const auto& a, const auto& b) {
        return a.size() < b.size();                        // by length
    });
    for (const auto& w : words) std::cout << w << ' ';
    std::cout << '\n';

    std::vector<Employee> staff{{"ann", 2, 70}, {"bob", 1, 50}, {"cat", 2, 90}, {"dan", 1, 60}};
    std::sort(staff.begin(), staff.end(), [](const Employee& a, const Employee& b) {
        if (a.dept != b.dept) return a.dept < b.dept;      // dept ascending
        return a.salary > b.salary;                        // then salary descending
    });
    for (const auto& e : staff) std::cout << e.name << ' ';
    std::cout << '\n';
}
```

```text filename:Output
965521
fig kiwi apple banana
dan bob cat ann
```

> [!WARNING] Watch out
>
> A comparator must be a <strong>strict weak ordering</strong>: `comp(a, a)` must be `false`. Using `<=` instead of `<` breaks that and can make `std::sort` read out of bounds or crash.

# Stable, partial, nth

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

int main() {
    std::vector<std::pair<int, std::string>> v{{2, "b1"}, {1, "a"}, {2, "b2"}, {1, "c"}};
    std::stable_sort(v.begin(), v.end(), [](const auto& x, const auto& y) { return x.first < y.first; });
    for (const auto& [k, s] : v) std::cout << s << ' ';      // equal keys keep original order
    std::cout << '\n';

    std::vector<int> scores{50, 90, 20, 70, 85, 60};
    std::partial_sort(scores.begin(), scores.begin() + 3, scores.end(), std::greater<>());
    std::cout << scores[0] << ' ' << scores[1] << ' ' << scores[2] << '\n';     // top 3, sorted

    std::vector<int> m{7, 1, 5, 3, 9};
    std::nth_element(m.begin(), m.begin() + 2, m.end());    // median in O(n) average
    std::cout << "median " << m[2] << '\n';

    std::vector<int> p{1, 2, 3, 4, 5, 6};
    auto mid = std::partition(p.begin(), p.end(), [](int x) { return x % 2 == 0; });
    std::cout << (mid - p.begin()) << " evens first\n";
    std::cout << std::is_sorted(p.begin(), p.end()) << '\n';
}
```

```text filename:Output
a c b1 b2
90 85 70
median 5
3 evens first
0
```

| Algorithm | Result | Complexity | Stable |
| --- | --- | --- | --- |
| `sort` | Fully sorted | O(n log n) | No |
| `stable_sort` | Fully sorted, equal elements keep order | O(n log n) (O(n log² n) without extra memory) | Yes |
| `partial_sort(first, mid, last)` | Smallest `mid-first` elements sorted at the front | O(n log k) | No |
| `nth_element` | Element at <em>n</em> is what it would be if sorted; smaller before, larger after | O(n) avg | No |
| `partition` / `stable_partition` | Predicate-true elements first | O(n) | No / Yes |
| `list::sort()` | For `std::list` (no random access) | O(n log n) | Yes |

# Sort indices, not objects

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>
int main() {
    std::vector<int> height{170, 155, 182, 160};
    std::vector<int> idx(height.size());
    std::iota(idx.begin(), idx.end(), 0);                       // 0 1 2 3
    std::sort(idx.begin(), idx.end(), [&](int a, int b) { return height[a] < height[b]; });
    for (int i : idx) std::cout << i << ' ';                    // argsort
    std::cout << '\n';
}
```

```text filename:Output
1 3 0 2
```

```question
What algorithm does std::sort use?

---

<em>Introsort</em>: quicksort with median-of-three pivots, switching to heapsort if the recursion gets too deep (guaranteeing O(n log n) worst case) and to insertion sort for small partitions. It's not stable; use `std::stable_sort` (a merge sort) when the order of equal elements matters.
```
