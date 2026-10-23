---
id: 986ab081-79ca-7aef-9252-dc7291157111
key: topic:java/recursion
subject: java
topic: recursion
title: Recursion
slug: recursion
order: 1
---

A method that calls itself on a smaller input. Every recursion needs a <strong>base case</strong>; each call pushes a stack frame, so depth is limited.

> [!INFO]
>
> <strong>Recursion</strong> — solving a problem by reducing it to smaller instances of the same problem, until a <em>base case</em> can be answered directly.

# The two parts

```java filename:Java
public class Main {
    static long factorial(int n) {
        if (n <= 1) return 1;                 // base case
        return n * factorial(n - 1);          // recursive case: smaller input
    }

    static int sumDigits(int n) {
        return n < 10 ? n : n % 10 + sumDigits(n / 10);
    }

    static String reverse(String s) {
        return s.isEmpty() ? "" : reverse(s.substring(1)) + s.charAt(0);
    }

    public static void main(String[] args) {
        System.out.println(factorial(5) + " " + factorial(20));
        System.out.println(sumDigits(9875));
        System.out.println(reverse("stack"));
    }
}
```

```text filename:Output
120 2432902008176640000
29
kcats
```

# The call stack

1. <strong>`factorial(3)`</strong><strong> called</strong>

   Frame pushed: `n=3`, waiting on `factorial(2)`.

2. <strong>`factorial(2)`</strong>

   Frame pushed: `n=2`, waiting on `factorial(1)`.

3. <strong>`factorial(1)`</strong><strong> — base case</strong>

   Returns `1`; frame popped.

4. <strong>Unwinding</strong>

   `2 * 1 = 2` returned, then `3 * 2 = 6`. Each frame pops as it returns.

```java filename:Java
public class Main {
    static int depth = 0;

    static void dive() {
        depth++;
        dive();                               // no base case
    }

    public static void main(String[] args) {
        try {
            dive();
        } catch (StackOverflowError e) {      // an Error, not an Exception
            System.out.println("StackOverflowError after " + (depth > 1000 ? "thousands of" : "few") + " calls");
        }
    }
}
```

```text filename:Output
StackOverflowError after thousands of calls
```

> [!WARNING] Watch out
>
> The JVM does <strong>not</strong> perform tail-call optimization. Even a tail-recursive method uses one frame per call, so deep recursion (e.g. 100 000 levels) overflows the default \~512 KB–1 MB thread stack. Convert to a loop, or run in a thread with a bigger stack.

# Memoization: from exponential to linear

```java filename:Java
import java.util.*;

public class Main {
    static int calls = 0;

    static long fibNaive(int n) {
        calls++;
        return n < 2 ? n : fibNaive(n - 1) + fibNaive(n - 2);    // O(2^n)
    }

    static Map<Integer, Long> memo = new HashMap<>();
    static long fibMemo(int n) {
        if (n < 2) return n;
        Long cached = memo.get(n);
        if (cached != null) return cached;
        long v = fibMemo(n - 1) + fibMemo(n - 2);                // O(n)
        memo.put(n, v);
        return v;
    }

    static long fibIter(int n) {                                 // O(n) time, O(1) space
        long a = 0, b = 1;
        for (int i = 0; i < n; i++) { long t = a + b; a = b; b = t; }
        return a;
    }

    public static void main(String[] args) {
        System.out.println(fibNaive(25) + " in " + calls + " calls");
        System.out.println(fibMemo(90) + " " + fibIter(90));
    }
}
```

```text filename:Output
75025 in 242785 calls
2880067194370816120 2880067194370816120
```

> [!NOTE] Gotcha
>
> Don't use `memo.computeIfAbsent(n, k -> fib(k-1) + fib(k-2))` for recursive memoization on a `HashMap` — modifying the map inside its own `computeIfAbsent` throws `ConcurrentModificationException` (Java 9+).

# Classic recursive patterns

```java filename:Java
import java.util.*;

public class Main {
    static int binarySearch(int[] a, int target, int lo, int hi) {
        if (lo > hi) return -1;
        int mid = (lo + hi) >>> 1;
        if (a[mid] == target) return mid;
        return a[mid] < target ? binarySearch(a, target, mid + 1, hi)
                               : binarySearch(a, target, lo, mid - 1);
    }

    static void subsets(int[] nums, int i, Deque<Integer> cur, List<String> out) {
        if (i == nums.length) { out.add(cur.toString()); return; }
        subsets(nums, i + 1, cur, out);            // exclude nums[i]
        cur.addLast(nums[i]);
        subsets(nums, i + 1, cur, out);            // include nums[i]
        cur.removeLast();                          // backtrack
    }

    static void hanoi(int n, char from, char to, char via, List<String> moves) {
        if (n == 0) return;
        hanoi(n - 1, from, via, to, moves);
        moves.add(from + ">" + to);
        hanoi(n - 1, via, to, from, moves);
    }

    public static void main(String[] args) {
        System.out.println(binarySearch(new int[]{1, 3, 5, 7, 9}, 7, 0, 4));
        List<String> out = new ArrayList<>();
        subsets(new int[]{1, 2, 3}, 0, new ArrayDeque<>(), out);
        System.out.println(out);
        List<String> moves = new ArrayList<>();
        hanoi(3, 'A', 'C', 'B', moves);
        System.out.println(moves.size() + " moves: " + moves);
    }
}
```

```text filename:Output
3
[[], [3], [2], [2, 3], [1], [1, 3], [1, 2], [1, 2, 3]]
7 moves: [A>C, A>B, C>B, A>C, B>A, B>C, A>C]
```

| Recursion | Iteration |
| --- | --- |
| Natural for trees, graphs, divide &amp; conquer, backtracking | Natural for linear scans |
| O(depth) stack space | O(1) extra space usually |
| Risk of `StackOverflowError` | No stack risk |
| Method-call overhead per step | Faster in the JVM |

```question
What happens if a recursive method has no base case?

---

It recurses until the thread's stack is exhausted and the JVM throws `StackOverflowError` (a subclass of `VirtualMachineError`, i.e. an `Error`).
```

```question
Does Java optimize tail recursion?

---

No. The JVM spec has no tail-call elimination (partly to keep stack traces and security checks intact), so rewrite deep tail recursion as a loop.
```

```question
How do you find the time complexity of a recursive function?

---

Write the recurrence: e.g. naive Fibonacci `T(n) = T(n-1) + T(n-2) + O(1)` → O(2ⁿ) (tighter: φⁿ); binary search `T(n) = T(n/2) + O(1)` → O(log n); merge sort `T(n) = 2T(n/2) + O(n)` → O(n log n) (Master theorem).
```
