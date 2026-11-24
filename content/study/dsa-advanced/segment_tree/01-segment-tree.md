---
id: 4f9f381d-db17-7133-9a73-781add10400e
key: topic:dsa-advanced/segment_tree
subject: dsa-advanced
topic: segment_tree
title: Segment Tree
slug: segment-tree
order: 1
---

A segment tree answers <strong>range queries</strong> (sum, min, max, …) over an array and <strong>updates</strong> single elements, both in `O(log n)`. It is the structure to use when both operations are frequent, because a plain array makes queries slow and a prefix-sum array makes updates slow.

> [!INFO]
>
> <strong>Segment tree</strong> — a binary tree over a fixed-size array in which every node stores an aggregate (e.g. the sum) of one contiguous segment: the root covers the whole array, each child covers one half of its parent's segment, and the leaves are the individual elements.

```text filename:Segment%20tree%20of%20sums%20over%20%5B10%2C%2020%2C%2030%2C%2040%5D%2C%20stored%20in%20an%20array%20like%20a%20heap
arr = [10, 20, 30, 40]            index:  0   1   2   3

                [0..3] = 100                 tree[0]
               /            \
      [0..1] = 30          [2..3] = 70        tree[1]  tree[2]
      /       \            /       \
[0]=10     [1]=20    [2]=30     [3]=40        tree[3] tree[4] tree[5] tree[6]

tree array:  100  30  70  10  20  30  40
              0    1   2   3   4   5   6        children of i are 2i+1 and 2i+2
```

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 30, 40, 50]; getSum(0, 2); getSum(1, 3); update(1, 60); getSum(0, 2)`<br><strong>Output:</strong> `60, 90, then 100`

# Why not a plain array or prefix sums?

Suppose `x` operations arrive, of which a quarter are range-sum queries and three quarters are updates. With a plain array queries cost `O(n)` and updates `O(1)`, so the average is `(x/4 · O(n) + 3x/4 · O(1)) / x = O(n)`. With a prefix-sum array it is the reverse — queries `O(1)`, updates `O(n)` — and the average is again `O(n)`. A segment tree makes <strong>both</strong> `O(log n)`.

| Structure | Range sum | Point update | Preprocessing | Space |
| --- | --- | --- | --- | --- |
| Plain array | O(n) | O(1) | — | O(n) |
| Prefix-sum array | O(1) | O(n) | O(n) | O(n) |
| <strong>Segment tree</strong> | <strong>O(log n)</strong> | <strong>O(log n)</strong> | O(n) | O(n) (≈ 4n slots) |
| Binary indexed tree | O(log n) | O(log n) | O(n log n) (O(n) possible) | O(n) (n + 1 slots) |

> [!NOTE] Key point
>
> Segment trees work for any <strong>associative</strong> aggregate: sum, min, max, gcd, XOR, number of zeros, … Replace the `+` in the three functions below and nothing else changes. They also extend to range updates with lazy propagation — the binary indexed tree does not handle min/max.

# Size of the tree array

Children of node `i` live at `2i + 1` and `2i + 2`, so the tree is stored in a plain array with no pointers. How large must it be?

- If `n` is a power of two the tree is perfect: `2n − 1` nodes.
- Otherwise let `x` be the smallest power of two <strong>greater than</strong> `n`; the tree needs at most `2x − 1` slots (some stay unused).
- In practice allocate `4n` — it is always enough (`2x − 1 < 4n`) and saves computing `x`.

`size = 2 · 2^⌈log₂ n⌉ − 1 (≤ 4n)`

> [!TIP] Example
>
> `n = 5` → `x = 8` → at most `15` slots; `n = 4` → exactly `7` slots, all used.

# Constructing the segment tree

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 30, 40]`<br><strong>Output:</strong> `tree = [100, 30, 70, 10, 20, 30, 40]`

> [!NOTE] Idea
>
> Build recursively: if the segment is a single element store it; otherwise build the left half and the right half, then store their sum. Every node is written exactly once — `O(n)`.

1. <strong>`build(ss, se, si)`</strong>

   `ss`/`se` = segment start/end in `arr`, `si` = index of this node in `tree`.

2. <strong>Leaf</strong>

   `ss == se` → `tree[si] = arr[ss]`.

3. <strong>Internal node</strong>

   `mid = (ss + se) / 2`; `tree[si] = build(ss, mid, 2si+1) + build(mid+1, se, 2si+2)`.

```python filename:Python
def build(arr, tree, ss, se, si):
    if ss == se:                                        # leaf: a single element
        tree[si] = arr[ss]
        return tree[si]
    mid = (ss + se) // 2
    tree[si] = build(arr, tree, ss, mid, 2 * si + 1) + build(arr, tree, mid + 1, se, 2 * si + 2)
    return tree[si]                                     # parent = left sum + right sum

def tree_size(n):
    x = 1
    while x < n:                                        # smallest power of two ≥ n
        x *= 2
    return 2 * x - 1

arr = [10, 20, 30, 40]
tree = [0] * tree_size(len(arr))
build(arr, tree, 0, len(arr) - 1, 0)
print("tree:", " ".join(map(str, tree)))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

int build(const vector<int>& arr, vector<int>& tree, int ss, int se, int si) {
    if (ss == se) return tree[si] = arr[ss];            // leaf: a single element
    int mid = (ss + se) / 2;
    return tree[si] = build(arr, tree, ss, mid, 2 * si + 1)
                    + build(arr, tree, mid + 1, se, 2 * si + 2);   // parent = left sum + right sum
}

int treeSize(int n) {
    int x = 1;
    while (x < n) x *= 2;                                // smallest power of two ≥ n
    return 2 * x - 1;
}

int main() {
    vector<int> arr = {10, 20, 30, 40};
    int n = arr.size();
    vector<int> tree(treeSize(n), 0);
    build(arr, tree, 0, n - 1, 0);
    cout << "tree:";
    for (int v : tree) cout << " " << v;
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static int build(int[] arr, int[] tree, int ss, int se, int si) {
        if (ss == se) return tree[si] = arr[ss];        // leaf: a single element
        int mid = (ss + se) / 2;
        return tree[si] = build(arr, tree, ss, mid, 2 * si + 1)
                        + build(arr, tree, mid + 1, se, 2 * si + 2);   // parent = left sum + right sum
    }

    static int treeSize(int n) {
        int x = 1;
        while (x < n) x *= 2;                            // smallest power of two ≥ n
        return 2 * x - 1;
    }

    public static void main(String[] args) {
        int[] arr = {10, 20, 30, 40};
        int[] tree = new int[treeSize(arr.length)];
        build(arr, tree, 0, arr.length - 1, 0);
        StringBuilder sb = new StringBuilder("tree:");
        for (int v : tree) sb.append(' ').append(v);
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
function build(arr, tree, ss, se, si) {
    if (ss === se) return (tree[si] = arr[ss]);         // leaf: a single element
    const mid = Math.floor((ss + se) / 2);
    return (tree[si] = build(arr, tree, ss, mid, 2 * si + 1)
                     + build(arr, tree, mid + 1, se, 2 * si + 2));   // parent = left sum + right sum
}

function treeSize(n) {
    let x = 1;
    while (x < n) x *= 2;                                // smallest power of two ≥ n
    return 2 * x - 1;
}

const arr = [10, 20, 30, 40];
const tree = new Array(treeSize(arr.length)).fill(0);
build(arr, tree, 0, arr.length - 1, 0);
console.log("tree:", tree.join(" "));
```

```text filename:Output
tree: 100 30 70 10 20 30 40
```

Time O(n) — each of the ≈ 2n nodes is computed once · Space O(n)

# Range query

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 30, 40]; getSum(0, 2)`<br><strong>Output:</strong> `60`<br><strong>Input:</strong> `getSum(1, 3)`<br><strong>Output:</strong> `90`

> [!NOTE] Idea
>
> Walk down from the root. A node's segment relates to the query range `[qs, qe]` in one of three ways: <strong>completely inside</strong> → return its stored sum without going deeper; <strong>completely outside</strong> → contribute `0`; <strong>partially overlapping</strong> → recurse into both children and add.

```text filename:The%20three%20cases%20%E2%80%94%20at%20most%20two%20nodes%20per%20level%20are%20partially%20overlapped%2C%20so%20the%20query%20touches%20O(log%20n)%20nodes
getSum(1, 2) on [10, 20, 30, 40]

         [0..3]  partial overlap → recurse
        /      \
  [0..1] partial  [2..3] partial
  /    \          /    \
[0]    [1]      [2]    [3]
outside inside  inside outside
  0     20       30      0        → 20 + 30 = 50
```

```python filename:Python
def build(arr, tree, ss, se, si):
    if ss == se:
        tree[si] = arr[ss]
        return tree[si]
    mid = (ss + se) // 2
    tree[si] = build(arr, tree, ss, mid, 2 * si + 1) + build(arr, tree, mid + 1, se, 2 * si + 2)
    return tree[si]

def get_sum_rec(tree, qs, qe, ss, se, si):
    if qe < ss or qs > se:                              # segment completely outside the query
        return 0
    if qs <= ss and se <= qe:                           # segment completely inside the query
        return tree[si]
    mid = (ss + se) // 2                                # partial overlap: ask both children
    return get_sum_rec(tree, qs, qe, ss, mid, 2 * si + 1) + get_sum_rec(tree, qs, qe, mid + 1, se, 2 * si + 2)

def get_sum(tree, n, qs, qe):
    if qs < 0 or qe > n - 1 or qs > qe:
        raise ValueError("invalid range")
    return get_sum_rec(tree, qs, qe, 0, n - 1, 0)

arr = [10, 20, 30, 40]
n = len(arr)
x = 1
while x < n:
    x *= 2
tree = [0] * (2 * x - 1)
build(arr, tree, 0, n - 1, 0)
print("tree:", " ".join(map(str, tree)))
for qs, qe in [(0, 2), (1, 3), (2, 2)]:
    print(f"sum({qs}, {qe}):", get_sum(tree, n, qs, qe))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <stdexcept>
using namespace std;

int build(const vector<int>& arr, vector<int>& tree, int ss, int se, int si) {
    if (ss == se) return tree[si] = arr[ss];
    int mid = (ss + se) / 2;
    return tree[si] = build(arr, tree, ss, mid, 2 * si + 1) + build(arr, tree, mid + 1, se, 2 * si + 2);
}

int getSumRec(const vector<int>& tree, int qs, int qe, int ss, int se, int si) {
    if (qe < ss || qs > se) return 0;                   // segment completely outside the query
    if (qs <= ss && se <= qe) return tree[si];          // segment completely inside the query
    int mid = (ss + se) / 2;                             // partial overlap: ask both children
    return getSumRec(tree, qs, qe, ss, mid, 2 * si + 1) + getSumRec(tree, qs, qe, mid + 1, se, 2 * si + 2);
}

int getSum(const vector<int>& tree, int n, int qs, int qe) {
    if (qs < 0 || qe > n - 1 || qs > qe) throw invalid_argument("invalid range");
    return getSumRec(tree, qs, qe, 0, n - 1, 0);
}

int main() {
    vector<int> arr = {10, 20, 30, 40};
    int n = arr.size(), x = 1;
    while (x < n) x *= 2;
    vector<int> tree(2 * x - 1, 0);
    build(arr, tree, 0, n - 1, 0);
    cout << "tree:";
    for (int v : tree) cout << " " << v;
    cout << "\n";
    int queries[3][2] = {{0, 2}, {1, 3}, {2, 2}};
    for (auto& q : queries) cout << "sum(" << q[0] << ", " << q[1] << "): " << getSum(tree, n, q[0], q[1]) << "\n";
}
```

```java filename:Java
public class Main {
    static int build(int[] arr, int[] tree, int ss, int se, int si) {
        if (ss == se) return tree[si] = arr[ss];
        int mid = (ss + se) / 2;
        return tree[si] = build(arr, tree, ss, mid, 2 * si + 1) + build(arr, tree, mid + 1, se, 2 * si + 2);
    }

    static int getSumRec(int[] tree, int qs, int qe, int ss, int se, int si) {
        if (qe < ss || qs > se) return 0;               // segment completely outside the query
        if (qs <= ss && se <= qe) return tree[si];      // segment completely inside the query
        int mid = (ss + se) / 2;                         // partial overlap: ask both children
        return getSumRec(tree, qs, qe, ss, mid, 2 * si + 1) + getSumRec(tree, qs, qe, mid + 1, se, 2 * si + 2);
    }

    static int getSum(int[] tree, int n, int qs, int qe) {
        if (qs < 0 || qe > n - 1 || qs > qe) throw new IllegalArgumentException("invalid range");
        return getSumRec(tree, qs, qe, 0, n - 1, 0);
    }

    public static void main(String[] args) {
        int[] arr = {10, 20, 30, 40};
        int n = arr.length, x = 1;
        while (x < n) x *= 2;
        int[] tree = new int[2 * x - 1];
        build(arr, tree, 0, n - 1, 0);
        StringBuilder sb = new StringBuilder("tree:");
        for (int v : tree) sb.append(' ').append(v);
        System.out.println(sb);
        int[][] queries = {{0, 2}, {1, 3}, {2, 2}};
        for (int[] q : queries) System.out.println("sum(" + q[0] + ", " + q[1] + "): " + getSum(tree, n, q[0], q[1]));
    }
}
```

```javascript filename:JavaScript
function build(arr, tree, ss, se, si) {
    if (ss === se) return (tree[si] = arr[ss]);
    const mid = Math.floor((ss + se) / 2);
    return (tree[si] = build(arr, tree, ss, mid, 2 * si + 1) + build(arr, tree, mid + 1, se, 2 * si + 2));
}

function getSumRec(tree, qs, qe, ss, se, si) {
    if (qe < ss || qs > se) return 0;                   // segment completely outside the query
    if (qs <= ss && se <= qe) return tree[si];          // segment completely inside the query
    const mid = Math.floor((ss + se) / 2);               // partial overlap: ask both children
    return getSumRec(tree, qs, qe, ss, mid, 2 * si + 1) + getSumRec(tree, qs, qe, mid + 1, se, 2 * si + 2);
}

function getSum(tree, n, qs, qe) {
    if (qs < 0 || qe > n - 1 || qs > qe) throw new Error("invalid range");
    return getSumRec(tree, qs, qe, 0, n - 1, 0);
}

const arr = [10, 20, 30, 40];
const n = arr.length;
let x = 1;
while (x < n) x *= 2;
const tree = new Array(2 * x - 1).fill(0);
build(arr, tree, 0, n - 1, 0);
console.log("tree:", tree.join(" "));
for (const [qs, qe] of [[0, 2], [1, 3], [2, 2]]) console.log(`sum(${qs}, ${qe}):`, getSum(tree, n, qs, qe));
```

```text filename:Output
tree: 100 30 70 10 20 30 40
sum(0, 2): 60
sum(1, 3): 90
sum(2, 2): 30
```

Time O(log n) per query · Space O(log n) recursion depth

> [!WARNING] Pitfall
>
> The order of the two base cases matters: test <em>completely outside</em> before <em>completely inside</em>. For a single-element segment both `qe < ss` and `qs <= ss && se <= qe` can be evaluated — the outside test must win when the leaf is not in the range.

# Point update

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 30, 40]; update(1, 60); getSum(0, 2)`<br><strong>Output:</strong> `100 (the tree becomes 140 70 70 10 60 30 40)`

> [!NOTE] Idea
>
> Only the nodes whose segment <strong>contains index </strong><strong>`i`</strong> — one per level, root to leaf — are affected. Compute `diff = newValue − arr[i]`, then walk down from the root adding `diff` to every node on the path to leaf `i` and ignoring the subtrees that do not contain `i`.

1. <strong>Compute the difference</strong>

   `diff = new_val − arr[i]`; also store `arr[i] = new_val` so later updates compute the right difference.

2. <strong>`update(ss, se, i, si, diff)`</strong>

   If `i` is outside `[ss, se]` → return (this subtree is untouched).

3. <strong>Add and descend</strong>

   `tree[si] += diff`; if the segment has more than one element, recurse into both children (only the one containing `i` does any work).

```text filename:Exactly%20one%20node%20per%20level%20changes
update(1, 60) on [10, 20, 30, 40]: diff = 60 − 20 = +40

         [0..3] 100 → 140            ← contains index 1: += 40
        /            \
  [0..1] 30 → 70      [2..3] 70       ← index 1 not in [2..3]: skip
  /       \
[0] 10    [1] 20 → 60                 ← the leaf itself
```

```python filename:Python
class SegmentTree:
    def __init__(self, arr):
        self.arr = arr[:]
        self.n = len(arr)
        x = 1
        while x < self.n:
            x *= 2
        self.tree = [0] * (2 * x - 1)
        self._build(0, self.n - 1, 0)

    def _build(self, ss, se, si):
        if ss == se:
            self.tree[si] = self.arr[ss]
            return self.tree[si]
        mid = (ss + se) // 2
        self.tree[si] = self._build(ss, mid, 2 * si + 1) + self._build(mid + 1, se, 2 * si + 2)
        return self.tree[si]

    def get_sum(self, qs, qe, ss=0, se=None, si=0):
        if se is None:
            se = self.n - 1
        if qe < ss or qs > se:
            return 0
        if qs <= ss and se <= qe:
            return self.tree[si]
        mid = (ss + se) // 2
        return self.get_sum(qs, qe, ss, mid, 2 * si + 1) + self.get_sum(qs, qe, mid + 1, se, 2 * si + 2)

    def update(self, i, new_val):
        diff = new_val - self.arr[i]                    # how much every ancestor must change
        self.arr[i] = new_val
        self._update(0, self.n - 1, i, 0, diff)

    def _update(self, ss, se, i, si, diff):
        if i < ss or i > se:                            # index not in this segment
            return
        self.tree[si] += diff                           # this node's segment contains i
        if ss < se:
            mid = (ss + se) // 2
            self._update(ss, mid, i, 2 * si + 1, diff)
            self._update(mid + 1, se, i, 2 * si + 2, diff)

st = SegmentTree([10, 20, 30, 40])
print("tree:", " ".join(map(str, st.tree)))
print("sum(0, 2):", st.get_sum(0, 2))
print("update(1, 60)")
st.update(1, 60)
print("tree:", " ".join(map(str, st.tree)))
print("sum(0, 2):", st.get_sum(0, 2))
print("sum(1, 3):", st.get_sum(1, 3))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

class SegmentTree {
    vector<int> arr, tree;
    int n;
    int build(int ss, int se, int si) {
        if (ss == se) return tree[si] = arr[ss];
        int mid = (ss + se) / 2;
        return tree[si] = build(ss, mid, 2 * si + 1) + build(mid + 1, se, 2 * si + 2);
    }
    int getSum(int qs, int qe, int ss, int se, int si) const {
        if (qe < ss || qs > se) return 0;
        if (qs <= ss && se <= qe) return tree[si];
        int mid = (ss + se) / 2;
        return getSum(qs, qe, ss, mid, 2 * si + 1) + getSum(qs, qe, mid + 1, se, 2 * si + 2);
    }
    void update(int ss, int se, int i, int si, int diff) {
        if (i < ss || i > se) return;                   // index not in this segment
        tree[si] += diff;                               // this node's segment contains i
        if (ss < se) {
            int mid = (ss + se) / 2;
            update(ss, mid, i, 2 * si + 1, diff);
            update(mid + 1, se, i, 2 * si + 2, diff);
        }
    }
public:
    SegmentTree(const vector<int>& a) : arr(a), n(a.size()) {
        int x = 1;
        while (x < n) x *= 2;
        tree.assign(2 * x - 1, 0);
        build(0, n - 1, 0);
    }
    int getSum(int qs, int qe) const { return getSum(qs, qe, 0, n - 1, 0); }
    void update(int i, int newVal) {
        int diff = newVal - arr[i];                     // how much every ancestor must change
        arr[i] = newVal;
        update(0, n - 1, i, 0, diff);
    }
    void print() const { cout << "tree:"; for (int v : tree) cout << " " << v; cout << "\n"; }
};

int main() {
    SegmentTree st({10, 20, 30, 40});
    st.print();
    cout << "sum(0, 2): " << st.getSum(0, 2) << "\n";
    cout << "update(1, 60)\n";
    st.update(1, 60);
    st.print();
    cout << "sum(0, 2): " << st.getSum(0, 2) << "\n";
    cout << "sum(1, 3): " << st.getSum(1, 3) << "\n";
}
```

```java filename:Java
public class Main {
    static class SegmentTree {
        int[] arr, tree;
        int n;
        SegmentTree(int[] a) {
            arr = a.clone(); n = a.length;
            int x = 1;
            while (x < n) x *= 2;
            tree = new int[2 * x - 1];
            build(0, n - 1, 0);
        }
        int build(int ss, int se, int si) {
            if (ss == se) return tree[si] = arr[ss];
            int mid = (ss + se) / 2;
            return tree[si] = build(ss, mid, 2 * si + 1) + build(mid + 1, se, 2 * si + 2);
        }
        int getSum(int qs, int qe) { return getSum(qs, qe, 0, n - 1, 0); }
        int getSum(int qs, int qe, int ss, int se, int si) {
            if (qe < ss || qs > se) return 0;
            if (qs <= ss && se <= qe) return tree[si];
            int mid = (ss + se) / 2;
            return getSum(qs, qe, ss, mid, 2 * si + 1) + getSum(qs, qe, mid + 1, se, 2 * si + 2);
        }
        void update(int i, int newVal) {
            int diff = newVal - arr[i];                 // how much every ancestor must change
            arr[i] = newVal;
            update(0, n - 1, i, 0, diff);
        }
        void update(int ss, int se, int i, int si, int diff) {
            if (i < ss || i > se) return;               // index not in this segment
            tree[si] += diff;                           // this node's segment contains i
            if (ss < se) {
                int mid = (ss + se) / 2;
                update(ss, mid, i, 2 * si + 1, diff);
                update(mid + 1, se, i, 2 * si + 2, diff);
            }
        }
        String dump() { StringBuilder sb = new StringBuilder("tree:"); for (int v : tree) sb.append(' ').append(v); return sb.toString(); }
    }

    public static void main(String[] args) {
        SegmentTree st = new SegmentTree(new int[]{10, 20, 30, 40});
        System.out.println(st.dump());
        System.out.println("sum(0, 2): " + st.getSum(0, 2));
        System.out.println("update(1, 60)");
        st.update(1, 60);
        System.out.println(st.dump());
        System.out.println("sum(0, 2): " + st.getSum(0, 2));
        System.out.println("sum(1, 3): " + st.getSum(1, 3));
    }
}
```

```javascript filename:JavaScript
class SegmentTree {
    constructor(a) {
        this.arr = [...a]; this.n = a.length;
        let x = 1;
        while (x < this.n) x *= 2;
        this.tree = new Array(2 * x - 1).fill(0);
        this.build(0, this.n - 1, 0);
    }
    build(ss, se, si) {
        if (ss === se) return (this.tree[si] = this.arr[ss]);
        const mid = Math.floor((ss + se) / 2);
        return (this.tree[si] = this.build(ss, mid, 2 * si + 1) + this.build(mid + 1, se, 2 * si + 2));
    }
    getSum(qs, qe, ss = 0, se = this.n - 1, si = 0) {
        if (qe < ss || qs > se) return 0;
        if (qs <= ss && se <= qe) return this.tree[si];
        const mid = Math.floor((ss + se) / 2);
        return this.getSum(qs, qe, ss, mid, 2 * si + 1) + this.getSum(qs, qe, mid + 1, se, 2 * si + 2);
    }
    update(i, newVal) {
        const diff = newVal - this.arr[i];              // how much every ancestor must change
        this.arr[i] = newVal;
        this.updateRec(0, this.n - 1, i, 0, diff);
    }
    updateRec(ss, se, i, si, diff) {
        if (i < ss || i > se) return;                   // index not in this segment
        this.tree[si] += diff;                          // this node's segment contains i
        if (ss < se) {
            const mid = Math.floor((ss + se) / 2);
            this.updateRec(ss, mid, i, 2 * si + 1, diff);
            this.updateRec(mid + 1, se, i, 2 * si + 2, diff);
        }
    }
}

const st = new SegmentTree([10, 20, 30, 40]);
console.log("tree:", st.tree.join(" "));
console.log("sum(0, 2):", st.getSum(0, 2));
console.log("update(1, 60)");
st.update(1, 60);
console.log("tree:", st.tree.join(" "));
console.log("sum(0, 2):", st.getSum(0, 2));
console.log("sum(1, 3):", st.getSum(1, 3));
```

```text filename:Output
tree: 100 30 70 10 20 30 40
sum(0, 2): 60
update(1, 60)
tree: 140 70 70 10 60 30 40
sum(0, 2): 100
sum(1, 3): 130
```

Time O(log n) per update · Space O(log n) recursion depth

> [!NOTE] Min / max trees
>
> For aggregates where a <em>difference</em> makes no sense (min, max, gcd) do not propagate `diff`; instead descend to the leaf, overwrite it, and on the way back up recompute each ancestor as `combine(tree[2si+1], tree[2si+2])`. That version works for every aggregate, including sum.

> [!WARNING] Pitfall
>
> Forgetting to write `arr[i] = new_val` makes the <em>second</em> update of the same index compute a wrong `diff` — the tree then silently drifts away from the array.

# Interview Q&amp;A

```question
Segment tree vs binary indexed tree — which one and why?

---

Both give `O(log n)` point update and range query over a fixed-size array. A BIT is shorter to code and uses `n + 1` slots, but only works for <strong>invertible</strong> operations (sum, XOR) where `prefix(r) − prefix(l−1)` makes sense. A segment tree handles any associative operation (min, max, gcd), range updates with lazy propagation, and is easier to extend — at the cost of `≈ 4n` memory and more code.
```

```question
Why is a range query O(log n) when it may recurse into both children?

---

At every level at most <strong>two</strong> nodes are <em>partially</em> overlapped by the query (the ones containing its left and right boundaries); every other visited node is either fully inside or fully outside and returns immediately. So the recursion touches at most `4` nodes per level × `log n` levels.
```

```question
How much memory does a segment tree need and why 4n?

---

Exactly `2n − 1` nodes when `n` is a power of two; otherwise at most `2x − 1` where `x` is the next power of two above `n`. Since `x < 2n`, `2x − 1 < 4n`, which is why `4n` is the usual safe allocation. The iterative <em>bottom-up</em> segment tree needs only `2n`.
```

```question
How would you support range updates (add v to every element in \[l, r\])?

---

With <strong>lazy propagation</strong>: store a pending `add` value in each node; a range update marks the fully covered nodes lazily instead of descending to every leaf, and the pending value is pushed down to the children only when a later query or update needs to look inside. Both operations stay `O(log n)`.
```

```question
Can a segment tree be built for an array that grows?

---

Not directly — the structure assumes a fixed size. Either allocate for the maximum size up front (unused leaves hold the identity element, `0` for sums), or use a dynamic / implicit segment tree that creates nodes on demand.
```
