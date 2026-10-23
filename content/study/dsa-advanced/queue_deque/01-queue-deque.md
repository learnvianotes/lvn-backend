---
id: ace2e5a2-a0ed-7fdb-ac20-32c7f35990c3
key: topic:dsa-advanced/queue_deque
subject: dsa-advanced
topic: queue_deque
title: Queue & Deque
slug: queue-deque
order: 1
---

A queue is <strong>First In, First Out</strong>; a deque (<em>double-ended queue</em>) lets you insert and remove at <strong>both</strong> ends in `O(1)`. The advanced problems here use the queue for breadth-first generation and the deque as a <em>sliding window</em> that keeps only the candidates that can still matter.

> [!INFO]
>
> <strong>Deque</strong> — a linear container with `O(1)` `pushFront`, `pushBack`, `popFront`, `popBack`, `front` and `back`. Restricting it to `pushBack` + `popFront` gives a queue; `pushBack` + `popBack` gives a stack — one structure covers both.

```text filename:A%20deque%3A%20both%20ends%20are%20open
pushFront(x) ──▶ ┌────┬────┬────┬────┬────┐ ◀── pushBack(x)
popFront()   ◀── │ 20 │ 10 │ 15 │ 30 │ 7  │ ──▶ popBack()
                 └────┴────┴────┴────┴────┘
                  front                back
```

# Operations and the built-in containers

| Operation | Python `collections.deque` | C++ `std::deque` | Java `ArrayDeque` | JavaScript |
| --- | --- | --- | --- | --- |
| push back | `append(x)` | `push_back(x)` | `addLast(x)` / `offer(x)` | `arr.push(x)` |
| push front | `appendleft(x)` | `push_front(x)` | `addFirst(x)` / `push(x)` | `arr.unshift(x)` — <strong>O(n)</strong> |
| pop front | `popleft()` | `pop_front()` (+ `front()`) | `pollFirst()` / `poll()` | `arr.shift()` — <strong>O(n)</strong> |
| pop back | `pop()` | `pop_back()` (+ `back()`) | `pollLast()` | `arr.pop()` |
| peek front / back | `dq[0]` / `dq[-1]` | `front()` / `back()` | `peekFirst()` / `peekLast()` | `arr[0]` / `arr[arr.length-1]` |

> [!WARNING] Watch out
>
> JavaScript has no built-in deque. `shift()` and `unshift()` move every element, so a queue built on them is `O(n)` per operation. For small inputs it does not matter (the first two problems below use it for brevity); for real workloads keep a <strong>head index</strong> into the array (`arr[head++]` to dequeue — see the sliding-window solution) or write a small ring-buffer / two-index `Deque` class (see the min/max structure).

Python's `deque`, C++'s `std::deque` and Java's `ArrayDeque` are all `O(1)` at both ends. `std::queue` and `std::stack` are thin adapters over `std::deque`; Java's `Queue` and `Deque` interfaces are both implemented by `ArrayDeque` (prefer it over `LinkedList`, which allocates a node per element).

# Reverse a queue

> [!TIP] Example
>
> <strong>Input:</strong> `q = [20, 10, 15, 30] (20 at the front)`<br><strong>Output:</strong> `30 15 10 20`

> [!NOTE] Idea
>
> A stack reverses order. Dequeue everything into a stack, then pop everything back into the queue: the last element out of the queue is the first one pushed back. Only queue operations (`enqueue`, `dequeue`) and a stack are used — the queue is treated as a black box.

```python filename:Python
from collections import deque

def reverse_queue(q):
    st = []
    while q:
        st.append(q.popleft())     # drain the queue into a stack
    while st:
        q.append(st.pop())         # refill: last out of the queue goes in first

q = deque([20, 10, 15, 30])
reverse_queue(q)
print(*q)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <queue>
#include <stack>
using namespace std;

void reverseQueue(queue<int>& q) {
    stack<int> st;
    while (!q.empty()) { st.push(q.front()); q.pop(); }   // drain the queue into a stack
    while (!st.empty()) { q.push(st.top()); st.pop(); }   // refill: last out goes in first
}

int main() {
    queue<int> q;
    for (int x : {20, 10, 15, 30}) q.push(x);
    reverseQueue(q);
    while (!q.empty()) { cout << q.front() << " "; q.pop(); }
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Queue;

public class Main {
    static void reverseQueue(Queue<Integer> q) {
        Deque<Integer> st = new ArrayDeque<>();
        while (!q.isEmpty()) st.push(q.poll());   // drain the queue into a stack
        while (!st.isEmpty()) q.add(st.pop());    // refill: last out goes in first
    }

    public static void main(String[] args) {
        Queue<Integer> q = new ArrayDeque<>();
        for (int x : new int[]{20, 10, 15, 30}) q.add(x);
        reverseQueue(q);
        StringBuilder sb = new StringBuilder();
        while (!q.isEmpty()) sb.append(q.poll()).append(' ');
        System.out.println(sb.toString().trim());
    }
}
```

```javascript filename:JavaScript
function reverseQueue(q) {
    const st = [];
    while (q.length) st.push(q.shift());     // drain the queue into a stack (shift is O(n) in JS)
    while (st.length) q.push(st.pop());      // refill: last out goes in first
}

const q = [20, 10, 15, 30];
reverseQueue(q);
console.log(q.join(" "));
```

```text filename:Output
30 15 10 20
```

Time O(n) · Space O(n) for the stack

<strong>Recursive version.</strong> The call stack <em>is</em> the stack: dequeue the front, reverse the rest recursively, then enqueue the front at the back. The deepest call enqueues the last element first.

```python filename:Python
from collections import deque

def reverse_queue(q):
    if not q:
        return
    front = q.popleft()      # take the front out …
    reverse_queue(q)         # … reverse the remaining n-1 …
    q.append(front)          # … and put the old front at the back

q = deque([20, 10, 15, 30])
reverse_queue(q)
print(*q)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <queue>
using namespace std;

void reverseQueue(queue<int>& q) {
    if (q.empty()) return;
    int front = q.front(); q.pop();   // take the front out …
    reverseQueue(q);                  // … reverse the remaining n-1 …
    q.push(front);                    // … and put the old front at the back
}

int main() {
    queue<int> q;
    for (int x : {20, 10, 15, 30}) q.push(x);
    reverseQueue(q);
    while (!q.empty()) { cout << q.front() << " "; q.pop(); }
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Queue;

public class Main {
    static void reverseQueue(Queue<Integer> q) {
        if (q.isEmpty()) return;
        int front = q.poll();   // take the front out …
        reverseQueue(q);        // … reverse the remaining n-1 …
        q.add(front);           // … and put the old front at the back
    }

    public static void main(String[] args) {
        Queue<Integer> q = new ArrayDeque<>();
        for (int x : new int[]{20, 10, 15, 30}) q.add(x);
        reverseQueue(q);
        StringBuilder sb = new StringBuilder();
        while (!q.isEmpty()) sb.append(q.poll()).append(' ');
        System.out.println(sb.toString().trim());
    }
}
```

```javascript filename:JavaScript
function reverseQueue(q) {
    if (q.length === 0) return;
    const front = q.shift();   // take the front out …
    reverseQueue(q);           // … reverse the remaining n-1 …
    q.push(front);             // … and put the old front at the back
}

const q = [20, 10, 15, 30];
reverseQueue(q);
console.log(q.join(" "));
```

```text filename:Output
30 15 10 20
```

Time O(n) · Space O(n) call stack

> [!WARNING] Pitfall
>
> The recursive version uses `n` stack frames — Python's default limit is about 1000, so it is a teaching tool, not a production routine. The iterative version has the same complexity without the depth limit.

# Generate the first n numbers with given digits

> [!TIP] Example
>
> <strong>Input:</strong> `n = 10, digits = [5, 6]`<br><strong>Output:</strong> `5 6 55 56 65 66 555 556 565 566`<br><strong>Input:</strong> `n = 7, digits = [1, 2, 3]`<br><strong>Output:</strong> `1 2 3 11 12 13 21`

Print, in increasing order, the first `n` positive integers whose decimal digits all come from the given set.

```python filename:Naive%20%E2%80%94%20test%20every%20natural%20number%3B%20with%20digits%20%7B5%2C%206%7D%20only%202%5Ek%20of%20the%20k-digit%20numbers%20qualify%2C%20so%20this%20gets%20slow%20fast
def only_digits(num, digits):
    while num > 0:
        if num % 10 not in digits:
            return False
        num //= 10
    return True

def first_n_naive(n, digits):
    res, num = [], 1
    while len(res) < n:                 # try 1, 2, 3, … and keep the ones that qualify
        if only_digits(num, digits):
            res.append(num)
        num += 1
    return res

print(*first_n_naive(10, [5, 6]))
```

```text filename:Output
5 6 55 56 65 66 555 556 565 566
```

> [!NOTE] Idea
>
> The valid numbers form a <strong>tree</strong>: the children of `x` are `x` with each allowed digit appended. A breadth-first traversal of that tree visits the numbers <em>in increasing order</em> — all 1-digit numbers, then all 2-digit numbers (smaller prefixes first), and so on. BFS is a queue: start with the single digits, repeatedly dequeue a number, print it, and enqueue its children. Each dequeue produces exactly one answer, so the loop runs `n` times.

```text filename:BFS%20order%20of%20the%20digit%20tree%20is%20numeric%20order%2C%20because%20every%20level%20is%20one%20digit%20longer%20and%20siblings%20are%20enqueued%20smallest-first
           (root)
        /          \
       5            6                 ← dequeued 1st, 2nd
     /   \        /   \
   55     56    65     66             ← 3rd … 6th
  /  \   /  \
555 556 565 566 …                     ← 7th … 10th
```

```python filename:Python
from collections import deque

def first_n(n, digits):
    q = deque(str(d) for d in sorted(digits))   # level 1: the single digits, smallest first
    res = []
    while len(res) < n:
        cur = q.popleft()
        res.append(cur)
        for d in sorted(digits):
            q.append(cur + str(d))              # children: one digit longer
    return res

print(*first_n(10, [5, 6]))
print(*first_n(7, [1, 2, 3]))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <queue>
#include <string>
#include <vector>
using namespace std;

vector<string> firstN(int n, vector<int> digits) {
    sort(digits.begin(), digits.end());
    queue<string> q;
    for (int d : digits) q.push(to_string(d));     // level 1: the single digits, smallest first
    vector<string> res;
    while ((int)res.size() < n) {
        string cur = q.front(); q.pop();
        res.push_back(cur);
        for (int d : digits) q.push(cur + to_string(d));   // children: one digit longer
    }
    return res;
}

int main() {
    for (const string& s : firstN(10, {5, 6})) cout << s << " ";
    cout << "\n";
    for (const string& s : firstN(7, {1, 2, 3})) cout << s << " ";
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Queue;

public class Main {
    static List<String> firstN(int n, int[] digits) {
        Arrays.sort(digits);
        Queue<String> q = new ArrayDeque<>();
        for (int d : digits) q.add(String.valueOf(d));   // level 1: the single digits, smallest first
        List<String> res = new ArrayList<>();
        while (res.size() < n) {
            String cur = q.poll();
            res.add(cur);
            for (int d : digits) q.add(cur + d);          // children: one digit longer
        }
        return res;
    }

    public static void main(String[] args) {
        System.out.println(String.join(" ", firstN(10, new int[]{5, 6})));
        System.out.println(String.join(" ", firstN(7, new int[]{1, 2, 3})));
    }
}
```

```javascript filename:JavaScript
function firstN(n, digits) {
    digits = [...digits].sort((a, b) => a - b);
    const q = digits.map(String);                  // level 1: the single digits, smallest first
    const res = [];
    while (res.length < n) {
        const cur = q.shift();
        res.push(cur);
        for (const d of digits) q.push(cur + d);   // children: one digit longer
    }
    return res;
}

console.log(firstN(10, [5, 6]).join(" "));
console.log(firstN(7, [1, 2, 3]).join(" "));
```

```text filename:Output
5 6 55 56 65 66 555 556 565 566
1 2 3 11 12 13 21
```

Time O(n × k) for k allowed digits · Space O(n × k) queue

> [!NOTE] Key point
>
> Work with <strong>strings</strong>, not integers: appending a digit is string concatenation, and the numbers quickly exceed 64 bits (the 20th number with digits {5, 6} already has 5 digits; the 10 000th has 13). The original notes hard-coded `'5'` and `'6'`; the version above takes any digit set and sorts it so BFS order is numeric order.

# Data structure with min/max operations

Design a structure supporting all of the following in `O(1)`: `insertMin(x)`, `insertMax(x)`, `getMin()`, `getMax()`, `extractMin()`, `extractMax()`.

> [!TIP] Example
>
> <strong>Input:</strong> `insertMin(5), insertMax(10), insertMin(3), insertMax(12); getMin, getMax, extractMin, getMin, extractMax, getMax`<br><strong>Output:</strong> `3 12 3 5 12 10`

> [!NOTE] Idea
>
> `insertMin(x)` is only ever called with a value that <strong>is</strong> the new minimum, and `insertMax(x)` only with the new maximum — that contract is what makes `O(1)` possible (a general priority queue needs `O(log n)`). So keep the elements <strong>sorted in a deque</strong>: the minimum lives at the front, the maximum at the back. `insertMin` = `pushFront`, `insertMax` = `pushBack`, `getMin`/`getMax` = `front`/`back`, `extractMin`/`extractMax` = `popFront`/`popBack`. Every operation is one deque operation.

```text filename:The%20deque%20stays%20sorted%20because%20insertMin%2FinsertMax%20only%20ever%20add%20at%20the%20correct%20end
insertMin(5)      [5]
insertMax(10)     [5, 10]
insertMin(3)      [3, 5, 10]          ← front is always the min
insertMax(12)     [3, 5, 10, 12]      ← back is always the max
extractMin() → 3  [5, 10, 12]
extractMax() → 12 [5, 10]
```

```python filename:Python
from collections import deque

class MinMaxStructure:
    def __init__(self):
        self.dq = deque()            # kept sorted: front = min, back = max

    def insert_min(self, x):         # contract: x <= current min
        self.dq.appendleft(x)

    def insert_max(self, x):         # contract: x >= current max
        self.dq.append(x)

    def get_min(self):
        return self.dq[0]

    def get_max(self):
        return self.dq[-1]

    def extract_min(self):
        return self.dq.popleft()

    def extract_max(self):
        return self.dq.pop()

s = MinMaxStructure()
s.insert_min(5)
s.insert_max(10)
s.insert_min(3)
s.insert_max(12)
print("getMin:", s.get_min())
print("getMax:", s.get_max())
print("extractMin:", s.extract_min())
print("getMin:", s.get_min())
print("extractMax:", s.extract_max())
print("getMax:", s.get_max())
```

```cpp filename:C%2B%2B
#include <deque>
#include <iostream>
using namespace std;

class MinMaxStructure {
    deque<int> dq;                   // kept sorted: front = min, back = max
public:
    void insertMin(int x) { dq.push_front(x); }   // contract: x <= current min
    void insertMax(int x) { dq.push_back(x); }    // contract: x >= current max
    int getMin() const { return dq.front(); }
    int getMax() const { return dq.back(); }
    int extractMin() { int x = dq.front(); dq.pop_front(); return x; }
    int extractMax() { int x = dq.back(); dq.pop_back(); return x; }
};

int main() {
    MinMaxStructure s;
    s.insertMin(5);
    s.insertMax(10);
    s.insertMin(3);
    s.insertMax(12);
    cout << "getMin: " << s.getMin() << "\n";
    cout << "getMax: " << s.getMax() << "\n";
    cout << "extractMin: " << s.extractMin() << "\n";
    cout << "getMin: " << s.getMin() << "\n";
    cout << "extractMax: " << s.extractMax() << "\n";
    cout << "getMax: " << s.getMax() << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static class MinMaxStructure {
        Deque<Integer> dq = new ArrayDeque<>();     // kept sorted: front = min, back = max
        void insertMin(int x) { dq.addFirst(x); }   // contract: x <= current min
        void insertMax(int x) { dq.addLast(x); }    // contract: x >= current max
        int getMin() { return dq.peekFirst(); }
        int getMax() { return dq.peekLast(); }
        int extractMin() { return dq.pollFirst(); }
        int extractMax() { return dq.pollLast(); }
    }

    public static void main(String[] args) {
        MinMaxStructure s = new MinMaxStructure();
        s.insertMin(5);
        s.insertMax(10);
        s.insertMin(3);
        s.insertMax(12);
        System.out.println("getMin: " + s.getMin());
        System.out.println("getMax: " + s.getMax());
        System.out.println("extractMin: " + s.extractMin());
        System.out.println("getMin: " + s.getMin());
        System.out.println("extractMax: " + s.extractMax());
        System.out.println("getMax: " + s.getMax());
    }
}
```

```javascript filename:JavaScript
class Deque {                        // O(1) at both ends: indices grow outwards from 0
    constructor() { this.items = {}; this.head = 0; this.tail = 0; }   // tail = one past the last
    pushFront(x) { this.items[--this.head] = x; }
    pushBack(x) { this.items[this.tail++] = x; }
    popFront() { const x = this.items[this.head]; delete this.items[this.head++]; return x; }
    popBack() { const x = this.items[--this.tail]; delete this.items[this.tail]; return x; }
    front() { return this.items[this.head]; }
    back() { return this.items[this.tail - 1]; }
    get size() { return this.tail - this.head; }
}

class MinMaxStructure {
    constructor() { this.dq = new Deque(); }       // kept sorted: front = min, back = max
    insertMin(x) { this.dq.pushFront(x); }         // contract: x <= current min
    insertMax(x) { this.dq.pushBack(x); }          // contract: x >= current max
    getMin() { return this.dq.front(); }
    getMax() { return this.dq.back(); }
    extractMin() { return this.dq.popFront(); }
    extractMax() { return this.dq.popBack(); }
}

const s = new MinMaxStructure();
s.insertMin(5);
s.insertMax(10);
s.insertMin(3);
s.insertMax(12);
console.log("getMin:", s.getMin());
console.log("getMax:", s.getMax());
console.log("extractMin:", s.extractMin());
console.log("getMin:", s.getMin());
console.log("extractMax:", s.extractMax());
console.log("getMax:", s.getMax());
```

```text filename:Output
getMin: 3
getMax: 12
extractMin: 3
getMin: 5
extractMax: 12
getMax: 10
```

Time O(1) per operation · Space O(n)

> [!WARNING] Pitfall
>
> State the contract out loud in an interview: this structure is correct <strong>only if</strong> `insertMin` is always given a value no larger than the current minimum and `insertMax` a value no smaller than the current maximum (the original notes called it a 'MinMaxStack' and did not say so). Insert `7` into `[3, 5, 10, 12]` through either method and the sorted order — and every later answer — is wrong. For arbitrary inserts you need a min-max heap or two heaps (`O(log n)`).

# Maximums of all subarrays of size k (sliding window maximum)

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 8, 5, 12, 15, 7, 6], k = 3`<br><strong>Output:</strong> `10 12 15 15 15`

For every window of `k` consecutive elements, print its maximum. The windows here are `[10,8,5]`, `[8,5,12]`, `[5,12,15]`, `[12,15,7]`, `[15,7,6]`.

```python filename:Naive%20%E2%80%94%20O(n%C2%B7k)%3A%20recompute%20the%20maximum%20of%20every%20window
def window_max_naive(arr, k):
    res = []
    for i in range(len(arr) - k + 1):
        res.append(max(arr[i:i + k]))    # rescan each window
    return res

print(*window_max_naive([10, 8, 5, 12, 15, 7, 6], 3))
```

```text filename:Output
10 12 15 15 15
```

> [!NOTE] Idea
>
> Keep a deque of <strong>indices</strong> whose values are <strong>decreasing</strong> from front to back — the monotonic-stack idea from the Stack topic, with one extra operation. When `arr[i]` arrives, pop from the <strong>back</strong> every index whose value is `<= arr[i]` (they can never be a window maximum again: `arr[i]` is bigger and will outlive them). Push `i` at the back. Pop from the <strong>front</strong> the index that has slid out of the window (`front <= i − k`). The front is now the maximum of the current window. The deque is the set of elements that are still <em>useful</em> — each is the maximum of the suffix of the window that starts at it.

```text filename:Front%20of%20the%20deque%20%3D%20maximum%20of%20the%20current%20window%3B%20every%20index%20enters%20and%20leaves%20at%20most%20once
arr = [10, 8, 5, 12, 15, 7, 6], k = 3        deque holds indices; shown as values

i  arr[i]  pop back while <= arr[i]   push   drop front if out of window   deque (values)   window max
0   10     –                          0      –                             [10]             (window not full)
1    8     –                          1      –                             [10, 8]          (window not full)
2    5     –                          2      –                             [10, 8, 5]       10
3   12     5, 8, 10                   3      –                             [12]             12
4   15     12                         4      –                             [15]             15
5    7     –                          5      –                             [15, 7]          15
6    6     –                          6      index 4 still inside          [15, 7, 6]       15
```

```python filename:Python
from collections import deque

def window_max(arr, k):
    dq = deque()                 # indices; arr values decreasing front → back
    res = []
    for i in range(len(arr)):
        while dq and arr[dq[-1]] <= arr[i]:   # smaller-or-equal older elements are useless now
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:                    # front has slid out of the window
            dq.popleft()
        if i >= k - 1:                        # window is full: front is its maximum
            res.append(arr[dq[0]])
    return res

print(*window_max([10, 8, 5, 12, 15, 7, 6], 3))
```

```cpp filename:C%2B%2B
#include <deque>
#include <iostream>
#include <vector>
using namespace std;

vector<int> windowMax(const vector<int>& arr, int k) {
    deque<int> dq;               // indices; arr values decreasing front → back
    vector<int> res;
    int n = arr.size();
    for (int i = 0; i < n; i++) {
        while (!dq.empty() && arr[dq.back()] <= arr[i]) dq.pop_back();   // useless now
        dq.push_back(i);
        if (dq.front() <= i - k) dq.pop_front();   // front has slid out of the window
        if (i >= k - 1) res.push_back(arr[dq.front()]);   // window is full: front is its max
    }
    return res;
}

int main() {
    for (int x : windowMax({10, 8, 5, 12, 15, 7, 6}, 3)) cout << x << " ";
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int[] windowMax(int[] arr, int k) {
        Deque<Integer> dq = new ArrayDeque<>();   // indices; arr values decreasing front → back
        int n = arr.length;
        int[] res = new int[n - k + 1];
        for (int i = 0; i < n; i++) {
            while (!dq.isEmpty() && arr[dq.peekLast()] <= arr[i]) dq.pollLast();   // useless now
            dq.addLast(i);
            if (dq.peekFirst() <= i - k) dq.pollFirst();   // front has slid out of the window
            if (i >= k - 1) res[i - k + 1] = arr[dq.peekFirst()];   // window full: front is its max
        }
        return res;
    }

    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        for (int x : windowMax(new int[]{10, 8, 5, 12, 15, 7, 6}, 3)) sb.append(x).append(' ');
        System.out.println(sb.toString().trim());
    }
}
```

```javascript filename:JavaScript
function windowMax(arr, k) {
    const dq = [];               // indices; arr values decreasing front → back
    let head = 0;                // dq[head] is the front — no O(n) shift()
    const res = [];
    for (let i = 0; i < arr.length; i++) {
        while (dq.length > head && arr[dq[dq.length - 1]] <= arr[i]) dq.pop();   // useless now
        dq.push(i);
        if (dq[head] <= i - k) head++;                 // front has slid out of the window
        if (i >= k - 1) res.push(arr[dq[head]]);       // window is full: front is its maximum
    }
    return res;
}

console.log(windowMax([10, 8, 5, 12, 15, 7, 6], 3).join(" "));
```

```text filename:Output
10 12 15 15 15
```

Time O(n) — each index is pushed and popped at most once · Space O(k) for the deque

> [!WARNING] Pitfall
>
> Store <strong>indices</strong>, not values — you need the index to know when the front has left the window. And pop from the back on `<=`, not `<`: an older <em>equal</em> element leaves the window earlier than the new one, so keeping it would only make the deque longer. The first `k − 1` iterations do not emit anything; the original notes handled that with a separate warm-up loop, the version above folds it into one loop with the `i >= k − 1` test.

> [!NOTE] Variants
>
> The same deque gives the <strong>sliding window minimum</strong> by flipping the comparison to `>=`. It is also the engine behind `O(n)` solutions for <em>shortest subarray with sum at least k</em> and the monotonic-queue optimisation of some DP recurrences.

# First circular tour (petrol pumps)

> [!TIP] Example
>
> <strong>Input:</strong> `petrol = [4, 8, 7, 4], dist = [6, 5, 3, 5] (pumps numbered from 1)`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `petrol = [1, 2, 3], dist = [3, 3, 3]`<br><strong>Output:</strong> `-1`

`n` petrol pumps sit on a circle. Pump `i` offers `petrol[i]` litres, and `dist[i]` litres are burned driving from pump `i` to pump `i + 1`. Starting with an empty tank, find the first pump from which a truck can complete the full circle, or report that none exists. Here the net gain at each pump is `-2, 3, 4, -1`; starting at pump 2 the tank reads `3 → 7 → 6 → 4`, never negative.

```python filename:Naive%20%E2%80%94%20O(n%C2%B2)%3A%20simulate%20the%20circle%20from%20every%20start
def first_tour_naive(petrol, dist):
    n = len(petrol)
    for start in range(n):             # try every start …
        fuel, i = 0, start
        while True:                    # … and simulate the whole circle
            fuel += petrol[i] - dist[i]
            if fuel < 0:
                break
            i = (i + 1) % n
            if i == start:
                return start + 1
    return -1

print(first_tour_naive([4, 8, 7, 4], [6, 5, 3, 5]))
print(first_tour_naive([1, 2, 3], [3, 3, 3]))
```

```text filename:Output
2
-1
```

> [!NOTE] Idea
>
> Think of the visited pumps as a <strong>queue</strong>. If the tank goes negative on reaching pump `i` after starting at `s`, then every start between `s` and `i` fails too: the tank was non-negative on arrival at each of them, so starting there with an <em>empty</em> tank only makes things worse. Dequeue them all at once — the next candidate start is `i + 1`. Each pump is enqueued (visited as part of a tour) and dequeued (ruled out) at most once, so one pass suffices. Finally, the candidate that survives to the end is valid only if the <strong>total</strong> surplus (what it gains after its start plus the deficit of the skipped prefix it still has to cross) is `>= 0`.

1. <strong>Scan once</strong>

   Keep `start = 0`, `fuel = 0` (fuel since `start`) and `deficit = 0` (total shortfall of all ruled-out prefixes).

2. <strong>On a negative tank at pump i</strong>

   Everything from `start` to `i` is ruled out: `deficit += fuel`, `start = i + 1`, `fuel = 0`.

3. <strong>At the end</strong>

   `start` completes the circle only if `fuel + deficit >= 0` — the surplus it collects from `start` to `n − 1` must cover the deficit of the wrapped-around prefix. Otherwise no pump works (equivalently, `sum(petrol) < sum(dist)`).

```python filename:Python
def first_tour(petrol, dist):
    start, fuel, deficit = 0, 0, 0
    for i in range(len(petrol)):
        fuel += petrol[i] - dist[i]
        if fuel < 0:                 # pumps start..i are all ruled out at once
            deficit += fuel          # remember how short that stretch was
            start = i + 1
            fuel = 0
    return start + 1 if fuel + deficit >= 0 else -1   # 1-based pump number

print(first_tour([4, 8, 7, 4], [6, 5, 3, 5]))
print(first_tour([1, 2, 3], [3, 3, 3]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int firstTour(const vector<int>& petrol, const vector<int>& dist) {
    int start = 0, fuel = 0, deficit = 0;
    int n = petrol.size();
    for (int i = 0; i < n; i++) {
        fuel += petrol[i] - dist[i];
        if (fuel < 0) {              // pumps start..i are all ruled out at once
            deficit += fuel;         // remember how short that stretch was
            start = i + 1;
            fuel = 0;
        }
    }
    return fuel + deficit >= 0 ? start + 1 : -1;   // 1-based pump number
}

int main() {
    cout << firstTour({4, 8, 7, 4}, {6, 5, 3, 5}) << "\n";
    cout << firstTour({1, 2, 3}, {3, 3, 3}) << "\n";
}
```

```java filename:Java
public class Main {
    static int firstTour(int[] petrol, int[] dist) {
        int start = 0, fuel = 0, deficit = 0;
        for (int i = 0; i < petrol.length; i++) {
            fuel += petrol[i] - dist[i];
            if (fuel < 0) {              // pumps start..i are all ruled out at once
                deficit += fuel;         // remember how short that stretch was
                start = i + 1;
                fuel = 0;
            }
        }
        return fuel + deficit >= 0 ? start + 1 : -1;   // 1-based pump number
    }

    public static void main(String[] args) {
        System.out.println(firstTour(new int[]{4, 8, 7, 4}, new int[]{6, 5, 3, 5}));
        System.out.println(firstTour(new int[]{1, 2, 3}, new int[]{3, 3, 3}));
    }
}
```

```javascript filename:JavaScript
function firstTour(petrol, dist) {
    let start = 0, fuel = 0, deficit = 0;
    for (let i = 0; i < petrol.length; i++) {
        fuel += petrol[i] - dist[i];
        if (fuel < 0) {                  // pumps start..i are all ruled out at once
            deficit += fuel;             // remember how short that stretch was
            start = i + 1;
            fuel = 0;
        }
    }
    return fuel + deficit >= 0 ? start + 1 : -1;   // 1-based pump number
}

console.log(firstTour([4, 8, 7, 4], [6, 5, 3, 5]));
console.log(firstTour([1, 2, 3], [3, 3, 3]));
```

```text filename:Output
2
-1
```

Time O(n) · Space O(1)

> [!NOTE] Key point
>
> <strong>Why the final check is enough.</strong> If `sum(petrol) >= sum(dist)` a tour always exists, and the scan above finds the <em>first</em> one: every start before `start` was explicitly ruled out, and `start` itself never ran dry on the stretch to the end; wrapping around, it meets the ruled-out prefixes with `fuel` in the tank, and `fuel + deficit >= 0` says that is enough. The explicit queue version (two indices `start`, `end` walking around the circle, dequeuing from the front while the tank is negative) is the same argument spelled out with `(end + 1) % n` arithmetic.

> [!WARNING] Pitfall
>
> The answer is the pump <strong>number</strong>, and the original notes count from 1 (`start + 1`); many online judges count from 0. Say which convention you use. Also do not forget the `-1` case — with `start` ending at `n` (every pump ruled out) the `start + 1` formula would otherwise return a nonsense `n + 1`.

# Interview Q&amp;A

```question
Queue vs deque vs priority queue — when do I use which?

---

A queue when the order of processing is the order of arrival (BFS, task scheduling). A deque when you also need the other end: sliding windows, work-stealing, palindromes, undo/redo with a bounded history. A priority queue when the next element is determined by a key, not by position — it costs `O(log n)` per operation instead of `O(1)`.
```

```question
Why is the sliding window maximum O(n) if there is a while loop inside the for loop?

---

Every index is appended once and removed at most once (from the back by a bigger element, or from the front by sliding out). Total deque operations are at most `2n`, so the amortised cost per element is constant — the same argument as for the monotonic stack.
```

```question
How would you implement a deque yourself?

---

A circular array with `head` and `tail` indices (and either a `size` counter or one wasted slot to tell full from empty) gives `O(1)` at both ends with cache-friendly storage; grow by doubling when full. A doubly linked list also works but spends a node per element. `collections.deque` uses blocks of 64 pointers in a doubly linked list of blocks; `ArrayDeque` is a circular array.
```

```question
How would you generate the numbers in the digit problem without a queue?

---

Treat the index as a counter in base `k` (the number of digits) with a bijective numeration: the `m`-th number's digits are the base-`k` representation of `m` with digits mapped through the sorted digit set. That is `O(log m)` per number and needs no memory — but the BFS version is the one interviewers expect first, because it generalises to any 'generate in order by extending' problem.
```

```question
Why does the petrol-pump argument rule out all pumps between the start and the failure point?

---

Suppose the tour from `s` first goes negative on arriving at `i`. For any `s < t <= i`, the tank on arrival at `t` (from `s`) was non-negative, so starting at `t` with an empty tank gives at every later pump at most the fuel the `s`-tour had there — and that went negative at `i`. So `t` fails too, and the next possible start is `i + 1`.
```
