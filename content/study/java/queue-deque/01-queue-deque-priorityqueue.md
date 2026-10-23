---
id: d56022d3-c2ac-7d11-a163-9340cbee2fc7
key: topic:java/queue-deque
subject: java
topic: queue-deque
title: Queue, Deque & PriorityQueue
slug: queue-deque-priorityqueue
order: 1
---

`Queue` = FIFO line, `Deque` = double-ended (queue <em>and</em> stack), `PriorityQueue` = always hands you the smallest element next. `ArrayDeque` and `PriorityQueue` cover almost every need.

# Two method families

| Action | Throws on failure | Returns special value |
| --- | --- | --- |
| Insert | `add(e)` — `IllegalStateException` if full | `offer(e)` → `false` |
| Remove head | `remove()` — `NoSuchElementException` if empty | `poll()` → `null` |
| Look at head | `element()` — `NoSuchElementException` | `peek()` → `null` |

> [!NOTE] Key point
>
> Prefer `offer`/`poll`/`peek` — empty checks become simple `null` tests. (Which is also why `ArrayDeque` and `PriorityQueue` refuse `null` elements.)

# `ArrayDeque` as a queue and as a stack

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Deque<Integer> queue = new ArrayDeque<>();   // FIFO: offer at tail, poll at head
        queue.offer(1);
        queue.offer(2);
        queue.offer(3);
        System.out.println(queue.poll() + " " + queue.peek() + " " + queue);

        Deque<Integer> stack = new ArrayDeque<>();   // LIFO: push/pop at the head
        stack.push(1);
        stack.push(2);
        stack.push(3);
        System.out.println(stack.pop() + " " + stack.peek() + " " + stack);

        Deque<String> dq = new ArrayDeque<>();
        dq.offerFirst("b");
        dq.offerFirst("a");
        dq.offerLast("c");
        System.out.println(dq.pollLast() + " " + dq);
        System.out.println(new ArrayDeque<Integer>().poll());   // empty -> null
    }
}
```

```text filename:Output
1 2 [2, 3]
3 2 [2, 1]
c [a, b]
null
```

| Deque method | As a queue | As a stack |
| --- | --- | --- |
| `offerLast` / `offer` | enqueue | — |
| `pollFirst` / `poll` | dequeue | — |
| `push` (= `addFirst`) | — | push |
| `pop` (= `removeFirst`) | — | pop |
| `peekFirst` / `peek` | front | top |

> [!TIP] Do
>
> Use `Deque<Integer> stack = new ArrayDeque<>()` — the Javadoc of `Stack` itself recommends it. `ArrayDeque` is a circular array: O(1) amortised at both ends, no node allocation.

# `PriorityQueue` — a binary heap

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        PriorityQueue<Integer> min = new PriorityQueue<>(List.of(5, 1, 8, 3, 2));
        System.out.println("peek=" + min.peek());
        StringBuilder sb = new StringBuilder();
        while (!min.isEmpty()) sb.append(min.poll()).append(' ');
        System.out.println("min-heap order: " + sb.toString().trim());

        PriorityQueue<Integer> max = new PriorityQueue<>(Comparator.reverseOrder());
        max.addAll(List.of(5, 1, 8, 3, 2));
        System.out.println("max first: " + max.poll() + " " + max.poll());

        PriorityQueue<String> byLen = new PriorityQueue<>(
            Comparator.comparingInt(String::length).thenComparing(Comparator.naturalOrder()));
        byLen.addAll(List.of("kiwi", "fig", "banana", "date"));
        System.out.println(byLen.poll() + " " + byLen.poll() + " " + byLen.poll());
    }
}
```

```text filename:Output
peek=1
min-heap order: 1 2 3 5 8
max first: 8 5
fig date kiwi
```

| Operation | Cost |
| --- | --- |
| `offer` / `add` | O(log n) — sift up |
| `poll` / `remove()` | O(log n) — sift down |
| `peek` | O(1) |
| `remove(Object)` / `contains` | O(n) |
| Build from a collection | O(n) heapify |

> [!WARNING] Watch out
>
> Printing or iterating a `PriorityQueue` does <strong>not</strong> give sorted order — only the head is guaranteed to be the minimum. Poll repeatedly to get sorted output.

# Top-K with a size-K min-heap

```java filename:Java
import java.util.*;

public class Main {
    static List<Integer> topK(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();  // min-heap of the k largest so far
        for (int x : nums) {
            heap.offer(x);
            if (heap.size() > k) heap.poll();                 // drop the smallest
        }
        List<Integer> res = new ArrayList<>(heap);
        res.sort(Comparator.reverseOrder());
        return res;
    }

    public static void main(String[] args) {
        System.out.println(topK(new int[]{3, 1, 9, 7, 4, 8, 2}, 3));
    }
}
```

```text filename:Output
[9, 8, 7]
```

O(n log k) time, O(k) space — better than sorting everything (O(n log n)) when k ≪ n.

```question
Why prefer ArrayDeque over Stack and LinkedList?

---

`Stack` extends the synchronised `Vector` (slow, and leaks list methods). `LinkedList` allocates a node per element and chases pointers. `ArrayDeque` is a resizable circular array: O(1) amortised at both ends, compact and cache-friendly. Its only restriction: no `null` elements.
```

```question
How do you make a max-heap in Java?

---

`new PriorityQueue<>(Comparator.reverseOrder())`, or `(a, b) -> b - a` only when overflow is impossible — `Integer.compare(b, a)` is the safe lambda form.
```

```question
Is PriorityQueue thread-safe? What about blocking queues?

---

No. Use `PriorityBlockingQueue` for a thread-safe heap. For producer–consumer, the `BlockingQueue` implementations (`ArrayBlockingQueue`, `LinkedBlockingQueue`) add `put`/`take`, which block when full/empty.
```
