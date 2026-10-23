---
id: 18239900-a4bc-7aef-b3c6-7b83a1019895
key: topic:c/concurrency
subject: c
topic: concurrency
title: Threads & Atomics (Intro)
slug: threads-atomics-intro
order: 1
---

C11 standardised a memory model, `<stdatomic.h>` and an optional `<threads.h>`. In practice most C code uses POSIX threads (`pthread`). Shared data needs a mutex or atomics — otherwise it is a <em>data race</em> (undefined behaviour).

# Creating and joining threads

```c filename:C%20%E2%80%94%20pthreads%20(Linux%3A%20compile%20with%20-pthread)
#include <stdio.h>
#include <pthread.h>

typedef struct { int id; long from, to, result; } Job;

void *sum_range(void *arg) {                 /* thread entry: void *(*)(void *) */
    Job *job = arg;
    long s = 0;
    for (long i = job->from; i < job->to; i++) s += i;
    job->result = s;                          /* each thread writes only its own Job */
    return NULL;
}

int main(void) {
    enum { N = 4 };
    pthread_t tid[N];
    Job jobs[N];
    for (int i = 0; i < N; i++) {
        jobs[i] = (Job){i, i * 250000L, (i + 1) * 250000L, 0};
        pthread_create(&tid[i], NULL, sum_range, &jobs[i]);
    }
    long total = 0;
    for (int i = 0; i < N; i++) {
        pthread_join(tid[i], NULL);           /* wait, then read the result */
        total += jobs[i].result;
    }
    printf("sum 0..999999 = %ld\n", total);
    return 0;
}
```

```text filename:Output
sum 0..999999 = 499999500000
```

# Protecting shared state

```c filename:C
#include <stdio.h>
#include <pthread.h>
#include <stdatomic.h>

long plain_counter = 0;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
atomic_long atomic_counter = 0;

void *work(void *arg) {
    (void)arg;
    for (int i = 0; i < 100000; i++) {
        pthread_mutex_lock(&lock);
        plain_counter++;                         /* critical section */
        pthread_mutex_unlock(&lock);
        atomic_fetch_add(&atomic_counter, 1);    /* lock-free alternative */
    }
    return NULL;
}

int main(void) {
    pthread_t t[4];
    for (int i = 0; i < 4; i++) pthread_create(&t[i], NULL, work, NULL);
    for (int i = 0; i < 4; i++) pthread_join(t[i], NULL);
    printf("mutex: %ld, atomic: %ld\n", plain_counter, atomic_load(&atomic_counter));
    return 0;
}
```

```text filename:Output
mutex: 400000, atomic: 400000
```

> [!WARNING] Watch out
>
> Without the mutex, `counter++` is a read-modify-write of three steps; two threads interleave and increments are lost (and the program has undefined behaviour). Detect races with `-fsanitize=thread` (ThreadSanitizer).

| Tool | Use |
| --- | --- |
| `pthread_mutex_t` | Mutual exclusion around a critical section |
| `pthread_cond_t` | Wait for a condition (producer/consumer) |
| `pthread_rwlock_t` | Many readers or one writer |
| `_Atomic` / `atomic_int` | Lock-free counters, flags |
| `_Thread_local` | Per-thread variables |
| `pthread_once` / `call_once` | One-time initialisation |

```question
What is a race condition, and what is a deadlock?

---

A race condition is when the result depends on the unpredictable interleaving of threads — e.g. two threads doing `count++` on shared data without synchronisation (in C a data race is undefined behaviour). A deadlock is when threads wait on each other forever — e.g. thread A holds lock 1 and wants lock 2 while thread B holds lock 2 and wants lock 1. Prevent deadlocks by always acquiring locks in a consistent global order.
```

```question
Is volatile enough for sharing a flag between threads?

---

No. `volatile` prevents the compiler from caching the value but gives no atomicity and no ordering guarantees between CPU cores. Use `_Atomic` (e.g. `atomic_bool`) or a mutex.
```
