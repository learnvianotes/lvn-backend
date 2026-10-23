---
id: fe490792-4b95-7c76-9589-a46bf0bb118c
key: topic:cpp/modifying-algorithms
subject: cpp
topic: modifying-algorithms
title: Transforming & Modifying Algorithms
slug: transforming-modifying-algorithms
order: 1
---

Algorithms that write: copy, transform, fill, replace, reverse, rotate — and the remove-erase idiom, the most misunderstood algorithm pair in the STL.

# Copy, transform, fill

```cpp filename:C%2B%2B
#include <algorithm>
#include <cctype>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>

int main() {
    std::vector<int> src{1, 2, 3, 4};
    std::vector<int> dst(src.size());
    std::transform(src.begin(), src.end(), dst.begin(), [](int x) { return x * x; });

    std::vector<int> sums;
    std::transform(src.begin(), src.end(), dst.begin(), std::back_inserter(sums), std::plus<>{});   // binary

    std::vector<int> big;
    std::copy_if(dst.begin(), dst.end(), std::back_inserter(big), [](int x) { return x > 4; });

    std::string s = "Hello";
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return std::toupper(c); });

    std::vector<int> filled(4);
    std::fill(filled.begin(), filled.end(), 7);
    std::fill_n(filled.begin(), 2, 0);

    for (auto* vec : {&dst, &sums, &big, &filled}) {
        for (int x : *vec) std::cout << x << ' ';
        std::cout << "| ";
    }
    std::cout << s << '\n';
}
```

```text filename:Output
1 4 9 16 | 2 6 12 20 | 9 16 | 0 0 7 7 | HELLO
```

> [!WARNING] Watch out
>
> Output algorithms don't grow the destination. `std::copy(a.begin(), a.end(), empty.begin())` writes past the end of an empty vector — use `std::back_inserter(empty)` or size the destination first.

# The remove–erase idiom

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 0, 2, 0, 3, 0};
    auto newEnd = std::remove(v.begin(), v.end(), 0);   // shifts keepers forward; size unchanged!
    std::cout << v.size() << ' ' << (newEnd - v.begin()) << '\n';
    v.erase(newEnd, v.end());                           // actually shrink
    for (int x : v) std::cout << x;
    std::cout << '\n';

    std::vector<int> w{5, 6, 7, 8, 9};
    w.erase(std::remove_if(w.begin(), w.end(), [](int x) { return x % 2; }), w.end());
    std::erase(w, 8);                                   // C++20: both steps in one call
    for (int x : w) std::cout << x;
    std::cout << '\n';
}
```

```text filename:Output
6 3
123
6
```

> [!NOTE] Why two steps?
>
> `std::remove` can't change a container's size — it only sees iterators. It moves the elements to keep to the front and returns the new logical end; `erase` removes the leftover tail. In C++20, `std::erase` / `std::erase_if` do both.

# Reorder: reverse, rotate, unique, shuffle

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <random>
#include <vector>

void show(const std::vector<int>& v) { for (int x : v) std::cout << x; std::cout << ' '; }

int main() {
    std::vector<int> v{1, 2, 3, 4, 5};
    std::reverse(v.begin(), v.end());              show(v);
    std::rotate(v.begin(), v.begin() + 2, v.end()); show(v);   // element at +2 becomes first

    std::vector<int> d{1, 1, 2, 2, 2, 3, 1};
    d.erase(std::unique(d.begin(), d.end()), d.end());          // collapse *adjacent* duplicates
    show(d);

    std::vector<int> r{1, 2, 3};
    std::replace(r.begin(), r.end(), 2, 9);                      show(r);
    std::swap(r[0], r[2]);                                       show(r);

    std::mt19937 rng(42);
    std::vector<int> deck{1, 2, 3, 4, 5};
    std::shuffle(deck.begin(), deck.end(), rng);
    std::sort(deck.begin(), deck.end());                         show(deck);   // back in order
    std::cout << '\n';
}
```

```text filename:Output
54321 32154 1231 193 391 12345
```

# Dedupe a whole vector

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
int main() {
    std::vector<int> v{3, 1, 3, 2, 1};
    std::sort(v.begin(), v.end());                        // 1 1 2 3 3
    v.erase(std::unique(v.begin(), v.end()), v.end());    // 1 2 3
    for (int x : v) std::cout << x << ' ';
    std::cout << '\n';
}
```

```text filename:Output
1 2 3
```

```question
What does std::unique do?

---

It removes <em>consecutive</em> duplicate elements by shifting the unique ones forward and returning the new logical end (like `remove`). To dedupe an arbitrary vector, sort it first, then `erase(unique(...), end())`.
```
