---
id: fb3cc34a-c1db-790d-9108-af63f9ab569d
key: topic:java/java-dsa-cheatsheet
subject: java
topic: java-dsa-cheatsheet
title: "Java for DSA: Collections Cheat Sheet"
slug: java-for-dsa-collections-cheat-sheet
order: 1
---

The complexities, idioms and templates you reach for in every coding interview, in Java.

# Complexity cheat sheet

| Structure | Access | Search | Insert | Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| `int[]` / array | O(1) | O(n) | — | — | Fixed size |
| `ArrayList` | O(1) | O(n) | O(1) amortised at end | O(n) (shift) | Default list |
| `LinkedList` | O(n) | O(n) | O(1) at ends | O(1) at ends | Rarely the best choice |
| `ArrayDeque` | — | O(n) | O(1) both ends | O(1) both ends | Stack <strong>and</strong> queue |
| `HashMap` / `HashSet` | — | O(1) avg | O(1) avg | O(1) avg | Worst case O(log n) with treeified bins |
| `TreeMap` / `TreeSet` | — | O(log n) | O(log n) | O(log n) | Sorted; floor/ceiling queries |
| `PriorityQueue` | peek O(1) | O(n) | O(log n) | poll O(log n) | Binary min-heap |

# Maps: counting and grouping

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<Character, Integer> freq = new TreeMap<>();          // sorted keys for display
        for (char c : "banana".toCharArray()) {
            freq.merge(c, 1, Integer::sum);                       // add 1 or start at 1
        }
        System.out.println(freq);

        int[] counts = new int[26];                                // faster for lowercase letters
        for (char c : "banana".toCharArray()) counts[c - 'a']++;
        System.out.println(counts['a' - 'a'] + " " + counts['n' - 'a']);

        Map<Integer, List<String>> byLength = new TreeMap<>();
        for (String w : List.of("hi", "cat", "go", "dog")) {
            byLength.computeIfAbsent(w.length(), k -> new ArrayList<>()).add(w);
        }
        System.out.println(byLength);
        System.out.println(freq.getOrDefault('z', 0));
    }
}
```

```text filename:Output
{a=3, b=1, n=2}
3 2
{2=[hi, go], 3=[cat, dog]}
0
```

# Stack, queue and heap

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Deque<Integer> stack = new ArrayDeque<>();
        stack.push(1); stack.push(2); stack.push(3);
        System.out.println(stack.pop() + " " + stack.peek());      // LIFO

        Deque<Integer> queue = new ArrayDeque<>();
        queue.offer(1); queue.offer(2); queue.offer(3);
        System.out.println(queue.poll() + " " + queue.peek());     // FIFO

        PriorityQueue<Integer> minHeap = new PriorityQueue<>(List.of(5, 1, 4));
        PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());
        maxHeap.addAll(List.of(5, 1, 4));
        System.out.println(minHeap.poll() + " " + maxHeap.poll());

        // heap of int[] pairs ordered by the second value
        PriorityQueue<int[]> pq = new PriorityQueue<>((x, y) -> Integer.compare(x[1], y[1]));
        pq.add(new int[]{7, 30}); pq.add(new int[]{8, 10}); pq.add(new int[]{9, 20});
        System.out.println(pq.poll()[0]);
    }
}
```

```text filename:Output
3 2
1 2
1 5
8
```

# TreeMap: ordered queries

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        TreeMap<Integer, String> tm = new TreeMap<>(Map.of(10, "a", 20, "b", 30, "c"));
        System.out.println(tm.floorKey(25) + " " + tm.ceilingKey(25));    // ≤ 25, ≥ 25
        System.out.println(tm.lowerKey(10) + " " + tm.higherKey(30));     // strict: none → null
        System.out.println(tm.firstKey() + " " + tm.lastEntry());
        System.out.println(tm.headMap(20) + " " + tm.tailMap(20, true));
    }
}
```

```text filename:Output
20 30
null null
10 30=c
{10=a} {20=b, 30=c}
```

# Templates

```java filename:Java
import java.util.*;

public class Main {
    static int lowerBound(int[] a, int target) {        // first index with a[i] >= target
        int lo = 0, hi = a.length;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;                // not (lo + hi) / 2 — may overflow
            if (a[mid] < target) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    static int shortestPath(char[][] grid) {            // BFS on a grid, '#' = wall
        int rows = grid.length, cols = grid[0].length;
        int[][] dist = new int[rows][cols];
        for (int[] row : dist) Arrays.fill(row, -1);
        Deque<int[]> q = new ArrayDeque<>();
        q.offer(new int[]{0, 0});
        dist[0][0] = 0;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        while (!q.isEmpty()) {
            int[] cur = q.poll();
            for (int[] d : dirs) {
                int r = cur[0] + d[0], c = cur[1] + d[1];
                if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] != '#' && dist[r][c] == -1) {
                    dist[r][c] = dist[cur[0]][cur[1]] + 1;
                    q.offer(new int[]{r, c});
                }
            }
        }
        return dist[rows - 1][cols - 1];
    }

    public static void main(String[] args) {
        int[] a = {1, 3, 5, 7};
        System.out.println(lowerBound(a, 5) + " " + lowerBound(a, 9));
        System.out.println(Arrays.binarySearch(a, 7) + " " + Arrays.binarySearch(a, 4));  // -(insertion)-1

        char[][] grid = {
            "..#".toCharArray(),
            ".##".toCharArray(),
            "...".toCharArray(),
        };
        System.out.println(shortestPath(grid));
    }
}
```

```text filename:Output
2 4
3 -3
4
```

# Sorting idioms and the subtraction trap

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        int[][] intervals = {{5, 6}, {1, 3}, {2, 4}};
        Arrays.sort(intervals, (x, y) -> Integer.compare(x[0], y[0]));
        System.out.println(Arrays.deepToString(intervals));

        List<String> words = new ArrayList<>(List.of("pear", "fig", "apple", "kiwi"));
        words.sort(Comparator.comparingInt(String::length).thenComparing(Comparator.naturalOrder()));
        System.out.println(words);

        List<Integer> nums = new ArrayList<>(List.of(1, Integer.MIN_VALUE, 5));
        nums.sort((x, y) -> x - y);                  // BROKEN: x - y overflows
        System.out.println(nums);
        nums.sort(Integer::compare);                 // correct
        System.out.println(nums);
    }
}
```

```text filename:Output
[[1, 3], [2, 4], [5, 6]]
[fig, kiwi, pear, apple]
[1, 5, -2147483648]
[-2147483648, 1, 5]
```

# Handy one-liners

| Task | Java |
| --- | --- |
| Char ↔ index | `c - 'a'`, `(char) ('a' + i)` |
| Digit char → int | `c - '0'` or `Character.getNumericValue(c)` |
| Fill / copy arrays | `Arrays.fill(a, -1)`, `Arrays.copyOfRange(a, l, r)` |
| Sum / max of `int[]` | `Arrays.stream(a).sum()`, `.max().getAsInt()` |
| `List<Integer>` → `int[]` | `list.stream().mapToInt(Integer::intValue).toArray()` |
| Reverse a string | `new StringBuilder(s).reverse().toString()` |
| Infinity sentinels | `Integer.MAX_VALUE`, `Long.MAX_VALUE` (beware of `+ 1`) |
| Bit tricks | `Integer.bitCount(x)`, `x & (x - 1)`, `1 << k`, `x >>> 1` |

```question
Why ArrayDeque instead of Stack or LinkedList?

---

`Stack` extends the synchronized `Vector` (needless locking, and it exposes index access). `LinkedList` allocates a node per element and has poor cache locality. `ArrayDeque` is a resizable circular array: O(1) at both ends, fast and memory-compact — the Javadoc itself recommends it for stacks and queues. (It rejects `null` elements.)
```

```question
Why is (a, b) -&gt; a - b a bad comparator?

---

The subtraction can overflow for large values of opposite sign (e.g. `1 - Integer.MIN_VALUE`), producing the wrong sign and an inconsistent ordering. Use `Integer.compare(a, b)` or `Comparator.comparingInt`.
```
