---
id: 7456fbd3-7327-7ffd-9f06-47719126d09d
key: topic:cpp/threads
subject: cpp
topic: threads
title: "Threads: std::thread & std::jthread"
slug: threads-std-thread-std-jthread
order: 1
---

A `std::thread` runs a callable concurrently with the rest of the program. You must `join()` (wait for) or `detach()` it before it's destroyed; C++20's `std::jthread` joins automatically.

# Starting and joining

```cpp filename:C%2B%2B
#include <iostream>
#include <thread>
#include <vector>

void partialSum(const std::vector<int>& data, std::size_t from, std::size_t to, long long& out) {
    long long s = 0;
    for (std::size_t i = from; i < to; ++i) s += data[i];
    out = s;                                          // each thread writes its own slot: no race
}

int main() {
    std::vector<int> data(1'000'000, 1);
    long long left = 0, right = 0;
    std::size_t mid = data.size() / 2;

    std::thread t1(partialSum, std::cref(data), 0, mid, std::ref(left));   // args are COPIED unless wrapped
    std::thread t2([&] { partialSum(data, mid, data.size(), right); });    // or capture in a lambda
    t1.join();                                        // wait for both to finish
    t2.join();
    std::cout << left + right << '\n';
    std::cout << (std::thread::hardware_concurrency() > 0) << '\n';        // number of cores (hint)
}
```

```text filename:Output
1000000
1
```

> [!WARNING] Watch out
>
> If a joinable `std::thread` is destroyed (goes out of scope without `join()` or `detach()`), the program calls `std::terminate`. An exception thrown between creating and joining causes exactly this — which is why `std::jthread` exists.

# `std::jthread` (C++20)

```cpp filename:C%2B%2B
#include <chrono>
#include <iostream>
#include <thread>

int main() {
    int ticks = 0;
    {
        std::jthread worker([&ticks](std::stop_token st) {   // receives a stop token
            while (!st.stop_requested()) {
                ++ticks;
                std::this_thread::sleep_for(std::chrono::milliseconds(1));
            }
        });
        std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }   // ~jthread: request_stop() then join() — automatic
    std::cout << "worker stopped after " << (ticks > 0 ? "some" : "no") << " ticks\n";
}
```

```text filename:Output
worker stopped after some ticks
```

# Thread basics

| API | Meaning |
| --- | --- |
| `std::thread t(f, args...)` | Start `f(args...)` on a new thread (arguments copied/moved into it) |
| `t.join()` | Block until `t` finishes |
| `t.detach()` | Let it run independently (you can no longer join it — rarely a good idea) |
| `t.joinable()` | Still represents a running/unjoined thread? |
| `std::this_thread::sleep_for(d)` / `yield()` / `get_id()` | Helpers for the current thread |
| `std::ref(x)` / `std::cref(x)` | Pass by reference into a thread |
| `thread_local int x;` | One separate variable per thread |

# Output order is not deterministic

```cpp filename:C%2B%2B
#include <iostream>
#include <thread>
#include <vector>

int main() {
    std::vector<std::jthread> workers;
    for (int id = 0; id < 3; ++id)
        workers.emplace_back([id] { std::cout << "worker " << id << " running\n"; });
}   // lines may appear in any order — or even interleaved mid-line
```

```question
What's the difference between a process and a thread?

---

A process has its own address space; threads within a process share memory (globals, heap) but each has its own stack and registers. Threads are cheaper to create and communicate through shared memory — which is exactly why they need synchronisation.
```

```question
What happens if you forget to join a std::thread?

---

When the `std::thread` object is destroyed while still joinable, its destructor calls `std::terminate()`, aborting the program. Use `std::jthread` (joins in its destructor) or an RAII guard.
```
