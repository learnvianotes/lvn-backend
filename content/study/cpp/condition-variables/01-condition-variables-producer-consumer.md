---
id: 16b935f3-18bd-7deb-9808-e7cf6c446914
key: topic:cpp/condition-variables
subject: cpp
topic: condition-variables
title: Condition Variables & Producer–Consumer
slug: condition-variables-producer-consumer
order: 1
---

A `std::condition_variable` lets a thread sleep until another thread says “something changed”. Combined with a mutex and a queue it gives the classic producer–consumer pattern.

# A thread-safe queue

```cpp filename:C%2B%2B
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <optional>
#include <queue>
#include <thread>

template <typename T>
class BlockingQueue {
    std::queue<T> q_;
    std::mutex m_;
    std::condition_variable cv_;
    bool closed_ = false;
public:
    void push(T v) {
        { std::lock_guard lock(m_); q_.push(std::move(v)); }
        cv_.notify_one();                                     // wake one waiting consumer
    }
    void close() {
        { std::lock_guard lock(m_); closed_ = true; }
        cv_.notify_all();
    }
    std::optional<T> pop() {
        std::unique_lock lock(m_);
        cv_.wait(lock, [&] { return !q_.empty() || closed_; });   // predicate guards spurious wake-ups
        if (q_.empty()) return std::nullopt;                   // closed and drained
        T v = std::move(q_.front());
        q_.pop();
        return v;
    }
};

int main() {
    BlockingQueue<int> jobs;
    long long total = 0;
    int handled = 0;
    {
        std::jthread consumer([&] {
            while (auto job = jobs.pop()) { total += *job; ++handled; }
        });
        std::jthread producer([&] {
            for (int i = 1; i <= 100; ++i) jobs.push(i);
            jobs.close();
        });
    }
    std::cout << handled << " jobs, total " << total << '\n';
}
```

```text filename:Output
100 jobs, total 5050
```

1. <strong>Lock</strong>

   The waiter takes a `std::unique_lock` on the mutex that protects the shared state.

2. <strong>Wait with a predicate</strong>

   `cv.wait(lock, pred)` checks `pred`; if false it <em>atomically</em> unlocks and sleeps, then relocks when woken and re-checks.

3. <strong>Modify, then notify</strong>

   The producer changes the state <strong>under the mutex</strong>, releases it, and calls `notify_one()` / `notify_all()`.

> [!WARNING] Watch out
>
> Always wait with a predicate (or in a `while` loop). Condition variables can wake up <em>spuriously</em>, and a notification sent before the waiter started waiting is lost — the predicate covers both cases.

```question
Why does condition\_variable::wait need a unique\_lock rather than a lock\_guard?

---

`wait` must unlock the mutex while sleeping and relock it before returning. `lock_guard` can't be unlocked and relocked; `unique_lock` can.
```
