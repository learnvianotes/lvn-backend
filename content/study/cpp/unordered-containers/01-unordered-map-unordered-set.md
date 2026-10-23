---
id: bfd817c1-cf74-7f92-83d6-888ce0939f19
key: topic:cpp/unordered-containers
subject: cpp
topic: unordered-containers
title: unordered_map & unordered_set
slug: unordered-map-unordered-set
order: 1
---

Hash tables: average O(1) insert, erase and lookup, no ordering. The workhorse for frequency counts, “seen before?” checks and caches.

# Usage

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

int main() {
    std::vector<int> nums{2, 7, 11, 15};
    int target = 18;
    std::unordered_map<int, int> seen;              // value → index
    for (int i = 0; i < static_cast<int>(nums.size()); ++i) {
        if (auto it = seen.find(target - nums[i]); it != seen.end())
            std::cout << "two-sum: " << it->second << ',' << i << '\n';
        seen[nums[i]] = i;
    }

    std::unordered_set<std::string> visited;
    for (std::string city : {"paris", "rome", "paris"})
        if (!visited.insert(city).second) std::cout << "repeat: " << city << '\n';
    std::cout << visited.size() << ' ' << visited.contains("rome") << '\n';
}
```

```text filename:Output
two-sum: 1,2
repeat: paris
2 1
```

> [!WARNING] Watch out
>
> Iteration order of unordered containers is unspecified and can change after a rehash or between library versions. Never print or depend on it — copy into a `std::vector` and sort if you need a stable order.

# Buckets, load factor, rehashing

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_map>
int main() {
    std::unordered_map<int, int> m;
    m.reserve(1000);                              // pre-size buckets: avoids rehashing while filling
    for (int i = 0; i < 1000; ++i) m[i] = i * i;
    std::cout << m.size() << ' ' << (m.bucket_count() >= 1000) << ' ' << (m.load_factor() <= m.max_load_factor()) << '\n';
    std::cout << m.max_load_factor() << '\n';     // default 1.0: rehash when size > buckets
}
```

```text filename:Output
1000 1 1
1
```

# Hashing your own type

```cpp filename:C%2B%2B
#include <cstddef>
#include <functional>
#include <iostream>
#include <unordered_set>

struct Point {
    int x, y;
    bool operator==(const Point&) const = default;          // needed for collisions
};

struct PointHash {
    std::size_t operator()(const Point& p) const noexcept {
        std::size_t h1 = std::hash<int>{}(p.x), h2 = std::hash<int>{}(p.y);
        return h1 ^ (h2 + 0x9e3779b9 + (h1 << 6) + (h1 >> 2));   // hash_combine
    }
};

int main() {
    std::unordered_set<Point, PointHash> cells{{0, 0}, {1, 2}, {0, 0}};
    std::cout << cells.size() << ' ' << cells.count({1, 2}) << '\n';
}
```

```text filename:Output
2 1
```

|  | `unordered_map` | `map` |
| --- | --- | --- |
| Structure | Hash table (buckets of nodes) | Red-black tree |
| Lookup | O(1) avg, O(n) worst | O(log n) always |
| Order | None | Sorted by key |
| Key needs | `std::hash<K>` + `==` | `<` |
| Memory | Higher (buckets) | 3 pointers + colour per node |

> [!WARNING] Watch out
>
> In competitive programming, adversarial inputs can force many collisions in `std::unordered_map<int, …>` (the default `std::hash<int>` is the identity), turning O(1) into O(n). Use a randomised custom hash, or `std::map`.

```question
How does an unordered\_map handle collisions?

---

The standard containers use <em>separate chaining</em>: each bucket holds a linked list of the nodes whose hash maps there. When the load factor (size / bucket count) exceeds `max_load_factor` (default 1.0), the table allocates more buckets and rehashes every element.
```
