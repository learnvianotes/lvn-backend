---
id: d18587f6-230c-7885-b43c-9ec559cc68ce
key: topic:dsa-advanced/heap
subject: dsa-advanced
topic: heap
title: Heap
slug: heap
order: 1
---

A heap gives you the smallest (or largest) element of a changing collection in `O(1)`, with `O(log n)` insert and remove. Almost every “top k”, “k-way merge” and “running statistic” problem is a heap of the right <strong>type</strong> and the right <strong>size</strong>.

> [!INFO]
>
> <strong>Binary heap</strong> — a complete binary tree stored in an array where every node is `<=` its children (<strong>min-heap</strong>) or `>=` its children (<strong>max-heap</strong>). The root is therefore the minimum (or maximum). A <em>priority queue</em> is the abstract interface; a binary heap is its usual implementation.

```text filename:A%20heap%20is%20just%20an%20array%20with%20a%20parent%2Fchild%20index%20rule%20%E2%80%94%20no%20pointers
min-heap as a tree              the same heap as an array
         5                      index:  0   1   2   3   4
       /   \                   value:  5   8  10  15  20
      8     10
     / \                       parent(i) = (i - 1) / 2
   15   20                     children(i) = 2i + 1, 2i + 2
```

| Operation | Time | How |
| --- | --- | --- |
| `peek()` — min or max | O(1) | it is `a[0]` |
| `push(x)` | O(log n) | append, then <em>sift up</em> while smaller than the parent |
| `pop()` | O(log n) | move the last element to the root, then <em>sift down</em> |
| `heapify(array)` | O(n) | sift down from the last internal node to the root — cheaper than `n` pushes |
| search for an arbitrary key | O(n) | a heap is <strong>not</strong> sorted; only the root is special |

> [!NOTE] Key point
>
> The heap property says nothing about the order between siblings or between subtrees — `a[1..]` is not sorted. Printing the array of a heap or iterating a `PriorityQueue` gives an arbitrary-looking order; to get sorted output you must pop repeatedly.

# Priority queues in each language

| Language | Type | Default | Max-heap |
| --- | --- | --- | --- |
| Python | `heapq` functions on a list | min-heap | push `-x`, negate on pop (or `(-key, item)` tuples) |
| C++ | `std::priority_queue<T>` | <strong>max</strong>-heap | default; min-heap needs `priority_queue<T, vector<T>, greater<T>>` |
| Java | `java.util.PriorityQueue<T>` | min-heap | `new PriorityQueue<>(Collections.reverseOrder())` or a comparator |
| JavaScript | none built in | — | write a small `Heap` class with a comparator once (below) and reuse it |

```python filename:Python
import heapq

nums = [5, 15, 10, 20, 8]

mn = []                                  # heapq is a min-heap only
for x in nums:
    heapq.heappush(mn, x)
print("min-heap:", *(heapq.heappop(mn) for _ in range(len(nums))))

mx = [-x for x in nums]                  # max-heap: store the negated keys
heapq.heapify(mx)                        # O(n) build
print("max-heap:", *(-heapq.heappop(mx) for _ in range(len(nums))))
```

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

int main() {
    vector<int> nums = {5, 15, 10, 20, 8};

    priority_queue<int, vector<int>, greater<int>> mn;     // min-heap needs greater<>
    for (int x : nums) mn.push(x);
    cout << "min-heap:";
    while (!mn.empty()) { cout << " " << mn.top(); mn.pop(); }
    cout << "\n";

    priority_queue<int> mx(nums.begin(), nums.end());       // default is a max-heap; O(n) build
    cout << "max-heap:";
    while (!mx.empty()) { cout << " " << mx.top(); mx.pop(); }
    cout << "\n";
}
```

```java filename:Java
import java.util.Collections;
import java.util.PriorityQueue;

public class Main {
    public static void main(String[] args) {
        int[] nums = {5, 15, 10, 20, 8};

        PriorityQueue<Integer> mn = new PriorityQueue<>();        // min-heap by default
        for (int x : nums) mn.add(x);
        StringBuilder sb = new StringBuilder("min-heap:");
        while (!mn.isEmpty()) sb.append(' ').append(mn.poll());
        System.out.println(sb);

        PriorityQueue<Integer> mx = new PriorityQueue<>(Collections.reverseOrder());   // or (a, b) -> b - a
        for (int x : nums) mx.add(x);
        sb = new StringBuilder("max-heap:");
        while (!mx.isEmpty()) sb.append(' ').append(mx.poll());
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
class Heap {
    constructor(cmp = (a, b) => a - b) { this.a = []; this.cmp = cmp; }   // cmp(x, y) < 0 → x comes out first
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        a.push(x);
        let i = a.length - 1;
        while (i > 0) {                                    // sift up
            const p = (i - 1) >> 1;
            if (this.cmp(a[i], a[p]) >= 0) break;
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {                                     // sift down
                let m = i;
                const l = 2 * i + 1, r = l + 1;
                if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
                if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]];
                i = m;
            }
        }
        return top;
    }
}

const nums = [5, 15, 10, 20, 8];

const mn = new Heap((a, b) => a - b);                      // min-heap
for (const x of nums) mn.push(x);
const small = [];
while (mn.size()) small.push(mn.pop());
console.log("min-heap:", small.join(" "));

const mx = new Heap((a, b) => b - a);                      // max-heap: flip the comparator
for (const x of nums) mx.push(x);
const big = [];
while (mx.size()) big.push(mx.pop());
console.log("max-heap:", big.join(" "));
```

```text filename:Output
min-heap: 5 8 10 15 20
max-heap: 20 15 10 8 5
```

> [!NOTE] Key point
>
> The JavaScript `Heap` class above is reused unchanged in every solution below — comparator `(a, b) => a - b` for a min-heap, `(a, b) => b - a` for a max-heap, or compare a field of an array/object. Python's `heapq` compares tuples lexicographically, which is how `(key, payload)` pairs are ordered in the k-closest and merge problems.

> [!WARNING] Pitfall
>
> Python: `heapq.heappush(h, -x)` and forgetting to negate on the way out is the classic max-heap slip. Java: `(a, b) -> b - a` overflows for values near `Integer.MIN_VALUE` / `MAX_VALUE` — use `Integer.compare(b, a)` or `Collections.reverseOrder()`. C++: remember the default `priority_queue` is a <strong>max</strong>-heap.

# Sort a k-sorted (nearly sorted) array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [9, 8, 7, 18, 19, 17], k = 2`<br><strong>Output:</strong> `7 8 9 17 18 19`<br><strong>Input:</strong> `arr = [10, 9, 8, 7, 4, 70, 60, 50], k = 4`<br><strong>Output:</strong> `4 7 8 9 10 50 60 70`

Every element is at most `k` positions away from its sorted position. A full sort is `O(n log n)`; exploiting `k` gives `O(n log k)`.

> [!NOTE] Idea
>
> The element that belongs at index `i` lies somewhere in `arr[i..i+k]`. So keep a min-heap of the next `k+1` unplaced elements: its minimum is guaranteed to be the next output. Push one element, and whenever the heap holds `k+1` items pop its minimum into the result; drain the heap at the end.

```python filename:Python
import heapq

def sort_k(arr, k):
    h, res = [], []
    for x in arr:
        heapq.heappush(h, x)
        if len(h) > k:                   # k+1 elements inside → the minimum is final
            res.append(heapq.heappop(h))
    while h:                             # drain the last k elements in order
        res.append(heapq.heappop(h))
    return res

print(*sort_k([9, 8, 7, 18, 19, 17], 2))
print(*sort_k([10, 9, 8, 7, 4, 70, 60, 50], 4))
```

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

vector<int> sortK(const vector<int>& arr, int k) {
    priority_queue<int, vector<int>, greater<int>> h;     // min-heap
    vector<int> res;
    for (int x : arr) {
        h.push(x);
        if ((int)h.size() > k) { res.push_back(h.top()); h.pop(); }   // k+1 inside → the minimum is final
    }
    while (!h.empty()) { res.push_back(h.top()); h.pop(); }           // drain the last k elements
    return res;
}

void print(const vector<int>& v) {
    for (int i = 0; i < (int)v.size(); i++) cout << (i ? " " : "") << v[i];
    cout << "\n";
}

int main() {
    print(sortK({9, 8, 7, 18, 19, 17}, 2));
    print(sortK({10, 9, 8, 7, 4, 70, 60, 50}, 4));
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;

public class Main {
    static List<Integer> sortK(int[] arr, int k) {
        PriorityQueue<Integer> h = new PriorityQueue<>();     // min-heap
        List<Integer> res = new ArrayList<>();
        for (int x : arr) {
            h.add(x);
            if (h.size() > k) res.add(h.poll());              // k+1 inside → the minimum is final
        }
        while (!h.isEmpty()) res.add(h.poll());               // drain the last k elements
        return res;
    }

    static String join(List<Integer> xs) {
        StringBuilder sb = new StringBuilder();
        for (int x : xs) sb.append(x).append(' ');
        return sb.toString().trim();
    }

    public static void main(String[] args) {
        System.out.println(join(sortK(new int[]{9, 8, 7, 18, 19, 17}, 2)));
        System.out.println(join(sortK(new int[]{10, 9, 8, 7, 4, 70, 60, 50}, 4)));
    }
}
```

```javascript filename:JavaScript
class Heap {
    constructor(cmp = (a, b) => a - b) { this.a = []; this.cmp = cmp; }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        a.push(x);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.cmp(a[i], a[p]) >= 0) break;
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {
                let m = i;
                const l = 2 * i + 1, r = l + 1;
                if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
                if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]];
                i = m;
            }
        }
        return top;
    }
}

function sortK(arr, k) {
    const h = new Heap(), res = [];                        // min-heap
    for (const x of arr) {
        h.push(x);
        if (h.size() > k) res.push(h.pop());               // k+1 inside → the minimum is final
    }
    while (h.size()) res.push(h.pop());                    // drain the last k elements
    return res;
}

console.log(sortK([9, 8, 7, 18, 19, 17], 2).join(" "));
console.log(sortK([10, 9, 8, 7, 4, 70, 60, 50], 4).join(" "));
```

```text filename:Output
7 8 9 17 18 19
4 7 8 9 10 50 60 70
```

Time O(n log k) · Space O(k)

> [!WARNING] Pitfall
>
> The heap must hold `k + 1` elements before you trust its minimum, not `k`: with `k = 2` and `[9, 8, 7, …]`, the `7` is only pushed as the third element. Popping after `k` pushes would emit `8` first. When `k >= n` the method degenerates to heap sort — still correct, just `O(n log n)`.

# Purchase maximum items with a budget

> [!TIP] Example
>
> <strong>Input:</strong> `cost = [1, 12, 5, 111, 200], budget = 10`<br><strong>Output:</strong> `2 (buy 1 and 5)`<br><strong>Input:</strong> `cost = [20, 10, 5, 30, 100], budget = 35`<br><strong>Output:</strong> `3 (buy 5, 10 and 20)`

> [!NOTE] Idea
>
> Greedy: always buy the cheapest remaining item — a more expensive one can never let you afford <em>more</em> items. Sorting gives the cheapest items in order in `O(n log n)`:

```python filename:Python
def max_items_sorted(cost, budget):
    count = 0
    for c in sorted(cost):            # cheapest first
        if c > budget:
            break
        budget -= c
        count += 1
    return count

print(max_items_sorted([1, 12, 5, 111, 200], 10))
print(max_items_sorted([20, 10, 5, 30, 100], 35))
```

```text filename:Output
2
3
```

Time O(n log n) · Space O(1) extra (in-place sort)

But you usually stop long before the end — the budget runs out after `r` items. A min-heap built in `O(n)` and popped `r` times costs `O(n + r log n)`, which beats a sort when `r` is small (a tight budget, a huge catalogue).

```python filename:Python
import heapq

def max_items(cost, budget):
    h = list(cost)
    heapq.heapify(h)                     # O(n) — cheaper than sorting everything
    count = 0
    while h and h[0] <= budget:          # cheapest remaining item is affordable
        budget -= heapq.heappop(h)
        count += 1
    return count

print(max_items([1, 12, 5, 111, 200], 10))
print(max_items([20, 10, 5, 30, 100], 35))
```

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

int maxItems(const vector<int>& cost, int budget) {
    priority_queue<int, vector<int>, greater<int>> h(cost.begin(), cost.end());   // O(n) heapify
    int count = 0;
    while (!h.empty() && h.top() <= budget) {    // cheapest remaining item is affordable
        budget -= h.top();
        h.pop();
        count++;
    }
    return count;
}

int main() {
    cout << maxItems({1, 12, 5, 111, 200}, 10) << "\n";
    cout << maxItems({20, 10, 5, 30, 100}, 35) << "\n";
}
```

```java filename:Java
import java.util.PriorityQueue;

public class Main {
    static int maxItems(int[] cost, int budget) {
        PriorityQueue<Integer> h = new PriorityQueue<>();
        for (int c : cost) h.add(c);                 // n pushes: O(n log n); a Collection ctor heapifies in O(n)
        int count = 0;
        while (!h.isEmpty() && h.peek() <= budget) { // cheapest remaining item is affordable
            budget -= h.poll();
            count++;
        }
        return count;
    }

    public static void main(String[] args) {
        System.out.println(maxItems(new int[]{1, 12, 5, 111, 200}, 10));
        System.out.println(maxItems(new int[]{20, 10, 5, 30, 100}, 35));
    }
}
```

```javascript filename:JavaScript
class Heap {
    constructor(cmp = (a, b) => a - b) { this.a = []; this.cmp = cmp; }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        a.push(x);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.cmp(a[i], a[p]) >= 0) break;
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {
                let m = i;
                const l = 2 * i + 1, r = l + 1;
                if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
                if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]];
                i = m;
            }
        }
        return top;
    }
}

function maxItems(cost, budget) {
    const h = new Heap();                            // min-heap
    for (const c of cost) h.push(c);
    let count = 0;
    while (h.size() && h.peek() <= budget) {         // cheapest remaining item is affordable
        budget -= h.pop();
        count++;
    }
    return count;
}

console.log(maxItems([1, 12, 5, 111, 200], 10));
console.log(maxItems([20, 10, 5, 30, 100], 35));
```

```text filename:Output
2
3
```

Time O(n + r log n) · Space O(n)

> [!NOTE] Key point
>
> The original notes' heap version had two bugs: it iterated `for i in cost` while popping from the <em>same</em> list (`pq = cost` aliases, it does not copy), and the driver called the sorting function instead. Copy the list before `heapify`, and loop on the heap's top, not on an index.

# K largest elements

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [5, 15, 10, 20, 8], k = 2`<br><strong>Output:</strong> `15 20`<br><strong>Input:</strong> `arr = [3, 9, 1, 7, 5, 8], k = 3`<br><strong>Output:</strong> `7 8 9`

> [!NOTE] Idea
>
> Keep a <strong>min-heap of size k</strong> holding the `k` largest elements seen so far. Its root is the smallest of those `k` — the <em>threshold</em>. A new element that is not above the threshold can never be in the answer; one that is replaces the root. The heap is tiny, so each step is `O(log k)`.

1. <strong>Build</strong>

   Put the first `k` elements into a min-heap.

2. <strong>Scan the rest</strong>

   If `x <= heap.top()` ignore it; otherwise pop the top and push `x`.

3. <strong>Collect</strong>

   The heap now holds exactly the `k` largest. Pop them for ascending order.

```python filename:Python
import heapq

def k_largest(arr, k):
    h = arr[:k]
    heapq.heapify(h)                      # min-heap of the k largest seen so far
    for x in arr[k:]:
        if x > h[0]:                      # bigger than the current threshold
            heapq.heapreplace(h, x)       # pop the root and push x in one sift
    return sorted(h)

print(*k_largest([5, 15, 10, 20, 8], 2))
print(*k_largest([3, 9, 1, 7, 5, 8], 3))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <functional>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

vector<int> kLargest(const vector<int>& arr, int k) {
    priority_queue<int, vector<int>, greater<int>> h;     // min-heap of the k largest seen so far
    int n = arr.size();
    for (int i = 0; i < n; i++) {
        if (i < k) h.push(arr[i]);
        else if (arr[i] > h.top()) { h.pop(); h.push(arr[i]); }   // beats the threshold
    }
    vector<int> res;
    while (!h.empty()) { res.push_back(h.top()); h.pop(); }       // popped in ascending order
    return res;
}

void print(const vector<int>& v) {
    for (int i = 0; i < (int)v.size(); i++) cout << (i ? " " : "") << v[i];
    cout << "\n";
}

int main() {
    print(kLargest({5, 15, 10, 20, 8}, 2));
    print(kLargest({3, 9, 1, 7, 5, 8}, 3));
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;

public class Main {
    static List<Integer> kLargest(int[] arr, int k) {
        PriorityQueue<Integer> h = new PriorityQueue<>();     // min-heap of the k largest seen so far
        for (int i = 0; i < arr.length; i++) {
            if (i < k) h.add(arr[i]);
            else if (arr[i] > h.peek()) { h.poll(); h.add(arr[i]); }   // beats the threshold
        }
        List<Integer> res = new ArrayList<>();
        while (!h.isEmpty()) res.add(h.poll());               // polled in ascending order
        return res;
    }

    static String join(List<Integer> xs) {
        StringBuilder sb = new StringBuilder();
        for (int x : xs) sb.append(x).append(' ');
        return sb.toString().trim();
    }

    public static void main(String[] args) {
        System.out.println(join(kLargest(new int[]{5, 15, 10, 20, 8}, 2)));
        System.out.println(join(kLargest(new int[]{3, 9, 1, 7, 5, 8}, 3)));
    }
}
```

```javascript filename:JavaScript
class Heap {
    constructor(cmp = (a, b) => a - b) { this.a = []; this.cmp = cmp; }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        a.push(x);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.cmp(a[i], a[p]) >= 0) break;
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {
                let m = i;
                const l = 2 * i + 1, r = l + 1;
                if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
                if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]];
                i = m;
            }
        }
        return top;
    }
}

function kLargest(arr, k) {
    const h = new Heap();                                  // min-heap of the k largest seen so far
    for (let i = 0; i < arr.length; i++) {
        if (i < k) h.push(arr[i]);
        else if (arr[i] > h.peek()) { h.pop(); h.push(arr[i]); }   // beats the threshold
    }
    const res = [];
    while (h.size()) res.push(h.pop());                    // popped in ascending order
    return res;
}

console.log(kLargest([5, 15, 10, 20, 8], 2).join(" "));
console.log(kLargest([3, 9, 1, 7, 5, 8], 3).join(" "));
```

```text filename:Output
15 20
7 8 9
```

Time O(n log k) · Space O(k)

The alternative is a max-heap of <strong>all</strong> `n` elements, popped `k` times. It is simpler and gives the results largest-first, but it needs `O(n)` memory and cannot process a stream:

```python filename:Python
import heapq

def k_largest_maxheap(arr, k):
    h = [-x for x in arr]                   # max-heap via negation
    heapq.heapify(h)                        # O(n)
    return [-heapq.heappop(h) for _ in range(k)]   # k pops, O(k log n)

print(*k_largest_maxheap([5, 15, 10, 20, 8], 2))
```

```text filename:Output
20 15
```

| Approach | Time | Space | Works on a stream? |
| --- | --- | --- | --- |
| sort, take the last `k` | O(n log n) | O(1) | no |
| max-heap of all, pop `k` | O(n + k log n) | O(n) | no |
| <strong>min-heap of size </strong><strong>`k`</strong> | O(n log k) | O(k) | yes — the heap is the running answer |
| quickselect | O(n) average | O(1) | no (unordered result) |

> [!WARNING] Pitfall
>
> Use a <strong>min</strong>-heap for the k <em>largest</em> and a <strong>max</strong>-heap for the k <em>smallest</em>. The heap type is the opposite of what you are looking for, because the root must be the element you are willing to throw away.

# K closest elements to x

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 15, 7, 3, 4], x = 8, k = 2`<br><strong>Output:</strong> `7 10`<br><strong>Input:</strong> `arr = [5, 15, 10, 20, 8], x = 12, k = 3`<br><strong>Output:</strong> `8 10 15`

Pick the `k` elements with the smallest `|arr[i] - x|`. The naive approach finds the closest element, removes it and repeats `k` times:

```python filename:Python
def k_closest_naive(arr, x, k):
    arr = list(arr)
    res = []
    for _ in range(k):                                     # k passes …
        mi = 0
        for j in range(1, len(arr)):                       # … each scanning the whole array
            if abs(arr[j] - x) < abs(arr[mi] - x):
                mi = j
        res.append(arr.pop(mi))
    return sorted(res)

print(*k_closest_naive([10, 15, 7, 3, 4], 8, 2))
```

```text filename:Output
7 10
```

Time O(n · k) · Space O(k)

> [!NOTE] Idea
>
> This is <em>k smallest</em> with the key `|arr[i] - x|`, so flip the previous recipe: a <strong>max-heap of size k</strong> keyed on the distance. The root is the farthest of the current best `k`; a new element closer than it replaces it. Store `(distance, value)` pairs so the heap orders by distance but you can still print the value.

```python filename:Python
import heapq

def k_closest(arr, x, k):
    h = []                                        # max-heap on distance: push (-dist, -value)
    for v in arr:
        heapq.heappush(h, (-abs(v - x), -v))
        if len(h) > k:
            heapq.heappop(h)                      # drop the farthest (on ties: the larger value)
    return sorted(-v for _, v in h)

print(*k_closest([10, 15, 7, 3, 4], 8, 2))
print(*k_closest([5, 15, 10, 20, 8], 12, 3))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <cstdlib>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

vector<int> kClosest(const vector<int>& arr, int x, int k) {
    priority_queue<pair<int, int>> h;             // max-heap on (distance, value)
    for (int v : arr) {
        h.push({abs(v - x), v});
        if ((int)h.size() > k) h.pop();           // drop the farthest (on ties: the larger value)
    }
    vector<int> res;
    while (!h.empty()) { res.push_back(h.top().second); h.pop(); }
    sort(res.begin(), res.end());
    return res;
}

void print(const vector<int>& v) {
    for (int i = 0; i < (int)v.size(); i++) cout << (i ? " " : "") << v[i];
    cout << "\n";
}

int main() {
    print(kClosest({10, 15, 7, 3, 4}, 8, 2));
    print(kClosest({5, 15, 10, 20, 8}, 12, 3));
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.PriorityQueue;

public class Main {
    static List<Integer> kClosest(int[] arr, int x, int k) {
        // max-heap on distance, then on value: int[]{distance, value}
        PriorityQueue<int[]> h = new PriorityQueue<>(
            (a, b) -> a[0] != b[0] ? Integer.compare(b[0], a[0]) : Integer.compare(b[1], a[1]));
        for (int v : arr) {
            h.add(new int[]{Math.abs(v - x), v});
            if (h.size() > k) h.poll();                   // drop the farthest (on ties: the larger value)
        }
        List<Integer> res = new ArrayList<>();
        while (!h.isEmpty()) res.add(h.poll()[1]);
        Collections.sort(res);
        return res;
    }

    static String join(List<Integer> xs) {
        StringBuilder sb = new StringBuilder();
        for (int v : xs) sb.append(v).append(' ');
        return sb.toString().trim();
    }

    public static void main(String[] args) {
        System.out.println(join(kClosest(new int[]{10, 15, 7, 3, 4}, 8, 2)));
        System.out.println(join(kClosest(new int[]{5, 15, 10, 20, 8}, 12, 3)));
    }
}
```

```javascript filename:JavaScript
class Heap {
    constructor(cmp = (a, b) => a - b) { this.a = []; this.cmp = cmp; }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        a.push(x);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.cmp(a[i], a[p]) >= 0) break;
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {
                let m = i;
                const l = 2 * i + 1, r = l + 1;
                if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
                if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]];
                i = m;
            }
        }
        return top;
    }
}

function kClosest(arr, x, k) {
    // max-heap on distance, then on value: [distance, value]
    const h = new Heap((a, b) => a[0] !== b[0] ? b[0] - a[0] : b[1] - a[1]);
    for (const v of arr) {
        h.push([Math.abs(v - x), v]);
        if (h.size() > k) h.pop();                         // drop the farthest (on ties: the larger value)
    }
    const res = [];
    while (h.size()) res.push(h.pop()[1]);
    return res.sort((a, b) => a - b);
}

console.log(kClosest([10, 15, 7, 3, 4], 8, 2).join(" "));
console.log(kClosest([5, 15, 10, 20, 8], 12, 3).join(" "));
```

```text filename:Output
7 10
8 10 15
```

Time O(n log k) · Space O(k)

> [!NOTE] Key point
>
> Ties matter: two elements at the same distance (`7` and `9` for `x = 8`) — decide which one wins <em>before</em> coding and encode it in the comparator (here: on equal distance the larger value is dropped, so the smaller one is kept). Python's tuple ordering, C++'s `pair` ordering and the explicit Java/JavaScript comparators all implement that same rule. If the array is <strong>sorted</strong>, a two-pointer window or binary search solves it in `O(log n + k)` with no heap at all.

# Merge k sorted arrays

> [!TIP] Example
>
> <strong>Input:</strong> `arrays = [[10, 20, 30], [5, 15], [1, 9, 11, 18]]`<br><strong>Output:</strong> `1 5 9 10 11 15 18 20 30`

`N` is the total number of elements, `k` the number of arrays. Two obvious approaches ignore the fact that the inputs are already sorted:

```python filename:Python
# 1. concatenate everything and sort: O(N log N) — ignores the existing order
def merge_k_sort(arrays):
    res = []
    for a in arrays:
        res.extend(a)
    return sorted(res)

# 2. merge the arrays one by one into the result: O(N · k) — the result is re-merged k times
def merge_two(a, b):
    res, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] < b[j]:
            res.append(a[i]); i += 1
        else:
            res.append(b[j]); j += 1
    return res + a[i:] + b[j:]

def merge_k_pairwise(arrays):
    res = list(arrays[0])
    for a in arrays[1:]:
        res = merge_two(res, a)
    return res

arrays = [[10, 20, 30], [5, 15], [1, 9, 11, 18]]
print(*merge_k_sort(arrays))
print(*merge_k_pairwise(arrays))
```

```text filename:Output
1 5 9 10 11 15 18 20 30
1 5 9 10 11 15 18 20 30
```

> [!NOTE] Idea
>
> At any moment the next output is the smallest among the <strong>heads</strong> of the `k` arrays. Keep those `k` heads in a min-heap as `(value, array index, element index)`. Pop the minimum, append it, and push the next element of the same array. Each of the `N` elements enters and leaves a heap of size `<= k` once.

```text filename:The%20heap%20never%20holds%20more%20than%20one%20element%20per%20array
heap of heads          output so far
{10, 5, 1}       pop 1  → push 9       1
{10, 5, 9}       pop 5  → push 15      1 5
{10, 15, 9}      pop 9  → push 11      1 5 9
{10, 15, 11}     pop 10 → push 20      1 5 9 10
{20, 15, 11}     pop 11 → push 18      1 5 9 10 11
...
```

```python filename:Python
import heapq

def merge_k(arrays):
    h = [(a[0], i, 0) for i, a in enumerate(arrays) if a]   # (value, which array, index in it)
    heapq.heapify(h)
    res = []
    while h:
        val, ai, j = heapq.heappop(h)
        res.append(val)
        if j + 1 < len(arrays[ai]):                          # the same array has more
            heapq.heappush(h, (arrays[ai][j + 1], ai, j + 1))
    return res

print(*merge_k([[10, 20, 30], [5, 15], [1, 9, 11, 18]]))
```

```cpp filename:C%2B%2B
#include <array>
#include <functional>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

vector<int> mergeK(const vector<vector<int>>& arrays) {
    using Item = array<int, 3>;                              // {value, which array, index in it}
    priority_queue<Item, vector<Item>, greater<Item>> h;     // min-heap, compares lexicographically
    int k = arrays.size();
    for (int i = 0; i < k; i++)
        if (!arrays[i].empty()) h.push({arrays[i][0], i, 0});
    vector<int> res;
    while (!h.empty()) {
        Item it = h.top(); h.pop();
        int val = it[0], ai = it[1], j = it[2];
        res.push_back(val);
        if (j + 1 < (int)arrays[ai].size())                  // the same array has more
            h.push({arrays[ai][j + 1], ai, j + 1});
    }
    return res;
}

int main() {
    vector<int> res = mergeK({{10, 20, 30}, {5, 15}, {1, 9, 11, 18}});
    for (int i = 0; i < (int)res.size(); i++) cout << (i ? " " : "") << res[i];
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;

public class Main {
    static List<Integer> mergeK(int[][] arrays) {
        // int[]{value, which array, index in it}, ordered by value
        PriorityQueue<int[]> h = new PriorityQueue<>((a, b) -> Integer.compare(a[0], b[0]));
        for (int i = 0; i < arrays.length; i++)
            if (arrays[i].length > 0) h.add(new int[]{arrays[i][0], i, 0});
        List<Integer> res = new ArrayList<>();
        while (!h.isEmpty()) {
            int[] it = h.poll();
            int val = it[0], ai = it[1], j = it[2];
            res.add(val);
            if (j + 1 < arrays[ai].length)                   // the same array has more
                h.add(new int[]{arrays[ai][j + 1], ai, j + 1});
        }
        return res;
    }

    public static void main(String[] args) {
        List<Integer> res = mergeK(new int[][]{{10, 20, 30}, {5, 15}, {1, 9, 11, 18}});
        StringBuilder sb = new StringBuilder();
        for (int v : res) sb.append(v).append(' ');
        System.out.println(sb.toString().trim());
    }
}
```

```javascript filename:JavaScript
class Heap {
    constructor(cmp = (a, b) => a - b) { this.a = []; this.cmp = cmp; }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        a.push(x);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.cmp(a[i], a[p]) >= 0) break;
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {
                let m = i;
                const l = 2 * i + 1, r = l + 1;
                if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
                if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]];
                i = m;
            }
        }
        return top;
    }
}

function mergeK(arrays) {
    const h = new Heap((a, b) => a[0] - b[0]);               // [value, which array, index in it]
    arrays.forEach((a, i) => { if (a.length) h.push([a[0], i, 0]); });
    const res = [];
    while (h.size()) {
        const [val, ai, j] = h.pop();
        res.push(val);
        if (j + 1 < arrays[ai].length)                       // the same array has more
            h.push([arrays[ai][j + 1], ai, j + 1]);
    }
    return res;
}

console.log(mergeK([[10, 20, 30], [5, 15], [1, 9, 11, 18]]).join(" "));
```

```text filename:Output
1 5 9 10 11 15 18 20 30
```

Time O(N log k) · Space O(k) for the heap, plus the output

| Approach | Time | Why |
| --- | --- | --- |
| concatenate + sort | O(N log N) | throws away the input order |
| merge one array at a time | O(N · k) | the growing result is re-merged `k - 1` times |
| <strong>min-heap of </strong><strong>`k`</strong><strong> heads</strong> | O(N log k) | every element passes once through a heap of size `k` |
| divide and conquer (merge pairs) | O(N log k) | same bound, no heap, more copying |

> [!WARNING] Pitfall
>
> Push the <strong>array index and position</strong>, not just the value — otherwise you cannot tell which array to advance. Pushing the whole remaining array into the heap instead of one head makes it `O(N log N)` again. The same heap-of-heads pattern merges `k` sorted linked lists, `k` sorted files on disk (external sorting) and `k` sorted streams.

# Median of a stream

> [!TIP] Example
>
> <strong>Input:</strong> `stream = [25, 7, 10, 15, 20]`<br><strong>Output:</strong> `25.0 16.0 10.0 12.5 15.0`

After each new number, report the median of everything seen so far. A median needs the <em>middle</em> of the data, not its minimum — the trick is to split the data in two halves.

| Numbers so far | Sorted | Median |
| --- | --- | --- |
| `25` | 25 | 25.0 |
| `25 7` | 7 25 | (7 + 25) / 2 = 16.0 |
| `25 7 10` | 7 10 25 | 10.0 |
| `25 7 10 15` | 7 10 15 25 | (10 + 15) / 2 = 12.5 |
| `25 7 10 15 20` | 7 10 15 20 25 | 15.0 |

Re-sorting after every arrival works but costs `O(n log n)` per element (or `O(n)` with insertion into a sorted list):

```python filename:Python
def medians_naive(stream):
    seen, out = [], []
    for x in stream:
        seen.append(x)
        seen.sort()                                   # O(n log n) every time
        n = len(seen)
        m = seen[n // 2] if n % 2 else (seen[n // 2 - 1] + seen[n // 2]) / 2
        out.append(f"{m:.1f}")
    return out

print(*medians_naive([25, 7, 10, 15, 20]))
```

```text filename:Output
25.0 16.0 10.0 12.5 15.0
```

Time O(n² log n) total · Space O(n)

> [!NOTE] Idea
>
> <strong>Two heaps.</strong> Keep the smaller half in a <strong>max-heap</strong> `small` and the larger half in a <strong>min-heap</strong> `large`, with `|small| - |large|` kept at `0` or `1`. The median is then `small.top()` (odd count) or the average of the two tops (even count). Every insertion is two or three heap operations.

1. <strong>Push </strong><strong>`x`</strong><strong> into </strong><strong>`small`</strong>

   The max-heap of the lower half.

2. <strong>Move </strong><strong>`small.top()`</strong><strong> to </strong><strong>`large`</strong>

   Guarantees every element of `small` is `<=` every element of `large`, even if `x` was big.

3. <strong>Rebalance</strong>

   If `large` has more elements than `small`, move `large.top()` back. Now `|small| = |large|` or `|small| = |large| + 1`.

4. <strong>Read the median</strong>

   `small.top()` when `small` is bigger, else `(small.top() + large.top()) / 2`.

```text filename:One%20insertion%20into%20the%20two-heap%20structure
x = 20 arrives (seen: 25 7 10 15)
  small (max-heap) = {10, 7}     large (min-heap) = {15, 25}

1. small.push(20)        small = {20, 10, 7}   large = {15, 25}
2. large.push(small.pop) small = {10, 7}       large = {15, 20, 25}   ← 20 belongs in the upper half
3. |large| > |small|     small = {15, 10, 7}   large = {20, 25}       ← move 15 back
4. |small| > |large|     median = small.top() = 15
```

```python filename:Python
import heapq

def running_medians(stream):
    small, large = [], []                   # small: max-heap via negation; large: min-heap
    out = []
    for x in stream:
        heapq.heappush(small, -x)
        heapq.heappush(large, -heapq.heappop(small))      # largest of small moves up
        if len(large) > len(small):
            heapq.heappush(small, -heapq.heappop(large))  # rebalance: small keeps the extra one
        if len(small) > len(large):
            out.append(f"{-small[0]:.1f}")
        else:
            out.append(f"{(-small[0] + large[0]) / 2:.1f}")
    return out

print(*running_medians([25, 7, 10, 15, 20]))
```

```cpp filename:C%2B%2B
#include <functional>
#include <iomanip>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

int main() {
    vector<int> stream = {25, 7, 10, 15, 20};
    priority_queue<int> small;                                 // max-heap: lower half
    priority_queue<int, vector<int>, greater<int>> large;      // min-heap: upper half
    cout << fixed << setprecision(1);
    bool firstOut = true;
    for (int x : stream) {
        small.push(x);
        large.push(small.top()); small.pop();                  // largest of small moves up
        if (large.size() > small.size()) { small.push(large.top()); large.pop(); }   // rebalance
        double median = small.size() > large.size() ? small.top() : (small.top() + large.top()) / 2.0;
        cout << (firstOut ? "" : " ") << median;
        firstOut = false;
    }
    cout << "\n";
}
```

```java filename:Java
import java.util.Collections;
import java.util.Locale;
import java.util.PriorityQueue;

public class Main {
    public static void main(String[] args) {
        int[] stream = {25, 7, 10, 15, 20};
        PriorityQueue<Integer> small = new PriorityQueue<>(Collections.reverseOrder());   // max-heap: lower half
        PriorityQueue<Integer> large = new PriorityQueue<>();                             // min-heap: upper half
        StringBuilder sb = new StringBuilder();
        for (int x : stream) {
            small.add(x);
            large.add(small.poll());                                   // largest of small moves up
            if (large.size() > small.size()) small.add(large.poll());  // rebalance
            double median = small.size() > large.size() ? small.peek() : (small.peek() + large.peek()) / 2.0;
            sb.append(String.format(Locale.ROOT, "%.1f", median)).append(' ');
        }
        System.out.println(sb.toString().trim());
    }
}
```

```javascript filename:JavaScript
class Heap {
    constructor(cmp = (a, b) => a - b) { this.a = []; this.cmp = cmp; }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        a.push(x);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.cmp(a[i], a[p]) >= 0) break;
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {
                let m = i;
                const l = 2 * i + 1, r = l + 1;
                if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l;
                if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]];
                i = m;
            }
        }
        return top;
    }
}

function runningMedians(stream) {
    const small = new Heap((a, b) => b - a);                  // max-heap: lower half
    const large = new Heap((a, b) => a - b);                  // min-heap: upper half
    const out = [];
    for (const x of stream) {
        small.push(x);
        large.push(small.pop());                              // largest of small moves up
        if (large.size() > small.size()) small.push(large.pop());   // rebalance
        const median = small.size() > large.size() ? small.peek() : (small.peek() + large.peek()) / 2;
        out.push(median.toFixed(1));
    }
    return out;
}

console.log(runningMedians([25, 7, 10, 15, 20]).join(" "));
```

```text filename:Output
25.0 16.0 10.0 12.5 15.0
```

Time O(log n) per element · Space O(n)

> [!NOTE] Key point
>
> An <strong>augmented BST</strong> (each node storing its subtree size, as in the BST topic) also works: insert in `O(h)`, then find the `n/2`-th and `n/2 + 1`-th smallest in `O(h)`. It additionally supports deleting elements (a <em>sliding-window</em> median), which the two heaps cannot do cheaply. For a pure stream the two heaps are simpler and faster.

> [!WARNING] Pitfall
>
> Pushing `x` straight into whichever heap <em>looks</em> right (`x < small.top()` → `small`) and only then rebalancing is also correct, but it has more branches and an empty-heap edge case. The push-then-move routine above has no special cases. And compute the average in floating point (`/ 2.0`): integer division would print `12` for `12.5`.

# Choosing the heap

| Problem | Heap type | Heap size | Time |
| --- | --- | --- | --- |
| k largest / k-th largest | min-heap | `k` | O(n log k) |
| k smallest / k closest | max-heap (on the key) | `k` | O(n log k) |
| sort a k-sorted array | min-heap | `k + 1` | O(n log k) |
| merge k sorted arrays | min-heap of heads | `k` | O(N log k) |
| buy cheapest first / schedule by priority | min-heap of everything | `n` | O(n + r log n) |
| running median | max-heap + min-heap | `n/2` each | O(log n) per element |

> [!TIP] Do
>
> Ask two questions for every heap problem: <em>what key does the heap order by</em> (value, distance, array head) and <em>how large may it grow</em> (`k`, `k + 1`, `n`). The root is always the element you are prepared to discard.

# Interview Q&amp;A

```question
Why is building a heap O(n) when n inserts cost O(n log n)?

---

`heapify` sifts <strong>down</strong> from the last internal node to the root. Most nodes are near the bottom and sift only a step or two; summing `height × nodes-at-that-height` over the tree gives `O(n)`. Pushing one at a time sifts <strong>up</strong> from the bottom, where most nodes have `log n` ancestors — `O(n log n)`.
```

```question
Why a min-heap for the k largest elements?

---

The heap holds the current best `k` and its root is the smallest of them — the only one that can be evicted. A new element either fails to beat that root (ignore it) or replaces it. With a max-heap the root is the best element, which you would never want to evict, so you would have to keep all `n` elements.
```

```question
Heap or balanced BST for a running median?

---

Two heaps: `O(log n)` per element and only the two tops are ever read. A balanced BST augmented with subtree sizes also gives `O(log n)` and can additionally delete elements (sliding-window median) and answer any order statistic, at the price of a far bigger implementation — Python and JavaScript have no built-in ordered set to lean on.
```

```question
How do you get a max-heap in Python, and what is the catch?

---

`heapq` only implements a min-heap, so push `-x` and negate when popping; for records push `(-key, item)` tuples. The catch is forgetting the negation on the way out, and for tuples that ties on the key fall through to comparing the payload — make the payload comparable (an index) or wrap it.
```

```question
Does a priority queue preserve insertion order for equal priorities?

---

No — binary heaps are not stable. If FIFO order among equal priorities matters, store a sequence number as a secondary key: `(priority, seq, item)`. The same trick breaks ties deterministically in the k-closest problem.
```

```question
What are the time bounds of the heap operations and why is search O(n)?

---

`peek` is `O(1)`, `push` and `pop` are `O(log n)` (one root-to-leaf path), `heapify` is `O(n)`. A heap only orders parent against children, so an arbitrary key can be anywhere below the root; finding or deleting it needs a linear scan, or an auxiliary index map (the <em>indexed heap</em> used by Dijkstra's decrease-key).
```
