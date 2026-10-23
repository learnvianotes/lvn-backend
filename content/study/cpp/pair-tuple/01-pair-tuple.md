---
id: 33de68c4-ad66-7957-a78d-d2588a47d3e8
key: topic:cpp/pair-tuple
subject: cpp
topic: pair-tuple
title: pair & tuple
slug: pair-tuple
order: 1
---

`std::pair<A, B>` holds two values; `std::tuple<Ts...>` holds any number. Both compare lexicographically, which makes them handy as keys and sort criteria.

# `std::pair`

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

int main() {
    std::pair<std::string, int> p{"ada", 36};
    auto q = std::make_pair(std::string("bob"), 25);
    std::cout << p.first << ' ' << p.second << ' ' << (p < q) << '\n';

    std::vector<std::pair<int, char>> v{{2, 'b'}, {1, 'z'}, {2, 'a'}};
    std::sort(v.begin(), v.end());                  // by first, then by second
    for (const auto& [n, c] : v) std::cout << n << c << ' ';
    std::cout << '\n';
}
```

```text filename:Output
ada 36 1
1z 2a 2b
```

# `std::tuple`

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <tuple>

std::tuple<int, int, int> minMaxSum(int a, int b, int c) {
    return {std::min({a, b, c}), std::max({a, b, c}), a + b + c};
}

int main() {
    std::tuple<std::string, int, double> t{"x", 1, 2.5};
    std::cout << std::get<0>(t) << ' ' << std::get<int>(t) << ' ' << std::tuple_size_v<decltype(t)> << '\n';

    auto [lo, hi, sum] = minMaxSum(4, 9, 2);        // structured bindings
    std::cout << lo << ' ' << hi << ' ' << sum << '\n';

    int a, b;
    std::tie(a, b, std::ignore) = minMaxSum(1, 2, 3);   // unpack into existing variables
    std::cout << a << b << '\n';

    auto joined = std::tuple_cat(std::make_tuple(1, 'c'), std::make_tuple(2.5));
    std::cout << std::get<2>(joined) << '\n';
}
```

```text filename:Output
x 1 3
2 9 15
13
2.5
```

# Multi-key comparison with `std::tie`

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <tuple>
#include <vector>

struct Student { std::string name; int grade; int age; };

int main() {
    std::vector<Student> s{{"cy", 90, 20}, {"al", 85, 22}, {"bo", 90, 19}};
    std::sort(s.begin(), s.end(), [](const Student& a, const Student& b) {
        return std::tie(b.grade, a.age) < std::tie(a.grade, b.age);   // grade desc, then age asc
    });
    for (const auto& st : s) std::cout << st.name << ' ';
    std::cout << '\n';
}
```

```text filename:Output
bo cy al
```

> [!NOTE] Key point
>
> For anything with meaning, prefer a small named `struct` over `pair`/`tuple`: `result.quotient` reads better than `std::get<0>(result)`. Tuples shine in generic code and quick multi-value returns.

```question
How do pairs and tuples compare?

---

Lexicographically: compare the first elements; only if they're equal compare the second, and so on. This is why sorting a `vector<pair<int,int>>` sorts by `first` then `second`, and why `std::tie(a.x, a.y) < std::tie(b.x, b.y)` is the idiomatic multi-field comparison.
```
