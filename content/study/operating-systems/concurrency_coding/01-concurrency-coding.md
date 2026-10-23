---
id: e838a3b3-b667-72f9-84fe-b8784f7027c0
key: topic:operating-systems/concurrency_coding
subject: operating-systems
topic: concurrency_coding
title: Concurrency Coding
slug: concurrency-coding
order: 1
---

Production-grade thread-safe data structures and coordination implementations.

# 1. Print Odd and Even (Two Threads)

> [!NOTE]
>
> Classic interview question coordinating alternating execution using condition variables:
>
> `#include <iostream>`<br>`#include <thread>`<br>`#include <mutex>`<br>`#include <condition_variable>`<br><br>`std::mutex mtx;`<br>`std::condition_variable cv;`<br>`int count = 1;`<br>`const int MAX_COUNT = 10;`<br><br>`void printOdd() {`<br>`    while (count < MAX_COUNT) {`<br>`        std::unique_lock<std::mutex> lock(mtx);`<br>`        cv.wait(lock, []() { return count % 2 != 0; });`<br>`        std::cout << "Odd Thread: " << count << std::endl;`<br>`        count++;`<br>`        cv.notify_all();`<br>`    }`<br>`}`<br><br>`void printEven() {`<br>`    while (count <= MAX_COUNT) {`<br>`        std::unique_lock<std::mutex> lock(mtx);`<br>`        cv.wait(lock, []() { return count % 2 == 0; });`<br>`        std::cout << "Even Thread: " << count << std::endl;`<br>`        count++;`<br>`        cv.notify_all();`<br>`    }`<br>`}`

# 2. Bounded Blocking Queue

> [!NOTE]
>
> Thread-safe blocking queue using a circular array, a mutex, and two condition variables:
>
> `#include <vector>`<br>`#include <mutex>`<br>`#include <condition_variable>`<br><br>`class BoundedBlockingQueue {`<br>`private:`<br>`    std::vector<int> queue;`<br>`    int capacity;`<br>`    int head = 0;`<br>`    int tail = 0;`<br>`    int size = 0;`<br>`    std::mutex mtx;`<br>`    std::condition_variable not_full;`<br>`    std::condition_variable not_empty;`<br><br>`public:`<br>`    BoundedBlockingQueue(int cap) : capacity(cap), queue(cap) {}`<br><br>`    void enqueue(int element) {`<br>`        std::unique_lock<std::mutex> lock(mtx);`<br>`        not_full.wait(lock, [this]() { return size < capacity; });`<br>`        `<br>`        queue[tail] = element;`<br>`        tail = (tail + 1) % capacity;`<br>`        size++;`<br>`        `<br>`        not_empty.notify_one();`<br>`    }`<br><br>`    int dequeue() {`<br>`        std::unique_lock<std::mutex> lock(mtx);`<br>`        not_empty.wait(lock, [this]() { return size > 0; });`<br>`        `<br>`        int val = queue[head];`<br>`        head = (head + 1) % capacity;`<br>`        size--;`<br>`        `<br>`        not_full.notify_one();`<br>`        return val;`<br>`    }`<br>`};`

# 3. Thread-Safe Counter (Atomic &amp; CAS)

> [!NOTE]
>
> Implementing a lock-free thread-safe counter using standard hardware Compare-And-Swap (CAS):
>
> `#include <atomic>`<br><br>`class LockFreeCounter {`<br>`private:`<br>`    std::atomic<int> value{0};`<br><br>`public:`<br>`    void increment() {`<br>`        int current = value.load();`<br>`        // Optimistic spin loop using Compare-And-Swap (CAS)`<br>`        while (!value.compare_exchange_weak(current, current + 1)) {`<br>`            // If another thread updated value, CAS fails, 'current' is updated, retry.`<br>`        }`<br>`    }`<br><br>`    int getValue() const {`<br>`        return value.load();`<br>`    }`<br>`};`

# 4. Read-Write Lock Implementation

> [!NOTE]
>
> Implementing a custom Readers-Writer Lock with priority prevention using mutexes and condition variables:
>
> `#include <mutex>`<br>`#include <condition_variable>`<br><br>`class RWLock {`<br>`private:`<br>`    std::mutex mtx;`<br>`    std::condition_variable cv;`<br>`    int readers = 0;`<br>`    bool writer_active = false;`<br>`    int waiting_writers = 0; // Prevent reader starvation`<br><br>`public:`<br>`    void lockRead() {`<br>`        std::unique_lock<std::mutex> lock(mtx);`<br>`        cv.wait(lock, [this]() { return !writer_active && waiting_writers == 0; });`<br>`        readers++;`<br>`    }`<br><br>`    void unlockRead() {`<br>`        std::unique_lock<std::mutex> lock(mtx);`<br>`        readers--;`<br>`        if (readers == 0) {`<br>`            cv.notify_all();`<br>`        }`<br>`    }`<br><br>`    void lockWrite() {`<br>`        std::unique_lock<std::mutex> lock(mtx);`<br>`        waiting_writers++;`<br>`        cv.wait(lock, [this]() { return !writer_active && readers == 0; });`<br>`        waiting_writers--;`<br>`        writer_active = true;`<br>`    }`<br><br>`    void unlockWrite() {`<br>`        std::unique_lock<std::mutex> lock(mtx);`<br>`        writer_active = false;`<br>`        cv.notify_all();`<br>`    }`<br>`};`
