---
id: 6f2e0a45-5457-76d0-8ffe-9201a06d225e
key: topic:cpp/mutex-locks
subject: cpp
topic: mutex-locks
title: Mutexes, Locks & Deadlock
slug: mutexes-locks-deadlock
order: 1
---

A <strong>data race</strong> — two threads touching the same memory, at least one writing, without synchronisation — is undefined behaviour. A mutex makes a critical section run in one thread at a time.

# A race, and the fix

```cpp filename:C%2B%2B
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>

int main() {
    long long counter = 0;
    std::mutex m;
    {
        std::vector<std::jthread> threads;
        for (int t = 0; t < 4; ++t)
            threads.emplace_back([&] {
                for (int i = 0; i < 100'000; ++i) {
                    std::lock_guard<std::mutex> lock(m);   // locks now, unlocks at end of scope
                    ++counter;                             // without the lock: lost updates
                }
            });
    }
    std::cout << counter << '\n';
}
```

```text filename:Output
400000
```

> [!NOTE] Why the lock
>
> `++counter` is read-modify-write: two threads can both read 5 and both write 6. Without the mutex the result is typically less than 400000 — and formally the program has undefined behaviour.

# Lock types

| RAII lock | Use |
| --- | --- |
| `std::lock_guard<M>` | Simplest: lock for the whole scope |
| `std::unique_lock<M>` | Can unlock/relock, defer, time out, be moved; required by condition variables |
| `std::scoped_lock<M1, M2…>` (C++17) | Lock several mutexes at once <em>without deadlock</em> |
| `std::shared_lock<std::shared_mutex>` | Many readers or one writer |

# Deadlock

Thread A locks `m1` then waits for `m2`; thread B locks `m2` then waits for `m1` — both wait forever. Prevent it by always acquiring locks in the same global order, or by locking them together with `std::scoped_lock`.

```cpp filename:C%2B%2B
#include <iostream>
#include <mutex>
#include <thread>

struct Account {
    int balance;
    std::mutex m;
};

void transfer(Account& from, Account& to, int amount) {
    std::scoped_lock lock(from.m, to.m);       // deadlock-free, whatever order callers use
    from.balance -= amount;
    to.balance += amount;
}

int main() {
    Account a{1000, {}}, b{1000, {}};
    {
        std::jthread t1([&] { for (int i = 0; i < 1000; ++i) transfer(a, b, 1); });
        std::jthread t2([&] { for (int i = 0; i < 1000; ++i) transfer(b, a, 2); });
    }
    std::cout << a.balance << ' ' << b.balance << ' ' << a.balance + b.balance << '\n';
}
```

```text filename:Output
2000 0 2000
```

# Readers–writer lock

```cpp filename:C%2B%2B
#include <iostream>
#include <map>
#include <mutex>
#include <shared_mutex>
#include <string>
#include <thread>
#include <vector>

class Config {
    mutable std::shared_mutex m_;
    std::map<std::string, int> values_;
public:
    int get(const std::string& k) const {
        std::shared_lock lock(m_);             // many readers at once
        auto it = values_.find(k);
        return it == values_.end() ? 0 : it->second;
    }
    void set(const std::string& k, int v) {
        std::unique_lock lock(m_);             // exclusive writer
        values_[k] = v;
    }
};

int main() {
    Config cfg;
    cfg.set("threads", 4);
    std::vector<std::jthread> readers;
    std::vector<int> seen(4);
    for (int i = 0; i < 4; ++i) readers.emplace_back([&, i] { seen[i] = cfg.get("threads"); });
    readers.clear();                           // join all
    std::cout << seen[0] + seen[1] + seen[2] + seen[3] << '\n';
}
```

```text filename:Output
16
```

> [!TIP] Do
>
> Keep critical sections short; never call unknown code (callbacks, virtual functions) while holding a lock; use RAII locks only.

> [!DANGER] Avoid
>
> Calling `m.lock()` / `m.unlock()` by hand — an exception or early return leaves the mutex locked forever.

```question
What are the four conditions for deadlock?

---

Mutual exclusion, hold-and-wait, no preemption and circular wait (Coffman conditions). Breaking any one prevents deadlock; in practice you break <em>circular wait</em> with a consistent lock order or by acquiring all locks atomically (`std::scoped_lock`/`std::lock`).
```
