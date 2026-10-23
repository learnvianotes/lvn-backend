---
id: aecc9717-5c86-7e51-bd31-e51f5d8938bd
key: topic:java/completablefuture
subject: java
topic: completablefuture
title: CompletableFuture
slug: completablefuture
order: 1
---

`CompletableFuture` composes asynchronous steps into a pipeline — transform, chain, combine and recover — without blocking a thread on each `get()`.

> [!INFO]
>
> <strong>CompletableFuture&lt;T&gt;</strong> — a `Future` you can complete explicitly <em>and</em> a `CompletionStage`: attach callbacks (`thenApply`, `thenCompose`, …) that run when the value is ready. Async methods run on `ForkJoinPool.commonPool()` unless you pass an `Executor`.

# Transform and combine

```java filename:Java
import java.util.concurrent.CompletableFuture;

public class Main {
    public static void main(String[] args) {
        CompletableFuture<Integer> price = CompletableFuture.supplyAsync(() -> 200);
        CompletableFuture<Double> discount = CompletableFuture.supplyAsync(() -> 0.9);

        double total = price
            .thenCombine(discount, (p, d) -> p * d)   // wait for BOTH, merge
            .thenApply(x -> x + 15)                   // transform the value (shipping)
            .join();                                  // block for the final result
        System.out.println("total = " + total);

        CompletableFuture.supplyAsync(() -> "order-42")
            .thenApply(String::toUpperCase)
            .thenAccept(id -> System.out.println("placed " + id))   // consume, returns CF<Void>
            .thenRun(() -> System.out.println("email queued"))      // no input, no output
            .join();
    }
}
```

```text filename:Output
total = 195.0
placed ORDER-42
email queued
```

# thenApply vs thenCompose

`thenApply` is `map`: the function returns a plain value. `thenCompose` is `flatMap`: the function itself returns a `CompletableFuture`, and you want the inner result — not a nested `CompletableFuture<CompletableFuture<T>>`.

```java filename:Java
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class Main {
    static CompletableFuture<String> findUser(int id) {
        return CompletableFuture.supplyAsync(() -> "user" + id);
    }

    static CompletableFuture<List<String>> findOrders(String user) {
        return CompletableFuture.supplyAsync(() -> List.of(user + ":book", user + ":pen"));
    }

    public static void main(String[] args) {
        List<String> orders = findUser(7)
            .thenCompose(Main::findOrders)        // async step depending on the previous one
            .join();
        System.out.println(orders);
    }
}
```

```text filename:Output
[user7:book, user7:pen]
```

| Method | Function shape | Analogy |
| --- | --- | --- |
| `thenApply(f)` | `T -> U` | `map` |
| `thenCompose(f)` | `T -> CompletionStage<U>` | `flatMap` — sequential async calls |
| `thenCombine(other, f)` | `(T, U) -> V` | zip two independent futures |
| `thenAccept(c)` / `thenRun(r)` | `T -> void` / `() -> void` | side effect at the end |
| `allOf(cfs...)` | → `CompletableFuture<Void>` | wait for all |
| `anyOf(cfs...)` | → `CompletableFuture<Object>` | first to finish wins |
| `...Async` variants | same, but callback runs on the pool | don't hog the completing thread |

# Waiting for many: allOf

```java filename:Java
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class Main {
    public static void main(String[] args) {
        List<CompletableFuture<Integer>> calls = List.of("alpha", "beta", "gamma").stream()
            .map(s -> CompletableFuture.supplyAsync(() -> s.length()))
            .toList();

        CompletableFuture.allOf(calls.toArray(new CompletableFuture[0])).join();
        List<Integer> lengths = calls.stream().map(CompletableFuture::join).toList();  // all done: no waiting
        System.out.println(lengths + " sum=" + lengths.stream().mapToInt(Integer::intValue).sum());
    }
}
```

```text filename:Output
[5, 4, 5] sum=14
```

# Handling errors

```java filename:Java
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        CompletableFuture<Integer> failing = CompletableFuture.supplyAsync(() -> Integer.parseInt("x"));

        int recovered = failing.exceptionally(ex -> -1).join();          // fallback value
        System.out.println("exceptionally -> " + recovered);

        String handled = failing.handle((value, ex) ->                   // sees success OR failure
            ex == null ? "ok " + value : "failed: " + ex.getCause().getClass().getSimpleName()).join();
        System.out.println("handle -> " + handled);

        try {
            failing.join();                                              // unchecked wrapper
        } catch (CompletionException e) {
            System.out.println("join threw CompletionException, cause " + e.getCause().getClass().getSimpleName());
        }
        try {
            failing.get();                                               // checked wrapper
        } catch (ExecutionException e) {
            System.out.println("get threw ExecutionException, cause " + e.getCause().getClass().getSimpleName());
        }
    }
}
```

```text filename:Output
exceptionally -> -1
handle -> failed: NumberFormatException
join threw CompletionException, cause NumberFormatException
get threw ExecutionException, cause NumberFormatException
```

| Method | Called on | Can change result? |
| --- | --- | --- |
| `exceptionally(fn)` | failure only | Yes — supply a fallback |
| `handle((v, ex) -> ...)` | success and failure | Yes — map either to a new value |
| `whenComplete((v, ex) -> ...)` | success and failure | No — side effects (logging); original result passes through |
| `orTimeout(t, unit)` / `completeOnTimeout(v, t, unit)` | Java 9+ | Fail / default after a timeout |

# Use your own executor

```java filename:Java
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class Main {
    public static void main(String[] args) {
        try (ExecutorService io = Executors.newFixedThreadPool(2, r -> new Thread(r, "io-worker"))) {
            String where = CompletableFuture
                .supplyAsync(() -> Thread.currentThread().getName(), io)   // runs on our pool
                .join();
            System.out.println("ran on " + where);
        }
    }
}
```

```text filename:Output
ran on io-worker
```

> [!WARNING] Watch out
>
> The common `ForkJoinPool` is sized for CPU work (cores − 1 threads) and shared by the whole JVM, including parallel streams. Blocking I/O in `supplyAsync(...)` without an executor can starve everything else — pass a dedicated executor (or virtual threads).

```question
join() vs get()?

---

Both block for the result. `get()` throws checked `InterruptedException` and `ExecutionException`; `join()` throws unchecked `CompletionException`, which makes it usable inside lambdas and stream pipelines.
```

```question
thenApply vs thenCompose?

---

`thenApply` maps the result with a function returning a value. `thenCompose` is for a function that returns another `CompletionStage` — it flattens, so dependent async calls chain as `CF<U>` instead of `CF<CF<U>>`.
```

```question
Future vs CompletableFuture?

---

A plain `Future` only lets you poll or block with `get()`. `CompletableFuture` can be completed manually (`complete`, `completeExceptionally`), supports non-blocking callbacks, composition (`thenCompose`, `thenCombine`, `allOf`) and error recovery (`exceptionally`, `handle`).
```
