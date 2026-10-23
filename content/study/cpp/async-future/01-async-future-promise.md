---
id: afeaef49-3b75-7742-8386-b3006bfa6d4f
key: topic:cpp/async-future
subject: cpp
topic: async-future
title: async, future & promise
slug: async-future-promise
order: 1
---

`std::async` runs a function (possibly on another thread) and hands back a `std::future` — a handle to a result that will be available later. Exceptions travel through the future too.

# `std::async` &amp; `std::future`

```cpp filename:C%2B%2B
#include <future>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <vector>

long long sumRange(const std::vector<int>& v, std::size_t from, std::size_t to) {
    return std::accumulate(v.begin() + from, v.begin() + to, 0LL);
}

int main() {
    std::vector<int> v(10'000);
    std::iota(v.begin(), v.end(), 1);

    auto half = v.size() / 2;
    std::future<long long> first = std::async(std::launch::async, sumRange, std::cref(v), 0, half);
    long long second = sumRange(v, half, v.size());            // meanwhile, work on this thread
    std::cout << first.get() + second << '\n';                 // get() waits, then returns the value

    auto failing = std::async(std::launch::async, [] () -> int { throw std::runtime_error("task failed"); });
    try { failing.get(); }                                     // the exception is rethrown here
    catch (const std::exception& e) { std::cout << "caught: " << e.what() << '\n'; }
}
```

```text filename:Output
50005000
caught: task failed
```

| Launch policy | Behaviour |
| --- | --- |
| `std::launch::async` | Runs on a new thread immediately |
| `std::launch::deferred` | Runs lazily on the thread that calls `get()`/`wait()` |
| default (`async &#124; deferred`) | Implementation chooses — pass `std::launch::async` if you need real concurrency |

> [!WARNING] Watch out
>
> The future returned by `std::async` <strong>blocks in its destructor</strong> until the task finishes. `std::async(f);` without keeping the future therefore runs synchronously — a common surprise.

# `std::promise` — setting a future by hand

```cpp filename:C%2B%2B
#include <future>
#include <iostream>
#include <string>
#include <thread>

int main() {
    std::promise<std::string> promise;
    std::future<std::string> result = promise.get_future();

    std::jthread worker([p = std::move(promise)]() mutable {
        p.set_value("downloaded 42 KB");                  // fulfils the future (once)
    });

    std::cout << result.get() << '\n';
}
```

```text filename:Output
downloaded 42 KB
```

# `std::packaged_task`

```cpp filename:C%2B%2B
#include <future>
#include <iostream>
#include <thread>

int main() {
    std::packaged_task<int(int, int)> task([](int a, int b) { return a * b; });   // wraps a callable
    std::future<int> f = task.get_future();
    std::jthread t(std::move(task), 6, 7);                // run it anywhere — e.g. a thread pool
    std::cout << f.get() << '\n';
}
```

```text filename:Output
42
```

| Tool | Who produces the value | Use for |
| --- | --- | --- |
| `std::async` | The library runs your function | Fire off a computation, collect the result |
| `std::packaged_task` | Whoever invokes the task | Task queues / thread pools |
| `std::promise` | Your code calls `set_value`/`set_exception` | Results produced by callbacks or events |
| `std::shared_future` | — | Several threads waiting on the same result |

```question
What's the difference between std::thread and std::async?

---

`std::thread` just runs a function; getting a result or an exception back requires your own shared state and synchronisation. `std::async` returns a `std::future` that delivers the return value — or rethrows the exception — when you call `get()`, and with the default policy may not even create a thread.
```
