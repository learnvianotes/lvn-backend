---
id: 24474362-6a26-77e9-8d4b-ee5b90c7994d
key: topic:dsa-basics/heap
subject: dsa-basics
topic: heap
title: Binary Heap
slug: binary-heap
order: 1
---

A binary heap is a <strong>complete binary tree stored in a plain array</strong> in which every parent is smaller (min-heap) or larger (max-heap) than its children. It gives the minimum in `O(1)` and insert / extract-min in `O(log n)` with no pointers at all — it is the structure behind every priority queue and heap sort.

> [!INFO]
>
> <strong>Binary heap</strong> — an array `a` viewed as a complete binary tree — `a[0]` is the root, the children of `a[i]` are `a[2i + 1]` and `a[2i + 2]` — that satisfies the <strong>heap property</strong>: in a <strong>min-heap</strong> every node is ≤ its children (so the minimum is at the root); in a <strong>max-heap</strong> every node is ≥ its children (the maximum is at the root).

```text filename:A%20min-heap%3A%20the%20array%20is%20the%20tree%2C%20read%20level%20by%20level%2C%20left%20to%20right
index:   0     1     2     3     4     5
       ┌─────┬─────┬─────┬─────┬─────┬─────┐
       │  2  │  3  │ 15  │  5  │  4  │ 45  │        parent(i) = (i − 1) / 2
       └─────┴─────┴─────┴─────┴─────┴─────┘        left(i)   = 2i + 1
                                                    right(i)  = 2i + 2
                     2 [0]
                   /      \
               3 [1]       15 [2]         e.g. 15 at index 2: parent (2−1)/2 = 0 → 2
              /    \       /                               left 2·2+1 = 5 → 45
          5 [3]   4 [4]  45 [5]                           right 2·2+2 = 6 → none
```

Used in <strong>heap sort</strong> and to implement a <strong>priority queue</strong> — the data structure of <em>always give me the most urgent item</em>: Dijkstra's and Prim's algorithms, Huffman coding, event schedulers, the <em>k largest</em> and <em>running median</em> problems.

# A complete binary tree stored as an array

The array trick only works because a heap is a <strong>complete</strong> binary tree: every level is full except possibly the last, and that one is filled strictly from left to right. Reading such a tree level by level leaves <strong>no gaps</strong>, so position in the array ↔ position in the tree, and the parent/child relations become arithmetic.

```text filename:Every%20level%20must%20be%20filled%20from%20left%20to%20right%20with%20no%20gap
    COMPLETE                          NOT COMPLETE
       ●                                  ●
     /   \                              /   \
    ●     ●                            ●     ●
   / \                                  \
  ●   ●                                  ●      ← the last level has a gap on its left:
                                                  index 3 would be empty while index 4 is used
array: ● ● ● ● ●  (indices 0–4)        the array would need a hole → not a heap shape
```

| Relation | 0-based array (used here) | 1-based array (the notes' first version) |
| --- | --- | --- |
| Root | `a[0]` | `a[1]` |
| Parent of `i` | `(i − 1) / 2` (integer division) | `i / 2` |
| Left child of `i` | `2i + 1` | `2i` |
| Right child of `i` | `2i + 2` | `2i + 1` |
| Leaves | indices `n/2 … n − 1` | indices `n/2 + 1 … n` |
| Last internal node | `n/2 − 1` | `n/2` |

Because a complete tree of `n` nodes has height `⌊log₂ n⌋`, every root-to-leaf walk — which is what insert and extract do — takes `O(log n)` steps. And because there are no pointers, a heap of `n` ints is exactly `n` ints of memory, laid out contiguously and cache-friendly.

> [!NOTE] Key point
>
> A heap is <strong>not</strong> a search structure. The heap property says nothing about the relation between the two subtrees of a node — `15` is left of `5` in the example above — so finding an arbitrary value is `O(n)`. If you need search <em>and</em> min/max, use a balanced BST.

# Min-heap and max-heap

|  | Min-heap | Max-heap |
| --- | --- | --- |
| Heap property | every node <strong>≤</strong> its children (and so ≤ all its descendants) | every node <strong>≥</strong> its children |
| Root holds | the minimum | the maximum |
| Priority queue | the item with the <strong>lowest</strong> value has the highest priority | the item with the <strong>highest</strong> value has the highest priority |
| Default in | Python `heapq`, Java `PriorityQueue` | C++ `std::priority_queue` |

Everything below is written for a min-heap; a max-heap is the same code with every comparison flipped — or, cheaper, a min-heap of the <strong>negated</strong> values.

<strong>Which of these are min-heaps?</strong> (from the notes)

```text filename:Both%20conditions%20are%20needed%3A%20the%20shape%20(complete)%20and%20the%20order%20(heap%20property)
(a)       10                        (b)        10
        /    \                               /    \
      20      30                           40      50
              /                           /  \
            40                          44    100

(a) NOT a heap — 40 hangs under 30 while 20 has no child, so the last level is not
    filled left to right: the tree is not complete (array would be 10 20 30 _ _ 40).
(b) a min-heap — complete, and 10 ≤ 40, 50;  40 ≤ 44, 100.
```

# Operations and their cost

| Operation | How | Time | Why |
| --- | --- | --- | --- |
| `getMin()` / `peek()` | Return `a[0]` | O(1) | The root is always the minimum |
| `insert(x)` | Append at the end, then <strong>sift up</strong> while smaller than the parent | O(log n) | Climbs at most the height of the tree |
| `extractMin()` | Move the last element to the root, then <strong>sift down</strong> (heapify) | O(log n) | Descends at most the height |
| `decreaseKey(i, x)` | Lower `a[i]` to `x`, then sift up | O(log n) | Only the path to the root can be violated |
| `delete(i)` | `decreaseKey(i, −∞)` then `extractMin()` | O(log n) | Two logarithmic steps |
| `buildHeap(arr)` | Heapify every internal node from the last one up to the root | <strong>O(n)</strong> | Most nodes are near the bottom and move only a few levels |
| search for a value | Scan the array | O(n) | No ordering between siblings |

# Insert (sift up)

> [!TIP] Example
>
> <strong>Input:</strong> `insert 3, 2, 15, 5, 4, 45 into an empty min-heap`<br><strong>Output:</strong> `array 2 3 15 5 4 45 — min 2`

> [!NOTE] Idea
>
> Put the new element in the <strong>first free slot</strong> (`a[n]`) — that keeps the tree complete. The only thing that can now be wrong is that the new element is smaller than its parent, so <strong>swap it upward</strong> until its parent is smaller or it reaches the root. Each swap fixes the pair without disturbing anything else, and the walk is at most `h = ⌊log₂ n⌋` steps.

```text filename:Sift%20up%3A%20compare%20with%20the%20parent%2C%20swap%20while%20smaller
insert 2 into [3]:          append at the end        2 < parent 3: swap

      3          ──────▶         3          ──────▶         2
                                /                          /
                               2                          3

insert 4 into [2, 3, 15, 5]:  append at index 4; parent is index 1 (3) ≤ 4 → stop

      2                       2
    /   \       ──────▶     /   \
   3     15                3     15        array: 2 3 15 5 4
  /                       / \
 5                       5   4
```

```python filename:Python
class MinHeap:
    def __init__(self):
        self.a = []

    def parent(self, i):
        return (i - 1) // 2

    def insert(self, x):
        a = self.a
        a.append(x)                              # 1. first free slot: tree stays complete
        i = len(a) - 1
        while i > 0 and a[self.parent(i)] > a[i]:   # 2. sift up while the parent is larger
            p = self.parent(i)
            a[i], a[p] = a[p], a[i]
            i = p

    def get_min(self):
        return self.a[0]

h = MinHeap()
for x in (3, 2, 15, 5, 4, 45):
    h.insert(x)
    print(f"insert {x}:", *h.a)
print("min:", h.get_min())
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

class MinHeap {
    vector<int> a;
public:
    int parent(int i) { return (i - 1) / 2; }

    void insert(int x) {
        a.push_back(x);                              // 1. first free slot: tree stays complete
        int i = (int)a.size() - 1;
        while (i > 0 && a[parent(i)] > a[i]) {       // 2. sift up while the parent is larger
            swap(a[i], a[parent(i)]);
            i = parent(i);
        }
    }

    int getMin() { return a[0]; }
    void print() { for (int x : a) cout << x << " "; cout << "\n"; }
};

int main() {
    MinHeap h;
    for (int x : {3, 2, 15, 5, 4, 45}) {
        h.insert(x);
        cout << "insert " << x << ": "; h.print();
    }
    cout << "min: " << h.getMin() << "\n";
}
```

```java filename:Java
import java.util.ArrayList;

public class Main {
    static class MinHeap {
        ArrayList<Integer> a = new ArrayList<>();

        int parent(int i) { return (i - 1) / 2; }

        void swap(int i, int j) { int t = a.get(i); a.set(i, a.get(j)); a.set(j, t); }

        void insert(int x) {
            a.add(x);                                    // 1. first free slot: tree stays complete
            int i = a.size() - 1;
            while (i > 0 && a.get(parent(i)) > a.get(i)) {   // 2. sift up while the parent is larger
                swap(i, parent(i));
                i = parent(i);
            }
        }

        int getMin() { return a.get(0); }
        void print() { StringBuilder sb = new StringBuilder(); for (int x : a) sb.append(x).append(' '); System.out.println(sb.toString().trim()); }
    }

    public static void main(String[] args) {
        MinHeap h = new MinHeap();
        for (int x : new int[]{3, 2, 15, 5, 4, 45}) {
            h.insert(x);
            System.out.print("insert " + x + ": "); h.print();
        }
        System.out.println("min: " + h.getMin());
    }
}
```

```javascript filename:JavaScript
class MinHeap {
    constructor() { this.a = []; }

    parent(i) { return Math.floor((i - 1) / 2); }

    insert(x) {
        const a = this.a;
        a.push(x);                                   // 1. first free slot: tree stays complete
        let i = a.length - 1;
        while (i > 0 && a[this.parent(i)] > a[i]) {  // 2. sift up while the parent is larger
            const p = this.parent(i);
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }

    getMin() { return this.a[0]; }
}

const h = new MinHeap();
for (const x of [3, 2, 15, 5, 4, 45]) {
    h.insert(x);
    console.log(`insert ${x}:`, h.a.join(" "));
}
console.log("min:", h.getMin());
```

```text filename:Output
insert 3: 3
insert 2: 2 3
insert 15: 2 3 15
insert 5: 2 3 15 5
insert 4: 2 3 15 5 4
insert 45: 2 3 15 5 4 45
min: 2
```

Time O(log n) · Space O(1)

> [!WARNING] Pitfall
>
> In JavaScript `(i - 1) / 2` is a <strong>float</strong> — `Math.floor` is required. In Python use `//`. Forgetting this gives fractional indices and a heap that silently never sifts.

# Extract min (sift down / heapify)

> [!TIP] Example
>
> <strong>Input:</strong> `the heap 2 3 15 5 4 45`<br><strong>Output:</strong> `returns 2; heap becomes 3 4 15 5 45`<br><strong>Input:</strong> `extract again`<br><strong>Output:</strong> `returns 3; heap becomes 4 5 15 45`

> [!NOTE] Idea
>
> The minimum is the root, but removing the root leaves a hole at the top and a complete tree can only lose its <strong>last</strong> slot. So: save `a[0]`, move the <strong>last</strong> element into the root, shrink the array by one. The only violation now is at the root, which may be larger than a child — <strong>sift it down</strong>: swap it with the <em>smaller</em> of its two children (so the new parent is ≤ both) and repeat from there until it is ≤ both children or becomes a leaf. This repair step is `minHeapify(i)` — it assumes both subtrees of `i` are valid heaps and fixes node `i`.

```text filename:Extract-min%20moves%20the%20last%20element%20to%20the%20root%20and%20sifts%20it%20down%20along%20one%20path
heap 2 3 15 5 4 45        take out 2,        heapify(0): smaller child of 45    heapify(1): smaller child
                          move 45 to root     is 3 → swap                        of 45 is 4 → swap
       2                       45                      3                              3
     /   \                   /    \                  /   \                          /   \
    3     15                3      15              45     15                       4     15
   / \   /                 / \                    / \                            / \
  5   4 45                5   4                   5   4                          5   45

returned 2;  heap is now 3 4 15 5 45
```

```python filename:Python
class MinHeap:
    def __init__(self):
        self.a = []

    def parent(self, i): return (i - 1) // 2
    def left(self, i): return 2 * i + 1
    def right(self, i): return 2 * i + 2

    def insert(self, x):
        a = self.a
        a.append(x)
        i = len(a) - 1
        while i > 0 and a[self.parent(i)] > a[i]:
            p = self.parent(i)
            a[i], a[p] = a[p], a[i]
            i = p

    def min_heapify(self, i):            # subtrees of i are heaps; fix node i
        a, n = self.a, len(self.a)
        l, r, smallest = self.left(i), self.right(i), i
        if l < n and a[l] < a[smallest]:
            smallest = l
        if r < n and a[r] < a[smallest]:
            smallest = r
        if smallest != i:                # a child is smaller: swap and continue below
            a[i], a[smallest] = a[smallest], a[i]
            self.min_heapify(smallest)

    def extract_min(self):
        a = self.a
        if not a:
            return None
        res = a[0]                       # 1. the answer is the root
        a[0] = a[-1]                     # 2. last element moves to the root
        a.pop()
        if a:
            self.min_heapify(0)          # 3. sift it down
        return res

h = MinHeap()
for x in (3, 2, 15, 5, 4, 45):
    h.insert(x)
print("heap:", *h.a)
print("extract min:", h.extract_min())
print("heap:", *h.a)
print("extract min:", h.extract_min())
print("heap:", *h.a)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

class MinHeap {
    vector<int> a;
    int parent(int i) { return (i - 1) / 2; }
    int left(int i) { return 2 * i + 1; }
    int right(int i) { return 2 * i + 2; }
public:
    void insert(int x) {
        a.push_back(x);
        int i = (int)a.size() - 1;
        while (i > 0 && a[parent(i)] > a[i]) { swap(a[i], a[parent(i)]); i = parent(i); }
    }

    void minHeapify(int i) {                     // subtrees of i are heaps; fix node i
        int n = (int)a.size();
        int l = left(i), r = right(i), smallest = i;
        if (l < n && a[l] < a[smallest]) smallest = l;
        if (r < n && a[r] < a[smallest]) smallest = r;
        if (smallest != i) {                     // a child is smaller: swap and continue below
            swap(a[i], a[smallest]);
            minHeapify(smallest);
        }
    }

    int extractMin() {
        int res = a[0];                          // 1. the answer is the root
        a[0] = a.back();                         // 2. last element moves to the root
        a.pop_back();
        if (!a.empty()) minHeapify(0);           // 3. sift it down
        return res;
    }

    void print() { cout << "heap: "; for (int x : a) cout << x << " "; cout << "\n"; }
};

int main() {
    MinHeap h;
    for (int x : {3, 2, 15, 5, 4, 45}) h.insert(x);
    h.print();
    cout << "extract min: " << h.extractMin() << "\n";
    h.print();
    cout << "extract min: " << h.extractMin() << "\n";
    h.print();
}
```

```java filename:Java
import java.util.ArrayList;

public class Main {
    static class MinHeap {
        ArrayList<Integer> a = new ArrayList<>();
        int parent(int i) { return (i - 1) / 2; }
        int left(int i) { return 2 * i + 1; }
        int right(int i) { return 2 * i + 2; }
        void swap(int i, int j) { int t = a.get(i); a.set(i, a.get(j)); a.set(j, t); }

        void insert(int x) {
            a.add(x);
            int i = a.size() - 1;
            while (i > 0 && a.get(parent(i)) > a.get(i)) { swap(i, parent(i)); i = parent(i); }
        }

        void minHeapify(int i) {                     // subtrees of i are heaps; fix node i
            int n = a.size();
            int l = left(i), r = right(i), smallest = i;
            if (l < n && a.get(l) < a.get(smallest)) smallest = l;
            if (r < n && a.get(r) < a.get(smallest)) smallest = r;
            if (smallest != i) {                     // a child is smaller: swap and continue below
                swap(i, smallest);
                minHeapify(smallest);
            }
        }

        int extractMin() {
            int res = a.get(0);                      // 1. the answer is the root
            a.set(0, a.get(a.size() - 1));           // 2. last element moves to the root
            a.remove(a.size() - 1);
            if (!a.isEmpty()) minHeapify(0);         // 3. sift it down
            return res;
        }

        void print() { StringBuilder sb = new StringBuilder("heap:"); for (int x : a) sb.append(' ').append(x); System.out.println(sb); }
    }

    public static void main(String[] args) {
        MinHeap h = new MinHeap();
        for (int x : new int[]{3, 2, 15, 5, 4, 45}) h.insert(x);
        h.print();
        System.out.println("extract min: " + h.extractMin());
        h.print();
        System.out.println("extract min: " + h.extractMin());
        h.print();
    }
}
```

```javascript filename:JavaScript
class MinHeap {
    constructor() { this.a = []; }
    parent(i) { return Math.floor((i - 1) / 2); }
    left(i) { return 2 * i + 1; }
    right(i) { return 2 * i + 2; }

    insert(x) {
        const a = this.a;
        a.push(x);
        let i = a.length - 1;
        while (i > 0 && a[this.parent(i)] > a[i]) {
            const p = this.parent(i);
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }

    minHeapify(i) {                              // subtrees of i are heaps; fix node i
        const a = this.a, n = a.length;
        const l = this.left(i), r = this.right(i);
        let smallest = i;
        if (l < n && a[l] < a[smallest]) smallest = l;
        if (r < n && a[r] < a[smallest]) smallest = r;
        if (smallest !== i) {                    // a child is smaller: swap and continue below
            [a[i], a[smallest]] = [a[smallest], a[i]];
            this.minHeapify(smallest);
        }
    }

    extractMin() {
        const a = this.a;
        if (a.length === 0) return null;
        const res = a[0];                        // 1. the answer is the root
        a[0] = a[a.length - 1];                  // 2. last element moves to the root
        a.pop();
        if (a.length) this.minHeapify(0);        // 3. sift it down
        return res;
    }
}

const h = new MinHeap();
for (const x of [3, 2, 15, 5, 4, 45]) h.insert(x);
console.log("heap:", h.a.join(" "));
console.log("extract min:", h.extractMin());
console.log("heap:", h.a.join(" "));
console.log("extract min:", h.extractMin());
console.log("heap:", h.a.join(" "));
```

```text filename:Output
heap: 2 3 15 5 4 45
extract min: 2
heap: 3 4 15 5 45
extract min: 3
heap: 4 5 15 45
```

Time O(log n) · Space O(log n) for the recursive heapify — O(1) if written as a loop

> [!WARNING] Pitfall
>
> `minHeapify` must swap with the <strong>smaller</strong> child, not just any smaller child. Swapping with the larger one puts it above its sibling and breaks the heap property. Also check `l < n` / `r < n` before reading — the notes' first version read `a[rightChild]` past the end when a node had only a left child.

# Decrease key and delete

> [!TIP] Example
>
> <strong>Input:</strong> `the heap 2 3 15 5 4 45; decreaseKey(index 2, 1)`<br><strong>Output:</strong> `15 becomes 1 and rises to the root: 1 3 2 5 4 45`<br><strong>Input:</strong> `then delete(index 1)`<br><strong>Output:</strong> `the value 3 is removed: 1 4 2 5 45`

> [!NOTE] Idea
>
> <strong>Decrease key</strong> lowers one value. A smaller value can only violate the heap property with its <em>parent</em>, so the fix is the same sift-up as insert. <strong>Delete at index i</strong> needs no new mechanism: decrease the key to `−∞` so it rises to the root, then `extractMin()` throws it away. Both are `O(log n)`. (<em>Increase key</em> would be the mirror: set the value, then `minHeapify(i)`.)

```python filename:Python
import math

class MinHeap:
    def __init__(self):
        self.a = []

    def parent(self, i): return (i - 1) // 2

    def sift_up(self, i):                    # shared by insert and decrease_key
        a = self.a
        while i > 0 and a[self.parent(i)] > a[i]:
            p = self.parent(i)
            a[i], a[p] = a[p], a[i]
            i = p

    def insert(self, x):
        self.a.append(x)
        self.sift_up(len(self.a) - 1)

    def min_heapify(self, i):
        a, n = self.a, len(self.a)
        l, r, smallest = 2 * i + 1, 2 * i + 2, i
        if l < n and a[l] < a[smallest]: smallest = l
        if r < n and a[r] < a[smallest]: smallest = r
        if smallest != i:
            a[i], a[smallest] = a[smallest], a[i]
            self.min_heapify(smallest)

    def extract_min(self):
        a = self.a
        res = a[0]
        a[0] = a[-1]
        a.pop()
        if a:
            self.min_heapify(0)
        return res

    def decrease_key(self, i, x):            # x must be <= a[i]
        self.a[i] = x
        self.sift_up(i)                      # only the path to the root can be wrong

    def delete(self, i):
        self.decrease_key(i, -math.inf)      # 1. send it to the root ...
        self.extract_min()                   # 2. ... and remove the root

h = MinHeap()
for x in (3, 2, 15, 5, 4, 45):
    h.insert(x)
print("heap:", *h.a)
h.decrease_key(2, 1)
print("decrease key at index 2 (15 -> 1):", *h.a)
h.delete(1)
print("delete index 1 (value 3):", *h.a)
print("min:", h.a[0])
```

```cpp filename:C%2B%2B
#include <climits>
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

class MinHeap {
    vector<int> a;
    int parent(int i) { return (i - 1) / 2; }

    void siftUp(int i) {                         // shared by insert and decreaseKey
        while (i > 0 && a[parent(i)] > a[i]) { swap(a[i], a[parent(i)]); i = parent(i); }
    }

    void minHeapify(int i) {
        int n = (int)a.size();
        int l = 2 * i + 1, r = 2 * i + 2, smallest = i;
        if (l < n && a[l] < a[smallest]) smallest = l;
        if (r < n && a[r] < a[smallest]) smallest = r;
        if (smallest != i) { swap(a[i], a[smallest]); minHeapify(smallest); }
    }
public:
    void insert(int x) { a.push_back(x); siftUp((int)a.size() - 1); }

    int extractMin() {
        int res = a[0];
        a[0] = a.back();
        a.pop_back();
        if (!a.empty()) minHeapify(0);
        return res;
    }

    void decreaseKey(int i, int x) {             // x must be <= a[i]
        a[i] = x;
        siftUp(i);                               // only the path to the root can be wrong
    }

    void erase(int i) {                          // "delete" is a keyword in C++
        decreaseKey(i, INT_MIN);                 // 1. send it to the root ...
        extractMin();                            // 2. ... and remove the root
    }

    int getMin() { return a[0]; }
    void print() { for (int x : a) cout << x << " "; cout << "\n"; }
};

int main() {
    MinHeap h;
    for (int x : {3, 2, 15, 5, 4, 45}) h.insert(x);
    cout << "heap: "; h.print();
    h.decreaseKey(2, 1);
    cout << "decrease key at index 2 (15 -> 1): "; h.print();
    h.erase(1);
    cout << "delete index 1 (value 3): "; h.print();
    cout << "min: " << h.getMin() << "\n";
}
```

```java filename:Java
import java.util.ArrayList;

public class Main {
    static class MinHeap {
        ArrayList<Integer> a = new ArrayList<>();
        int parent(int i) { return (i - 1) / 2; }
        void swap(int i, int j) { int t = a.get(i); a.set(i, a.get(j)); a.set(j, t); }

        void siftUp(int i) {                         // shared by insert and decreaseKey
            while (i > 0 && a.get(parent(i)) > a.get(i)) { swap(i, parent(i)); i = parent(i); }
        }

        void minHeapify(int i) {
            int n = a.size();
            int l = 2 * i + 1, r = 2 * i + 2, smallest = i;
            if (l < n && a.get(l) < a.get(smallest)) smallest = l;
            if (r < n && a.get(r) < a.get(smallest)) smallest = r;
            if (smallest != i) { swap(i, smallest); minHeapify(smallest); }
        }

        void insert(int x) { a.add(x); siftUp(a.size() - 1); }

        int extractMin() {
            int res = a.get(0);
            a.set(0, a.get(a.size() - 1));
            a.remove(a.size() - 1);
            if (!a.isEmpty()) minHeapify(0);
            return res;
        }

        void decreaseKey(int i, int x) {             // x must be <= a[i]
            a.set(i, x);
            siftUp(i);                               // only the path to the root can be wrong
        }

        void delete(int i) {
            decreaseKey(i, Integer.MIN_VALUE);       // 1. send it to the root ...
            extractMin();                            // 2. ... and remove the root
        }

        String show() { StringBuilder sb = new StringBuilder(); for (int x : a) sb.append(x).append(' '); return sb.toString().trim(); }
    }

    public static void main(String[] args) {
        MinHeap h = new MinHeap();
        for (int x : new int[]{3, 2, 15, 5, 4, 45}) h.insert(x);
        System.out.println("heap: " + h.show());
        h.decreaseKey(2, 1);
        System.out.println("decrease key at index 2 (15 -> 1): " + h.show());
        h.delete(1);
        System.out.println("delete index 1 (value 3): " + h.show());
        System.out.println("min: " + h.a.get(0));
    }
}
```

```javascript filename:JavaScript
class MinHeap {
    constructor() { this.a = []; }
    parent(i) { return Math.floor((i - 1) / 2); }

    siftUp(i) {                                  // shared by insert and decreaseKey
        const a = this.a;
        while (i > 0 && a[this.parent(i)] > a[i]) {
            const p = this.parent(i);
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }

    insert(x) { this.a.push(x); this.siftUp(this.a.length - 1); }

    minHeapify(i) {
        const a = this.a, n = a.length;
        const l = 2 * i + 1, r = 2 * i + 2;
        let smallest = i;
        if (l < n && a[l] < a[smallest]) smallest = l;
        if (r < n && a[r] < a[smallest]) smallest = r;
        if (smallest !== i) { [a[i], a[smallest]] = [a[smallest], a[i]]; this.minHeapify(smallest); }
    }

    extractMin() {
        const a = this.a;
        const res = a[0];
        a[0] = a[a.length - 1];
        a.pop();
        if (a.length) this.minHeapify(0);
        return res;
    }

    decreaseKey(i, x) {                          // x must be <= a[i]
        this.a[i] = x;
        this.siftUp(i);                          // only the path to the root can be wrong
    }

    delete(i) {
        this.decreaseKey(i, -Infinity);          // 1. send it to the root ...
        this.extractMin();                       // 2. ... and remove the root
    }
}

const h = new MinHeap();
for (const x of [3, 2, 15, 5, 4, 45]) h.insert(x);
console.log("heap:", h.a.join(" "));
h.decreaseKey(2, 1);
console.log("decrease key at index 2 (15 -> 1):", h.a.join(" "));
h.delete(1);
console.log("delete index 1 (value 3):", h.a.join(" "));
console.log("min:", h.a[0]);
```

```text filename:Output
heap: 2 3 15 5 4 45
decrease key at index 2 (15 -> 1): 1 3 2 5 4 45
delete index 1 (value 3): 1 4 2 5 45
min: 1
```

Time O(log n) each · Space O(1)

> [!NOTE] Key point
>
> `decreaseKey` is what Dijkstra's algorithm needs when a shorter path to a vertex is found. It requires knowing the <strong>index</strong> of the element, which the array can only provide with an extra `value → index` map; the library priority queues below do not offer it, so Dijkstra implementations usually push a fresh entry instead (<em>lazy deletion</em>).

> [!WARNING] Pitfall
>
> The notes' second implementation had two typos that make it silently wrong: `lchild` returned `2 * 1 + 1` (always 3) instead of `2 * i + 1`, and `decreasekey` compared `arr[self.parent(i) > arr[i]]` — indexing with a boolean — instead of `arr[self.parent(i)] > arr[i]`. Running the code with a known heap and checking the array after every operation, as above, catches both.

# Build heap in O(n)

> [!TIP] Example
>
> <strong>Input:</strong> `arr = 40 10 30 50 20 15`<br><strong>Output:</strong> `min-heap 10 20 15 50 40 30`

> [!NOTE] Idea
>
> Inserting `n` elements one by one costs `O(n log n)`. Building <strong>bottom-up</strong> is faster: the leaves (indices `n/2 … n − 1`) are already one-node heaps, so call `minHeapify(i)` for `i = n/2 − 1` down to `0`. Each call assumes both subtrees are heaps — true, because every index below `i` was fixed first — and repairs node `i` by sifting it down.

```text filename:Build-heap%20fixes%20the%20internal%20nodes%20from%20the%20bottom%20up%3B%20each%20sift-down%20only%20goes%20as%20far%20as%20it%20must
arr = 40 10 30 50 20 15        n = 6, last internal node = 6/2 − 1 = 2

          40 [0]            heapify(2): 30 vs child 15 → swap        40
        /       \                                                  /    \
    10 [1]      30 [2]      heapify(1): 10 ≤ 50, 20 → nothing      10     15
    /   \       /                                                 / \    /
50 [3] 20 [4] 15 [5]        heapify(0): 40 vs 10, 15 → swap 10   50  20  30
                                then 40 vs 50, 20 → swap 20
result: 10 20 15 50 40 30
```

<strong>Why </strong><strong>`O(n)`</strong><strong> and not </strong><strong>`O(n log n)`</strong><strong>.</strong> A node at height `h` (leaves at height 0) sifts down at most `h` steps, and there are at most `n / 2^(h+1)` nodes at that height. Total work is `Σ h · n / 2^(h+1) = n · Σ h / 2^(h+1) ≤ n · 1 = O(n)` — half the nodes are leaves and cost nothing, a quarter move at most one level, and so on. The `O(n log n)` bound counts `log n` for every node, which is far too pessimistic.

```python filename:Python
def min_heapify(a, n, i):                # fix node i, given that its subtrees are heaps
    l, r, smallest = 2 * i + 1, 2 * i + 2, i
    if l < n and a[l] < a[smallest]: smallest = l
    if r < n and a[r] < a[smallest]: smallest = r
    if smallest != i:
        a[i], a[smallest] = a[smallest], a[i]
        min_heapify(a, n, smallest)

def build_heap(a):
    n = len(a)
    for i in range(n // 2 - 1, -1, -1):  # last internal node down to the root
        min_heapify(a, n, i)

def extract_min(a):
    res = a[0]
    a[0] = a[-1]
    a.pop()
    if a:
        min_heapify(a, len(a), 0)
    return res

a = [40, 10, 30, 50, 20, 15]
build_heap(a)
print("build heap from 40 10 30 50 20 15:", *a)
out = []
while a:
    out.append(extract_min(a))
print("extract all:", *out)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

void minHeapify(vector<int>& a, int n, int i) {   // fix node i, given that its subtrees are heaps
    int l = 2 * i + 1, r = 2 * i + 2, smallest = i;
    if (l < n && a[l] < a[smallest]) smallest = l;
    if (r < n && a[r] < a[smallest]) smallest = r;
    if (smallest != i) {
        swap(a[i], a[smallest]);
        minHeapify(a, n, smallest);
    }
}

void buildHeap(vector<int>& a) {
    int n = (int)a.size();
    for (int i = n / 2 - 1; i >= 0; i--)          // last internal node down to the root
        minHeapify(a, n, i);
}

int extractMin(vector<int>& a) {
    int res = a[0];
    a[0] = a.back();
    a.pop_back();
    if (!a.empty()) minHeapify(a, (int)a.size(), 0);
    return res;
}

int main() {
    vector<int> a = {40, 10, 30, 50, 20, 15};
    buildHeap(a);
    cout << "build heap from 40 10 30 50 20 15:";
    for (int x : a) cout << " " << x;
    cout << "\nextract all:";
    while (!a.empty()) cout << " " << extractMin(a);
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Arrays;

public class Main {
    static void minHeapify(ArrayList<Integer> a, int n, int i) {   // fix node i, given that its subtrees are heaps
        int l = 2 * i + 1, r = 2 * i + 2, smallest = i;
        if (l < n && a.get(l) < a.get(smallest)) smallest = l;
        if (r < n && a.get(r) < a.get(smallest)) smallest = r;
        if (smallest != i) {
            int t = a.get(i); a.set(i, a.get(smallest)); a.set(smallest, t);
            minHeapify(a, n, smallest);
        }
    }

    static void buildHeap(ArrayList<Integer> a) {
        int n = a.size();
        for (int i = n / 2 - 1; i >= 0; i--)          // last internal node down to the root
            minHeapify(a, n, i);
    }

    static int extractMin(ArrayList<Integer> a) {
        int res = a.get(0);
        a.set(0, a.get(a.size() - 1));
        a.remove(a.size() - 1);
        if (!a.isEmpty()) minHeapify(a, a.size(), 0);
        return res;
    }

    public static void main(String[] args) {
        ArrayList<Integer> a = new ArrayList<>(Arrays.asList(40, 10, 30, 50, 20, 15));
        buildHeap(a);
        StringBuilder sb = new StringBuilder("build heap from 40 10 30 50 20 15:");
        for (int x : a) sb.append(' ').append(x);
        System.out.println(sb);
        sb = new StringBuilder("extract all:");
        while (!a.isEmpty()) sb.append(' ').append(extractMin(a));
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
function minHeapify(a, n, i) {               // fix node i, given that its subtrees are heaps
    const l = 2 * i + 1, r = 2 * i + 2;
    let smallest = i;
    if (l < n && a[l] < a[smallest]) smallest = l;
    if (r < n && a[r] < a[smallest]) smallest = r;
    if (smallest !== i) {
        [a[i], a[smallest]] = [a[smallest], a[i]];
        minHeapify(a, n, smallest);
    }
}

function buildHeap(a) {
    const n = a.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--)   // last internal node down to the root
        minHeapify(a, n, i);
}

function extractMin(a) {
    const res = a[0];
    a[0] = a[a.length - 1];
    a.pop();
    if (a.length) minHeapify(a, a.length, 0);
    return res;
}

const a = [40, 10, 30, 50, 20, 15];
buildHeap(a);
console.log("build heap from 40 10 30 50 20 15:", a.join(" "));
const out = [];
while (a.length) out.push(extractMin(a));
console.log("extract all:", out.join(" "));
```

```text filename:Output
build heap from 40 10 30 50 20 15: 10 20 15 50 40 30
extract all: 10 15 20 30 40 50
```

Time O(n) to build; O(n log n) to extract everything · Space O(1) extra (in place)

> [!NOTE] Key point
>
> <em>Build heap, then extract everything</em> is already a sorting algorithm — the extraction order is ascending. Heap sort below does the same thing <strong>in place</strong>, without a second array, by using a max-heap.

# Heap sort

> [!TIP] Example
>
> <strong>Input:</strong> `arr = 40 10 30 50 20 15`<br><strong>Output:</strong> `10 15 20 30 40 50`

> [!NOTE] Idea
>
> Build a <strong>max-heap</strong> in place (`O(n)`). The maximum is now at `a[0]`; swap it with the last element so it sits in its final sorted position, shrink the heap by one and `maxHeapify(0)` to restore the heap on the remaining prefix. Repeat `n − 1` times: each round places one more element at the end, so the sorted suffix grows while the heap prefix shrinks — all inside the same array.

1. <strong>Build max-heap</strong>

   `for i = n/2 − 1 … 0: maxHeapify(a, n, i)` — the largest element is at `a[0]`.

2. <strong>Repeat for </strong><strong>`end = n − 1 … 1`</strong>

   Swap `a[0]` and `a[end]` (the max is now in place), then `maxHeapify(a, end, 0)` on the prefix of length `end`.

3. <strong>Done</strong>

   The prefix shrinks to one element; the array is sorted ascending.

```text filename:Each%20round%20moves%20the%20current%20maximum%20to%20the%20front%20of%20the%20sorted%20suffix
max-heap:  50 40 30 10 20 15   | sorted suffix
swap 50 ↔ 15, heapify prefix:  40 20 30 10 15 | 50
swap 40 ↔ 15, heapify prefix:  30 20 15 10 | 40 50
swap 30 ↔ 10, heapify prefix:  20 10 15 | 30 40 50
swap 20 ↔ 15, heapify prefix:  15 10 | 20 30 40 50
swap 15 ↔ 10:                  10 | 15 20 30 40 50
```

```python filename:Python
def max_heapify(a, n, i):
    l, r, largest = 2 * i + 1, 2 * i + 2, i
    if l < n and a[l] > a[largest]: largest = l
    if r < n and a[r] > a[largest]: largest = r
    if largest != i:
        a[i], a[largest] = a[largest], a[i]
        max_heapify(a, n, largest)

def heap_sort(a):
    n = len(a)
    for i in range(n // 2 - 1, -1, -1):          # 1. build max-heap: O(n)
        max_heapify(a, n, i)
    print("max-heap:", *a)
    for end in range(n - 1, 0, -1):              # 2. n − 1 rounds
        a[0], a[end] = a[end], a[0]              #    max goes to its final place
        max_heapify(a, end, 0)                   #    restore the heap on a[0..end)

a = [40, 10, 30, 50, 20, 15]
heap_sort(a)
print("sorted:", *a)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <utility>
#include <vector>
using namespace std;

void maxHeapify(vector<int>& a, int n, int i) {
    int l = 2 * i + 1, r = 2 * i + 2, largest = i;
    if (l < n && a[l] > a[largest]) largest = l;
    if (r < n && a[r] > a[largest]) largest = r;
    if (largest != i) { swap(a[i], a[largest]); maxHeapify(a, n, largest); }
}

void print(const char* label, const vector<int>& a) {
    cout << label; for (int x : a) cout << " " << x; cout << "\n";
}

void heapSort(vector<int>& a) {
    int n = (int)a.size();
    for (int i = n / 2 - 1; i >= 0; i--) maxHeapify(a, n, i);   // 1. build max-heap: O(n)
    print("max-heap:", a);
    for (int end = n - 1; end > 0; end--) {                    // 2. n − 1 rounds
        swap(a[0], a[end]);                                    //    max goes to its final place
        maxHeapify(a, end, 0);                                 //    restore the heap on a[0..end)
    }
}

int main() {
    vector<int> a = {40, 10, 30, 50, 20, 15};
    heapSort(a);
    print("sorted:", a);
}
```

```java filename:Java
public class Main {
    static void maxHeapify(int[] a, int n, int i) {
        int l = 2 * i + 1, r = 2 * i + 2, largest = i;
        if (l < n && a[l] > a[largest]) largest = l;
        if (r < n && a[r] > a[largest]) largest = r;
        if (largest != i) {
            int t = a[i]; a[i] = a[largest]; a[largest] = t;
            maxHeapify(a, n, largest);
        }
    }

    static void print(String label, int[] a) {
        StringBuilder sb = new StringBuilder(label);
        for (int x : a) sb.append(' ').append(x);
        System.out.println(sb);
    }

    static void heapSort(int[] a) {
        int n = a.length;
        for (int i = n / 2 - 1; i >= 0; i--) maxHeapify(a, n, i);   // 1. build max-heap: O(n)
        print("max-heap:", a);
        for (int end = n - 1; end > 0; end--) {                    // 2. n − 1 rounds
            int t = a[0]; a[0] = a[end]; a[end] = t;               //    max goes to its final place
            maxHeapify(a, end, 0);                                 //    restore the heap on a[0..end)
        }
    }

    public static void main(String[] args) {
        int[] a = {40, 10, 30, 50, 20, 15};
        heapSort(a);
        print("sorted:", a);
    }
}
```

```javascript filename:JavaScript
function maxHeapify(a, n, i) {
    const l = 2 * i + 1, r = 2 * i + 2;
    let largest = i;
    if (l < n && a[l] > a[largest]) largest = l;
    if (r < n && a[r] > a[largest]) largest = r;
    if (largest !== i) {
        [a[i], a[largest]] = [a[largest], a[i]];
        maxHeapify(a, n, largest);
    }
}

function heapSort(a) {
    const n = a.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) maxHeapify(a, n, i);   // 1. build max-heap: O(n)
    console.log("max-heap:", a.join(" "));
    for (let end = n - 1; end > 0; end--) {                                // 2. n − 1 rounds
        [a[0], a[end]] = [a[end], a[0]];                                   //    max goes to its final place
        maxHeapify(a, end, 0);                                             //    restore the heap on a[0..end)
    }
}

const a = [40, 10, 30, 50, 20, 15];
heapSort(a);
console.log("sorted:", a.join(" "));
```

```text filename:Output
max-heap: 50 40 30 10 20 15
sorted: 10 15 20 30 40 50
```

Time O(n log n) always — no bad input · Space O(1) extra (in place; O(log n) stack if heapify is recursive)

|  | Heap sort | Merge sort | Quick sort |
| --- | --- | --- | --- |
| Worst case | `O(n log n)` | `O(n log n)` | `O(n²)` |
| Extra space | `O(1)` | `O(n)` | `O(log n)` stack |
| Stable | No | Yes | No |
| In practice | Slower (poor cache locality: jumps across the array) | Fast, used for linked lists and external sorting | Fastest on arrays; libraries use introsort = quick sort that falls back to heap sort |

# Built-in priority queues

You will rarely write a heap by hand outside an interview. Every language but JavaScript ships one; the API is always <em>push</em>, <em>pop the best</em>, <em>peek</em>.

| Language | Priority queue | Default order | push / pop / peek | Max-heap instead |
| --- | --- | --- | --- | --- |
| Python | `heapq` — functions on a plain list | <strong>min</strong>-heap | `heappush(h, x)` / `heappop(h)` / `h[0]` | push `-x`, or `(−priority, item)` tuples |
| C++ | `std::priority_queue<T>` | <strong>max</strong>-heap | `push(x)` / `pop()` (returns nothing) / `top()` | it is max by default; min: `priority_queue<int, vector<int>, greater<int>>` |
| Java | `java.util.PriorityQueue<T>` | <strong>min</strong>-heap | `offer(x)` / `poll()` / `peek()` | `new PriorityQueue<>(Collections.reverseOrder())` |
| JavaScript | — none built in |  | write a `MinHeap` class (below) or use a library |  |

> [!TIP] Example
>
> <strong>Input:</strong> `start from 5 20 1 30 4; push 3; pop everything`<br><strong>Output:</strong> `min 1; popped order 1 3 4 5 20 30`

```python filename:Python
import heapq

h = [5, 20, 1, 30, 4]
heapq.heapify(h)                     # O(n) build, in place
print("min:", h[0])
heapq.heappush(h, 3)                 # O(log n)
print("after push 3, min:", h[0])
out = []
while h:
    out.append(heapq.heappop(h))     # O(log n) each
print("popped in order:", *out)
```

```cpp filename:C%2B%2B
#include <functional>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;

int main() {
    vector<int> v = {5, 20, 1, 30, 4};
    priority_queue<int, vector<int>, greater<int>> pq(v.begin(), v.end());   // min-heap; O(n) build
    cout << "min: " << pq.top() << "\n";
    pq.push(3);                                                             // O(log n)
    cout << "after push 3, min: " << pq.top() << "\n";
    cout << "popped in order:";
    while (!pq.empty()) { cout << " " << pq.top(); pq.pop(); }              // O(log n) each
    cout << "\n";
}
```

```java filename:Java
import java.util.Arrays;
import java.util.PriorityQueue;

public class Main {
    public static void main(String[] args) {
        PriorityQueue<Integer> pq = new PriorityQueue<>(Arrays.asList(5, 20, 1, 30, 4));   // min-heap
        System.out.println("min: " + pq.peek());
        pq.offer(3);                                                         // O(log n)
        System.out.println("after push 3, min: " + pq.peek());
        StringBuilder sb = new StringBuilder("popped in order:");
        while (!pq.isEmpty()) sb.append(' ').append(pq.poll());              // O(log n) each
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
class MinHeap {                          // JavaScript has no built-in priority queue
    constructor(items = []) { this.a = [...items]; for (let i = (this.a.length >> 1) - 1; i >= 0; i--) this.down(i); }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) { this.a.push(x); this.up(this.a.length - 1); }
    pop() {
        const a = this.a, res = a[0], last = a.pop();
        if (a.length) { a[0] = last; this.down(0); }
        return res;
    }
    up(i) {
        const a = this.a;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (a[p] <= a[i]) break;
            [a[p], a[i]] = [a[i], a[p]]; i = p;
        }
    }
    down(i) {
        const a = this.a, n = a.length;
        for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let s = i;
            if (l < n && a[l] < a[s]) s = l;
            if (r < n && a[r] < a[s]) s = r;
            if (s === i) break;
            [a[s], a[i]] = [a[i], a[s]]; i = s;
        }
    }
}

const pq = new MinHeap([5, 20, 1, 30, 4]);   // O(n) build
console.log("min:", pq.peek());
pq.push(3);                                  // O(log n)
console.log("after push 3, min:", pq.peek());
const out = [];
while (pq.size()) out.push(pq.pop());        // O(log n) each
console.log("popped in order:", out.join(" "));
```

```text filename:Output
min: 1
after push 3, min: 1
popped in order: 1 3 4 5 20 30
```

Time O(log n) push / pop, O(1) peek · Space O(n)

`heapq` also has a few conveniences worth knowing — `nlargest`, `nsmallest` and `heapreplace` (pop then push in a single sift, faster than the two calls). The list <em>is</em> the heap, so you can print it and see the array layout from the diagrams:

```python filename:Python
import heapq

p = [5, 20, 1, 30, 4]
heapq.heapify(p)
print(p)                          # [1, 4, 5, 30, 20]   ← a valid min-heap, not a sorted list
heapq.heappush(p, 3)
print(p)                          # [1, 4, 3, 30, 20, 5]
print(heapq.heappop(p))           # 1
print(p)                          # [3, 4, 5, 30, 20]
print(heapq.nlargest(2, p))       # [30, 20]
print(heapq.nsmallest(2, p))      # [3, 4]
print(heapq.heapreplace(p, -1))   # 3   ← pops the min, then pushes -1 (one sift instead of two)
print(p)                          # [-1, 4, 5, 30, 20]
```

> [!WARNING] Pitfall
>
> A heap is <strong>not sorted</strong> — only `h[0]` is guaranteed to be the minimum. Iterating over `heapq`'s list, `PriorityQueue`'s iterator or printing the array gives level order, not ascending order. To get sorted output, pop repeatedly.

> [!NOTE] Key point
>
> For a <strong>max-heap in Python</strong> push the negated values (`heappush(h, -x)`, read `-h[0]`); for tuples `(priority, item)` the heap orders by priority first — make sure items are comparable or add a tie-breaking counter. In Java pass `Collections.reverseOrder()` or a `Comparator`; in C++ the default `priority_queue<int>` already is a max-heap.

# Where heaps are used

> [!NOTE] Priority queue
>
> Task scheduling, event simulation, bandwidth management — serve the most urgent item first, `O(log n)` per operation.

> [!NOTE] Heap sort
>
> `O(n log n)` worst case with `O(1)` extra space; the fallback inside introsort.

> [!NOTE] Graph algorithms
>
> Dijkstra's shortest paths and Prim's minimum spanning tree pop the closest vertex from a min-heap.

> [!NOTE] k largest / smallest
>
> Keep a min-heap of size `k`; push each element and pop when the size exceeds `k` — `O(n log k)` instead of sorting everything.

> [!NOTE] Median of a stream
>
> A max-heap of the lower half and a min-heap of the upper half; the median is at the roots.

> [!NOTE] Merge k sorted lists
>
> Push the head of each list; pop the smallest and push its successor — `O(N log k)`. Huffman coding uses the same pattern.

# Interview Q&amp;A

```question
Why can a heap be stored in an array but a BST cannot?

---

A heap is a <strong>complete</strong> binary tree, so reading it level by level leaves no gaps and parent/child positions are pure arithmetic (`(i−1)/2`, `2i+1`, `2i+2`). A BST can have any shape; storing it the same way would need an array of size `2^h` with mostly empty slots.
```

```question
Why is building a heap O(n) when a single insert is O(log n)?

---

Bottom-up build calls `heapify` on the internal nodes from the bottom, and a node at height `h` sifts down at most `h` levels. Half of the nodes are leaves (cost 0), a quarter are at height 1, an eighth at height 2 … so the total is `n · Σ h / 2^(h+1)`, a series that converges to `n`. Inserting one by one instead sifts <strong>up</strong>, and most elements are deep, so that is `Θ(n log n)`.
```

```question
Heap or balanced BST for a priority queue?

---

A heap: `O(1)` peek, `O(log n)` push/pop, `O(n)` build, no pointers and great cache behaviour. A BST gives the same `O(log n)` bounds plus search, predecessor/successor and delete-by-value, at the cost of pointers and constants — use it only when you need those extras (e.g. a double-ended priority queue).
```

```question
How do you find the k largest elements of a stream, and why a min-heap?

---

Keep a <strong>min-heap of size k</strong>. For each element, push it; if the size exceeds `k`, pop the minimum — the smallest of the current candidates leaves. The root is always the kth largest so far. `O(n log k)` time and `O(k)` space, versus `O(n log n)` for sorting. A max-heap would make the <em>largest</em> easy to find but the one to evict hard.
```

```question
Is heap sort stable? Is it used in practice?

---

Not stable — the long-range swaps reorder equal keys. In practice it loses to quick sort on arrays because of cache misses, but its guaranteed `O(n log n)` and `O(1)` space make it the fallback in <strong>introsort</strong> (C++ `std::sort`), which switches to heap sort when quick sort's recursion gets too deep.
```

```question
What does decreaseKey need that a library priority queue does not provide?

---

The <strong>index</strong> of the element inside the heap. Library queues hide the array, so you cannot address an element. Dijkstra implementations therefore push a new `(distance, vertex)` pair whenever a shorter path is found and skip stale pairs when they are popped — lazy deletion — which keeps the same `O(E log V)` bound.
```
