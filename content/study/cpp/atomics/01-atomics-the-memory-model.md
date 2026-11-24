---
id: fbfd468c-b262-7d1b-9cab-0d9de0d548f6
key: topic:cpp/atomics
subject: cpp
topic: atomics
title: Atomics & the Memory Model
slug: atomics-the-memory-model
order: 1
---

`std::atomic<T>` makes individual reads, writes and read-modify-write operations indivisible — lock-free synchronisation for counters, flags and pointers.

# Atomic counter

```cpp filename:C%2B%2B
#include <atomic>
#include <iostream>
#include <thread>
#include <vector>

int main() {
    std::atomic<int> hits{0};
    {
        std::vector<std::jthread> ts;
        for (int t = 0; t < 8; ++t)
            ts.emplace_back([&] { for (int i = 0; i < 10'000; ++i) hits.fetch_add(1); });   // or ++hits
    }
    std::cout << hits.load() << ' ' << hits.is_lock_free() << '\n';

    std::atomic<int> value{5};
    int expected = 5;
    bool swapped = value.compare_exchange_strong(expected, 10);   // CAS: if value == 5, set 10
    std::cout << swapped << ' ' << value << '\n';
    expected = 5;
    swapped = value.compare_exchange_strong(expected, 20);         // fails; expected becomes 10
    std::cout << swapped << ' ' << expected << '\n';
    std::cout << value.exchange(0) << ' ' << value << '\n';
}
```

```text filename:Output
80000 1
1 10
0 10
10 0
```

| Operation | Meaning |
| --- | --- |
| `load()` / `store(v)` | Atomic read / write |
| `fetch_add`, `fetch_sub`, `++`, `--`, `+=` | Atomic read-modify-write; return old (fetch\_) or new value |
| `exchange(v)` | Set and return the old value |
| `compare_exchange_strong/weak(expected, desired)` | CAS — the building block of lock-free algorithms |
| `std::atomic_flag` | Guaranteed lock-free boolean (spin locks) |

# Publishing data with a flag

```cpp filename:C%2B%2B
#include <atomic>
#include <iostream>
#include <string>
#include <thread>

int main() {
    std::string payload;
    std::atomic<bool> ready{false};
    std::jthread producer([&] {
        payload = "config loaded";                        // 1. write the data
        ready.store(true, std::memory_order_release);     // 2. publish
    });
    while (!ready.load(std::memory_order_acquire)) {}      // 3. wait (spin) for the flag
    std::cout << payload << '\n';                          // 4. guaranteed to see the write
}
```

```text filename:Output
config loaded
```

The default ordering, `memory_order_seq_cst`, is the easiest to reason about. `release`/`acquire` pairs are cheaper on some CPUs: everything written before the release-store is visible after the matching acquire-load. `relaxed` guarantees atomicity only — fine for statistics counters.

|  | `std::mutex` | `std::atomic` |
| --- | --- | --- |
| Protects | Any block of code / several variables | One variable |
| Blocking | Yes (threads sleep) | No (lock-free for built-in sizes) |
| Best for | Invariants spanning multiple fields | Counters, flags, single pointers |

> [!WARNING] Watch out
>
> `volatile` is <strong>not</strong> for threads in C++ — it prevents some compiler optimisations for memory-mapped I/O but provides no atomicity or ordering. Use `std::atomic`.

```question
Is ++x on a std::atomic&lt;int&gt; thread-safe? What about x = x + 1?

---

`++x` is a single atomic read-modify-write (`fetch_add`), so yes. `x = x + 1` is an atomic <em>load</em> followed by a separate atomic <em>store</em> — another thread can update `x` in between, so increments can be lost.
```
