---
id: 6f7cbd1d-ca38-73f3-abda-6f3944e2172b
key: topic:cpp/ranges
subject: cpp
topic: ranges
title: Ranges & Views (C++20)
slug: ranges-views-c-20
order: 1
---

C++20 ranges let you pass a whole container to an algorithm (`std::ranges::sort(v)`) and build lazy pipelines with views: `v | views::filter(...) | views::transform(...)`.

# Range algorithms

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Person { std::string name; int age; };

int main() {
    std::vector<int> v{5, 3, 9, 1};
    std::ranges::sort(v);                                   // no begin()/end() noise
    std::cout << v.front() << ' ' << std::ranges::max(v) << ' ' << std::ranges::count(v, 3) << '\n';

    std::vector<Person> people{{"cy", 30}, {"al", 25}, {"bo", 35}};
    std::ranges::sort(people, {}, &Person::age);            // projection: sort by a member
    for (const auto& p : people) std::cout << p.name << ' ';
    std::cout << '\n';
    auto it = std::ranges::find(people, "bo", &Person::name);
    std::cout << it->age << '\n';
}
```

```text filename:Output
1 9 1
al cy bo
35
```

# Views: lazy pipelines

```cpp filename:C%2B%2B
#include <iostream>
#include <ranges>
#include <vector>

int main() {
    namespace views = std::views;
    std::vector<int> v{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    auto evenSquares = v | views::filter([](int x) { return x % 2 == 0; })
                         | views::transform([](int x) { return x * x; });
    for (int x : evenSquares) std::cout << x << ' ';           // computed on the fly, no temp vector
    std::cout << '\n';

    for (int x : views::iota(1) | views::take(5)) std::cout << x;      // infinite range, first 5
    std::cout << '\n';
    for (int x : v | views::reverse | views::drop(7)) std::cout << x;
    std::cout << '\n';
    for (int x : v | views::take_while([](int x) { return x < 4; })) std::cout << x;
    std::cout << '\n';
}
```

```text filename:Output
4 16 36 64 100
12345
321
123
```

| View | Produces |
| --- | --- |
| `views::filter(pred)` | Elements satisfying `pred` |
| `views::transform(f)` | `f(x)` for each element |
| `views::take(n)` / `views::drop(n)` | First n / all but first n |
| `views::take_while(p)` / `views::drop_while(p)` | Prefix while `p` holds / the rest |
| `views::reverse` | Reverse order |
| `views::iota(a, b)` | `a, a+1, …, b-1` (unbounded without `b`) |
| `views::keys` / `views::values` / `views::elements<N>` | Parts of pairs/tuples |
| `views::split(delim)`, `views::join` | Split / flatten |
| `views::enumerate`, `views::zip`, `views::chunk` | C++23 |

# Views over maps, strings &amp; collecting results

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <ranges>
#include <string>
#include <string_view>
#include <vector>

int main() {
    std::map<std::string, int> stock{{"apple", 0}, {"kiwi", 4}, {"pear", 2}};
    for (const auto& name : stock | std::views::filter([](const auto& kv) { return kv.second > 0; })
                                  | std::views::keys)
        std::cout << name << ' ';
    std::cout << '\n';

    std::string_view csv = "red,green,blue";
    for (auto part : csv | std::views::split(','))
        std::cout << '[' << std::string_view(part.begin(), part.end()) << ']';
    std::cout << '\n';

    auto sq = std::views::iota(1, 6) | std::views::transform([](int x) { return x * x; });
    std::vector<int> out(sq.begin(), sq.end());          // materialise (C++23: std::ranges::to<std::vector>())
    std::cout << out.size() << ' ' << out.back() << '\n';
}
```

```text filename:Output
kiwi pear
[red][green][blue]
5 25
```

> [!WARNING] Watch out
>
> Views don't own data. A view over a temporary container (`auto v = getVector() | views::filter(f);`) or one kept after its container changed will dangle. Some views (`filter`) also cache their `begin()` — don't modify the elements through them in a way that changes the predicate.

```question
What is the difference between a range algorithm and a view?

---

A range algorithm (`std::ranges::sort(v)`) is eager — it does its work immediately, like classic algorithms but taking a whole range and supporting projections. A view (`views::filter`) is lazy — a lightweight, non-owning adaptor that computes elements only when iterated, so pipelines don't create intermediate containers.
```
