---
id: dd71261c-2cbc-7895-bb14-289f5e7697e0
key: topic:cpp/competitive-programming
subject: cpp
topic: competitive-programming
title: Competitive Programming & Fast I/O
slug: competitive-programming-fast-i-o
order: 1
---

C++ dominates contests because of speed and the STL. A few habits — fast I/O, `long long`, the right container — prevent most wrong answers and time-limit errors.

# The template

```cpp filename:C%2B%2B%20%E2%80%94%20contest%20template%20(GCC)
#include <bits/stdc++.h>          // GCC-only “everything” header; clang/MSVC: include what you use
using namespace std;
using ll = long long;

int main() {
    ios::sync_with_stdio(false);   // don't sync C++ streams with C stdio
    cin.tie(nullptr);              // don't flush cout before every cin

    int t;
    cin >> t;
    while (t--) {
        int n;
        cin >> n;
        vector<ll> a(n);
        for (auto& x : a) cin >> x;
        ll best = *max_element(a.begin(), a.end());
        ll sum = accumulate(a.begin(), a.end(), 0LL);
        cout << best << ' ' << sum << '\n';     // '\n', never endl in hot loops
    }
}
```

```cpp filename:C%2B%2B%20%E2%80%94%20the%20same%2C%20portable
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>
using namespace std;
using ll = long long;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t;
    cin >> t;
    while (t--) {
        int n;
        cin >> n;
        vector<ll> a(n);
        for (auto& x : a) cin >> x;
        cout << *max_element(a.begin(), a.end()) << ' ' << accumulate(a.begin(), a.end(), 0LL) << '\n';
    }
}
```

```text filename:Output
5 8
1000000000 2000000000
```

> [!NOTE] Portability
>
> `<bits/stdc++.h>` exists only in GCC's libstdc++ (the usual contest compiler); it doesn't exist with clang/libc++ on macOS. Include the real headers when you're not on a judge.

# Habits that save you

| Trap | Fix |
| --- | --- |
| `int` overflow (sums, products &gt; 2·10⁹) | `long long` (`ll`) everywhere sums live; `1LL * a * b` |
| Slow I/O with 10⁶ numbers | `sync_with_stdio(false)` + `cin.tie(nullptr)`, `'\n'` instead of `endl` |
| `unordered_map` hacked with collisions | Custom hash with a random seed, or `map` |
| Recursion depth 10⁵–10⁶ | Iterative DFS with an explicit stack |
| Large local arrays → stack overflow | Global arrays or `vector` |
| Comparing doubles | Use an epsilon, or stay in integers |
| `v.size() - 1` when empty | Cast: `(int)v.size() - 1` |
| Modular arithmetic | `(a % M + M) % M` for negatives; multiply in `long long` |

# Handy snippets

```cpp filename:C%2B%2B
#include <algorithm>
#include <bit>
#include <iostream>
#include <numeric>
#include <vector>
using ll = long long;
constexpr ll MOD = 1'000'000'007;

ll power(ll base, ll exp, ll mod) {                  // fast modular exponentiation
    ll result = 1;
    base %= mod;
    while (exp > 0) {
        if (exp & 1) result = result * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return result;
}

std::vector<int> sieve(int n) {                      // primes up to n
    std::vector<bool> composite(n + 1);
    std::vector<int> primes;
    for (int i = 2; i <= n; ++i) {
        if (composite[i]) continue;
        primes.push_back(i);
        for (ll j = 1LL * i * i; j <= n; j += i) composite[j] = true;
    }
    return primes;
}

struct DSU {                                         // union–find
    std::vector<int> parent, size;
    explicit DSU(int n) : parent(n), size(n, 1) { std::iota(parent.begin(), parent.end(), 0); }
    int find(int x) { return parent[x] == x ? x : parent[x] = find(parent[x]); }
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a; size[a] += size[b];
        return true;
    }
};

int main() {
    std::cout << power(2, 1'000'000, MOD) << '\n';
    auto p = sieve(30);
    std::cout << p.size() << ' ' << p.back() << '\n';
    DSU d(5);
    d.unite(0, 1); d.unite(3, 4); d.unite(1, 4);
    std::cout << (d.find(0) == d.find(3)) << (d.find(2) == d.find(0)) << '\n';
    std::cout << __builtin_popcount(13) << ' ' << __builtin_ctz(8) << ' '
              << std::popcount(13u) << ' ' << std::bit_width(1000u) - 1 << '\n';   // portable <bit> versions
}
```

```text filename:Output
235042059
10 29
10
3 3 3 9
```

> [!NOTE] Key point
>
> GCC/Clang builtins: `__builtin_popcount(x)` (set bits), `__builtin_ctz(x)` (trailing zeros), `__builtin_clz(x)` (leading zeros); libstdc++ also has `std::__lg(x)` (floor log2). Portable C++20 equivalents live in `<bit>`: `std::popcount`, `std::countr_zero`, `std::bit_width(x) - 1`.

# Operations per second

| n | Feasible complexity (≈10⁸ simple ops/s) |
| --- | --- |
| ≤ 10–12 | O(n!) |
| ≤ 20–25 | O(2ⁿ) |
| ≤ 500 | O(n³) |
| ≤ 5 000 | O(n²) |
| ≤ 10⁶ | O(n log n) |
| ≤ 10⁸ | O(n) |
| &gt; 10⁹ | O(log n) or O(1) — math |

```question
What do ios::sync\_with\_stdio(false) and cin.tie(nullptr) do?

---

The first stops C++ streams from synchronising with C's `stdio` buffers after every operation, letting `cin`/`cout` buffer independently (after it, don't mix `scanf`/`printf` with `cin`/`cout`). The second unties `cin` from `cout`, so `cout` isn't flushed before every read. Together they make stream I/O about as fast as `scanf`/`printf`.
```
