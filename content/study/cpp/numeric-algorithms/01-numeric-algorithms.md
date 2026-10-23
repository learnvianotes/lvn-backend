---
id: 79276c71-b3f8-7fc1-adbc-22723a9a149c
key: topic:cpp/numeric-algorithms
subject: cpp
topic: numeric-algorithms
title: Numeric Algorithms
slug: numeric-algorithms
order: 1
---

`<numeric>` covers folds and scans: sums, products, prefix sums, dot products, sequences, `gcd`/`lcm`.

# Folds

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <numeric>
#include <string>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3, 4, 5};
    std::cout << std::accumulate(v.begin(), v.end(), 0) << '\n';                        // sum
    std::cout << std::accumulate(v.begin(), v.end(), 1LL, std::multiplies<>()) << '\n'; // product
    std::cout << std::reduce(v.begin(), v.end()) << '\n';                              // like accumulate, may reorder

    std::vector<std::string> words{"a", "b", "c"};
    std::string joined = std::accumulate(std::next(words.begin()), words.end(), words[0],
                                         [](std::string acc, const std::string& w) { return acc + "-" + w; });
    std::cout << joined << '\n';

    std::vector<int> a{1, 2, 3}, b{4, 5, 6};
    std::cout << std::inner_product(a.begin(), a.end(), b.begin(), 0) << '\n';          // dot product
}
```

```text filename:Output
15
120
15
a-b-c
32
```

> [!WARNING] Watch out
>
> The <em>type of the initial value</em> decides the accumulator type. `std::accumulate(v.begin(), v.end(), 0)` on `double`s truncates every partial sum to `int`; on big `int`s it overflows. Pass `0.0` or `0LL`.

```cpp filename:C%2B%2B
#include <iostream>
#include <numeric>
#include <vector>
int main() {
    std::vector<double> prices{1.5, 2.5, 3.5};
    std::cout << std::accumulate(prices.begin(), prices.end(), 0) << ' '       // int accumulator!
              << std::accumulate(prices.begin(), prices.end(), 0.0) << '\n';
}
```

```text filename:Output
6 7.5
```

# Scans &amp; sequences

```cpp filename:C%2B%2B
#include <iostream>
#include <numeric>
#include <vector>

int main() {
    std::vector<int> v{3, 1, 4, 1, 5};
    std::vector<int> prefix(v.size());
    std::partial_sum(v.begin(), v.end(), prefix.begin());               // running total
    for (int x : prefix) std::cout << x << ' ';
    std::cout << "| sum[1..3] = " << prefix[3] - prefix[0] << '\n';     // range sum in O(1)

    std::vector<int> diff(v.size());
    std::adjacent_difference(v.begin(), v.end(), diff.begin());
    for (int x : diff) std::cout << x << ' ';
    std::cout << '\n';

    std::vector<int> ids(5);
    std::iota(ids.begin(), ids.end(), 10);                              // 10 11 12 13 14
    std::cout << ids.back() << ' ' << std::gcd(84, 36) << ' ' << std::lcm(4, 6) << '\n';

    std::vector<int> ex(v.size());
    std::exclusive_scan(v.begin(), v.end(), ex.begin(), 0);             // sums *before* each element
    for (int x : ex) std::cout << x << ' ';
    std::cout << '\n';
}
```

```text filename:Output
3 4 8 9 14 | sum[1..3] = 6
3 -2 3 -3 4
14 12 12
0 3 4 8 9
```

| Algorithm | Computes |
| --- | --- |
| `accumulate(f, l, init, op)` | Left fold, in order |
| `reduce(f, l, init, op)` | Fold in any order (parallelisable; `op` must be associative &amp; commutative) |
| `inner_product` / `transform_reduce` | Σ aᵢ·bᵢ (or custom ops) |
| `partial_sum` / `inclusive_scan` | Prefix sums including the current element |
| `exclusive_scan` | Prefix sums excluding it |
| `adjacent_difference` | `out[i] = in[i] - in[i-1]` |
| `iota(f, l, start)` | Fill with `start, start+1, …` |
| `gcd`, `lcm` | C++17 |

```question
How do prefix sums answer range-sum queries in O(1)?

---

Precompute `pre[i] = a[0] + … + a[i-1]` (size n+1, `pre[0] = 0`) once in O(n). Then the sum of `a[l..r]` is `pre[r+1] - pre[l]` — one subtraction per query.
```
