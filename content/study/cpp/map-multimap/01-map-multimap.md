---
id: 2de923d1-844c-7179-a42a-d40fdd309796
key: topic:cpp/map-multimap
subject: cpp
topic: map-multimap
title: map & multimap
slug: map-multimap
order: 1
---

`std::map<K, V>` stores key → value pairs sorted by key, with unique keys and O(log n) operations. `std::multimap` allows repeated keys.

# Core operations

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<std::string, int> stock{{"apple", 5}, {"pear", 2}};
    stock["kiwi"] = 7;                          // insert or overwrite
    stock["apple"] += 1;
    stock.insert({"pear", 100});                // no effect: key exists
    stock.emplace("fig", 3);

    for (const auto& [fruit, qty] : stock) std::cout << fruit << '=' << qty << ' ';   // sorted by key
    std::cout << '\n';

    if (auto it = stock.find("kiwi"); it != stock.end()) std::cout << "kiwi: " << it->second << '\n';
    std::cout << stock.count("mango") << ' ' << stock.contains("fig") << '\n';
    stock.erase("pear");
    std::cout << stock.size() << ' ' << stock.at("fig") << '\n';
}
```

```text filename:Output
apple=6 fig=3 kiwi=7 pear=2
kiwi: 7
0 1
3 3
```

# The `operator[]` trap

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <string>
int main() {
    std::map<std::string, int> ages{{"ada", 36}};
    if (ages["bob"] == 0) std::cout << "bob not found?\n";   // [] INSERTS "bob" with 0!
    std::cout << ages.size() << '\n';
    // const std::map<...>& cref = ages; cref["x"];          // error: no const operator[]
    try { std::cout << ages.at("cy"); } catch (const std::out_of_range&) { std::cout << "at() throws\n"; }
}
```

```text filename:Output
bob not found?
2
at() throws
```

| Access | Missing key | Use for |
| --- | --- | --- |
| `m[key]` | Inserts a default-constructed value | Counting, building up (`freq[word]++`) |
| `m.at(key)` | Throws `std::out_of_range` | Must exist |
| `m.find(key)` | Returns `m.end()` | Lookup without side effects |
| `m.contains(key)` (C++20) / `m.count(key)` | `false` / `0` | Existence check |
| `m.insert_or_assign(k, v)` / `m.try_emplace(k, args…)` | Inserts | Explicit upsert / insert-if-absent |

# Word frequency &amp; range queries

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <sstream>
#include <string>

int main() {
    std::istringstream text("the cat and the hat and the bat");
    std::map<std::string, int> freq;
    std::string w;
    while (text >> w) ++freq[w];
    for (const auto& [word, n] : freq) std::cout << word << ':' << n << ' ';
    std::cout << '\n';

    std::map<int, std::string> events{{900, "standup"}, {1200, "lunch"}, {1500, "review"}, {1800, "gym"}};
    for (auto it = events.lower_bound(1000); it != events.upper_bound(1600); ++it)   // keys in [1000, 1600]
        std::cout << it->first << ' ' << it->second << '\n';
}
```

```text filename:Output
and:2 bat:1 cat:1 hat:1 the:3
1200 lunch
1500 review
```

# `std::multimap`

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <string>
int main() {
    std::multimap<std::string, std::string> phone{{"ada", "111"}, {"bob", "222"}, {"ada", "333"}};
    auto [first, last] = phone.equal_range("ada");     // all entries with key "ada"
    for (auto it = first; it != last; ++it) std::cout << it->second << ' ';
    std::cout << phone.count("ada") << '\n';
}
```

```text filename:Output
111 333 2
```

```question
map vs unordered\_map?

---

`map` is a balanced BST: O(log n) operations, keys iterated in sorted order, supports `lower_bound`/range queries, needs `<`. `unordered_map` is a hash table: O(1) average (O(n) worst) operations, no ordering, needs `std::hash` and `==`. Use `unordered_map` for pure lookup speed, `map` when order or ranges matter or worst-case guarantees are needed.
```
