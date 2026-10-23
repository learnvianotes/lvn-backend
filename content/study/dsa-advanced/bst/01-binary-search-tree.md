---
id: a4071a47-861e-78f2-996a-eb8b98f6051f
key: topic:dsa-advanced/bst
subject: dsa-advanced
topic: bst
title: Binary Search Tree
slug: binary-search-tree
order: 1
---

A binary search tree keeps its keys <strong>ordered</strong>: everything in a node's left subtree is smaller, everything in its right subtree is larger. That one invariant is what every problem here exploits — the inorder traversal is sorted, every search is a single root-to-leaf walk, and a count stored in each node turns <em>order statistics</em> into `O(h)` queries.

> [!INFO]
>
> <strong>Binary Search Tree (BST)</strong> — a binary tree in which, for <strong>every</strong> node, all keys in the left subtree are `<` the node's key and all keys in the right subtree are `>` it. The rule applies to whole subtrees, not just to the two children — this is the detail most wrong solutions miss.

```text filename:Tree%20A%20%E2%80%94%20the%20sample%20tree%20used%20throughout%20this%20topic
            20
          /    \
         8      22
       /   \
      4     12
           /  \
         10    14

inorder:  4  8  10  12  14  20  22      (always sorted)
```

# What the problems rely on

The reader already knows search, insert and delete. The advanced problems are built from four consequences of the BST invariant:

> [!NOTE] Inorder is sorted
>
> Left, node, right visits keys in ascending order. Anything you can do on a sorted array (two pointers, previous-element checks, kth element) you can do on a BST without materialising the array.

> [!NOTE] One path answers a query
>
> Search, floor, ceiling, predecessor and successor each follow a single root-to-leaf path: `O(h)` time, where `h` is the height.

> [!NOTE] Ancestors bound a node
>
> A node must lie strictly inside the range `(lower, upper)` set by all of its ancestors — not only by its parent.

> [!NOTE] Nodes can carry extra data
>
> Storing the size of the left subtree (an <em>augmented</em> BST) makes “kth smallest” and “rank of x” `O(h)` queries.

| Operation | Time | Note |
| --- | --- | --- |
| search / insert / delete | O(h) | `h = O(log n)` when balanced, `O(n)` when skewed |
| floor / ceiling / successor | O(h) | one path down, remember the best candidate |
| kth smallest (plain) | O(h + k) | inorder traversal stopped after `k` nodes |
| kth smallest (augmented) | O(h) | each node stores the size of its left subtree |
| check if a tree is a BST | O(n) | range method or inorder-previous method |
| inorder traversal | O(n) | stack holds at most `h` nodes |

> [!NOTE] Key point
>
> The library ordered containers — C++ `std::set` / `std::map`, Java `TreeSet` / `TreeMap` — are self-balancing BSTs (red-black trees), so `h = O(log n)` is guaranteed. Python and JavaScript ship no ordered set; you either write a small BST, keep a sorted list with `bisect` (`O(n)` inserts) or use a third-party package.

# Floor and ceiling of a key

> [!TIP] Example
>
> <strong>Input:</strong> `tree A, x = 11`<br><strong>Output:</strong> `floor 10, ceiling 12`<br><strong>Input:</strong> `tree A, x = 23`<br><strong>Output:</strong> `floor 22, ceiling -1 (none)`<br><strong>Input:</strong> `tree A, x = 3`<br><strong>Output:</strong> `floor -1 (none), ceiling 4`

> [!NOTE] Idea
>
> Walk down from the root. For the <strong>floor</strong> (largest key `<= x`): when the current key is too big go left; when it is `<= x` it is a candidate — record it and go right to look for a closer one. The <strong>ceiling</strong> is the mirror image. The answer is the last candidate recorded on the path — no backtracking, no recursion.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root

def floor_of(root, x):
    res = -1
    while root:
        if root.key == x:
            return x
        if root.key > x:
            root = root.left        # too big: only the left subtree can hold a floor
        else:
            res = root.key          # candidate; a closer one may sit to the right
            root = root.right
    return res

def ceil_of(root, x):
    res = -1
    while root:
        if root.key == x:
            return x
        if root.key < x:
            root = root.right       # too small: only the right subtree can hold a ceiling
        else:
            res = root.key          # candidate; a closer one may sit to the left
            root = root.left
    return res

root = None
for k in [20, 8, 22, 4, 12, 10, 14]:
    root = insert(root, k)
for x in [11, 23, 3, 12]:
    print(f"x={x}: floor {floor_of(root, x)} ceiling {ceil_of(root, x)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;
}

int floorOf(Node* root, int x) {
    int res = -1;
    while (root) {
        if (root->key == x) return x;
        if (root->key > x) root = root->left;          // too big: go left
        else { res = root->key; root = root->right; }  // candidate, look right for a closer one
    }
    return res;
}

int ceilOf(Node* root, int x) {
    int res = -1;
    while (root) {
        if (root->key == x) return x;
        if (root->key < x) root = root->right;         // too small: go right
        else { res = root->key; root = root->left; }   // candidate, look left for a closer one
    }
    return res;
}

int main() {
    Node* root = nullptr;
    for (int k : {20, 8, 22, 4, 12, 10, 14}) root = insert(root, k);
    for (int x : {11, 23, 3, 12})
        cout << "x=" << x << ": floor " << floorOf(root, x) << " ceiling " << ceilOf(root, x) << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;
    }

    static int floorOf(Node root, int x) {
        int res = -1;
        while (root != null) {
            if (root.key == x) return x;
            if (root.key > x) root = root.left;            // too big: go left
            else { res = root.key; root = root.right; }    // candidate, look right for a closer one
        }
        return res;
    }

    static int ceilOf(Node root, int x) {
        int res = -1;
        while (root != null) {
            if (root.key == x) return x;
            if (root.key < x) root = root.right;           // too small: go right
            else { res = root.key; root = root.left; }     // candidate, look left for a closer one
        }
        return res;
    }

    public static void main(String[] args) {
        Node root = null;
        for (int k : new int[]{20, 8, 22, 4, 12, 10, 14}) root = insert(root, k);
        for (int x : new int[]{11, 23, 3, 12})
            System.out.println("x=" + x + ": floor " + floorOf(root, x) + " ceiling " + ceilOf(root, x));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {
    if (!root) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;
}

function floorOf(root, x) {
    let res = -1;
    while (root) {
        if (root.key === x) return x;
        if (root.key > x) root = root.left;               // too big: go left
        else { res = root.key; root = root.right; }       // candidate, look right for a closer one
    }
    return res;
}

function ceilOf(root, x) {
    let res = -1;
    while (root) {
        if (root.key === x) return x;
        if (root.key < x) root = root.right;              // too small: go right
        else { res = root.key; root = root.left; }        // candidate, look left for a closer one
    }
    return res;
}

let root = null;
for (const k of [20, 8, 22, 4, 12, 10, 14]) root = insert(root, k);
for (const x of [11, 23, 3, 12])
    console.log(`x=${x}: floor ${floorOf(root, x)} ceiling ${ceilOf(root, x)}`);
```

```text filename:Output
x=11: floor 10 ceiling 12
x=23: floor 22 ceiling -1
x=3: floor -1 ceiling 4
x=12: floor 12 ceiling 12
```

Time O(h) · Space O(1)

> [!WARNING] Pitfall
>
> Returning as soon as you see a key `<= x` gives a <em>valid</em> floor but not the <em>greatest</em> one — `floor(11)` would stop at `8` instead of continuing right to `10`. Always keep walking and overwrite the candidate.

# Ceiling on the left side of every element

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [2, 8, 30, 15, 25, 12]`<br><strong>Output:</strong> `-1 -1 -1 30 30 15`<br><strong>Input:</strong> `arr = [30, 20, 10]`<br><strong>Output:</strong> `-1 30 20`

For every `arr[i]`, print the smallest element among `arr[0..i-1]` that is `>= arr[i]`, or `-1` if there is none. The first element never has one.

The obvious solution rescans the prefix for each element:

```python filename:Python
def left_ceilings_naive(arr):
    res = [-1]
    for i in range(1, len(arr)):
        best = -1
        for j in range(i):                                # scan everything to the left
            if arr[j] >= arr[i] and (best == -1 or arr[j] < best):
                best = arr[j]
        res.append(best)
    return res

print(*left_ceilings_naive([2, 8, 30, 15, 25, 12]))
```

```text filename:Output
-1 -1 -1 30 30 15
```

Time O(n²) · Space O(1)

> [!NOTE] Idea
>
> Keep the elements seen so far in an <strong>ordered set</strong> (a self-balancing BST). The ceiling of `arr[i]` is then one `O(log n)` query — `lower_bound` in C++, `TreeSet.ceiling` in Java — and inserting `arr[i]` afterwards is another. Python uses `bisect` on a sorted list (the query is `O(log n)`, the insert `O(n)` but with a very small constant); JavaScript reuses the hand-written BST from the previous section.

```python filename:Python
from bisect import bisect_left, insort

def left_ceilings(arr):
    seen = []                              # kept sorted
    res = []
    for x in arr:
        i = bisect_left(seen, x)           # index of the first element >= x
        res.append(seen[i] if i < len(seen) else -1)
        insort(seen, x)                    # O(n) shift, but a tight memmove
    return res

for arr in ([2, 8, 30, 15, 25, 12], [30, 20, 10]):
    print(*left_ceilings(arr))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <set>
#include <vector>
using namespace std;

vector<int> leftCeilings(const vector<int>& arr) {
    set<int> seen;                                   // red-black tree
    vector<int> res;
    for (int x : arr) {
        auto it = seen.lower_bound(x);               // first element >= x, O(log n)
        res.push_back(it == seen.end() ? -1 : *it);
        seen.insert(x);
    }
    return res;
}

int main() {
    for (const vector<int>& arr : {vector<int>{2, 8, 30, 15, 25, 12}, vector<int>{30, 20, 10}}) {
        vector<int> res = leftCeilings(arr);
        for (int i = 0; i < (int)res.size(); i++) cout << (i ? " " : "") << res[i];
        cout << "\n";
    }
}
```

```java filename:Java
import java.util.TreeSet;

public class Main {
    static String leftCeilings(int[] arr) {
        TreeSet<Integer> seen = new TreeSet<>();      // red-black tree
        StringBuilder sb = new StringBuilder();
        for (int x : arr) {
            Integer c = seen.ceiling(x);              // smallest element >= x, or null
            sb.append(c == null ? -1 : c).append(' ');
            seen.add(x);
        }
        return sb.toString().trim();
    }

    public static void main(String[] args) {
        System.out.println(leftCeilings(new int[]{2, 8, 30, 15, 25, 12}));
        System.out.println(leftCeilings(new int[]{30, 20, 10}));
    }
}
```

```javascript filename:JavaScript
// JavaScript has no ordered set: reuse the BST insert + ceiling from above
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {
    if (!root) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;
}

function ceilOf(root, x) {
    let res = -1;
    while (root) {
        if (root.key === x) return x;
        if (root.key < x) root = root.right;
        else { res = root.key; root = root.left; }
    }
    return res;
}

function leftCeilings(arr) {
    let seen = null;
    const res = [];
    for (const x of arr) {
        res.push(ceilOf(seen, x));              // query the elements to the left
        seen = insert(seen, x);                 // then add the current one
    }
    return res;
}

for (const arr of [[2, 8, 30, 15, 25, 12], [30, 20, 10]])
    console.log(leftCeilings(arr).join(" "));
```

```text filename:Output
-1 -1 -1 30 30 15
-1 30 20
```

Time O(n log n) · Space O(n)

> [!NOTE] Key point
>
> Query <strong>before</strong> insert: if you insert `arr[i]` first, its own ceiling is itself and every answer becomes `arr[i]`. The same pattern (ordered set of the prefix + one query per element) solves <em>floor on the left</em>, <em>ceiling on the right</em> (scan from the end) and <em>count of smaller elements to the left</em>.

# Kth smallest element

> [!TIP] Example
>
> <strong>Input:</strong> `tree A, k = 3`<br><strong>Output:</strong> `10`<br><strong>Input:</strong> `tree A, k = 7`<br><strong>Output:</strong> `22`<br><strong>Input:</strong> `tree A, k = 8`<br><strong>Output:</strong> `-1 (fewer than 8 nodes)`

> [!NOTE] Idea
>
> Inorder visits keys in ascending order, so the kth node visited <strong>is</strong> the kth smallest. Run an iterative inorder traversal with an explicit stack, count the nodes as they are popped, and stop as soon as the count reaches `k` — no need to finish the traversal.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root

def kth_smallest(root, k):
    stack, node = [], root
    while stack or node:
        while node:                  # go as far left as possible
            stack.append(node)
            node = node.left
        node = stack.pop()           # the next key in sorted order
        k -= 1
        if k == 0:
            return node.key
        node = node.right
    return -1                        # fewer than k nodes

root = None
for x in [20, 8, 22, 4, 12, 10, 14]:
    root = insert(root, x)
for k in (3, 7, 8):
    print(f"k={k}: {kth_smallest(root, k)}")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
using namespace std;

struct Node {
    int key;
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;
}

int kthSmallest(Node* root, int k) {
    stack<Node*> st;
    Node* node = root;
    while (!st.empty() || node) {
        while (node) { st.push(node); node = node->left; }   // go as far left as possible
        node = st.top(); st.pop();                           // next key in sorted order
        if (--k == 0) return node->key;
        node = node->right;
    }
    return -1;                                               // fewer than k nodes
}

int main() {
    Node* root = nullptr;
    for (int x : {20, 8, 22, 4, 12, 10, 14}) root = insert(root, x);
    for (int k : {3, 7, 8}) cout << "k=" << k << ": " << kthSmallest(root, k) << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;
    }

    static int kthSmallest(Node root, int k) {
        Deque<Node> stack = new ArrayDeque<>();
        Node node = root;
        while (!stack.isEmpty() || node != null) {
            while (node != null) { stack.push(node); node = node.left; }   // go as far left as possible
            node = stack.pop();                                             // next key in sorted order
            if (--k == 0) return node.key;
            node = node.right;
        }
        return -1;                                                          // fewer than k nodes
    }

    public static void main(String[] args) {
        Node root = null;
        for (int x : new int[]{20, 8, 22, 4, 12, 10, 14}) root = insert(root, x);
        for (int k : new int[]{3, 7, 8}) System.out.println("k=" + k + ": " + kthSmallest(root, k));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {
    if (!root) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;
}

function kthSmallest(root, k) {
    const stack = [];
    let node = root;
    while (stack.length || node) {
        while (node) { stack.push(node); node = node.left; }   // go as far left as possible
        node = stack.pop();                                     // next key in sorted order
        if (--k === 0) return node.key;
        node = node.right;
    }
    return -1;                                                  // fewer than k nodes
}

let root = null;
for (const x of [20, 8, 22, 4, 12, 10, 14]) root = insert(root, x);
for (const k of [3, 7, 8]) console.log(`k=${k}: ${kthSmallest(root, k)}`);
```

```text filename:Output
k=3: 10
k=7: 22
k=8: -1
```

Time O(h + k) · Space O(h)

> [!WARNING] Pitfall
>
> The original notes used a recursive traversal with a <strong>global counter</strong> and a `return` after printing — but the `return` only leaves the current frame, the parent frames continue into their right subtrees, and the counter is never reset for a second query. An explicit stack (or a counter object passed down and a boolean <em>found</em> flag) avoids both bugs.

When the tree is queried many times, or `k` is large, pay a little memory to make every query `O(h)`: store in each node the <strong>number of nodes in its left subtree</strong> (`lcount`). Insert maintains it — every time the new key goes left, the node it passes gains one left descendant.

```text filename:Augmented%20tree%20A%3A%20each%20node%20knows%20the%20size%20of%20its%20left%20subtree
            20 (lcount 5)
          /    \
 (lcount 1) 8    22 (0)
       /   \
  (0) 4     12 (lcount 1)
           /  \
     (0) 10    14 (0)

kth(k=3) at 20: lcount+1 = 6 > 3   → go left, k stays 3
          at 8: lcount+1 = 2 < 3   → go right, k = 3-2 = 1
         at 12: lcount+1 = 2 > 1   → go left
         at 10: lcount+1 = 1 == 1  → answer 10
```

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None
        self.lcount = 0              # number of nodes in the left subtree

def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
        root.lcount += 1             # one more node went into my left subtree
    elif key > root.key:
        root.right = insert(root.right, key)
    return root

def kth_smallest(root, k):
    while root:
        rank = root.lcount + 1       # this node is the rank-th smallest of its subtree
        if rank == k:
            return root.key
        if k < rank:
            root = root.left         # answer is in the left subtree
        else:
            k -= rank                # skip the left subtree and this node
            root = root.right
    return -1

root = None
for x in [20, 8, 22, 4, 12, 10, 14]:
    root = insert(root, x)
for k in (3, 7, 8):
    print(f"k={k}: {kth_smallest(root, k)}")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    int lcount = 0;                      // number of nodes in the left subtree
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->key) {
        root->left = insert(root->left, key);
        root->lcount++;                  // one more node went into my left subtree
    } else if (key > root->key) {
        root->right = insert(root->right, key);
    }
    return root;
}

int kthSmallest(Node* root, int k) {
    while (root) {
        int rank = root->lcount + 1;     // this node is the rank-th smallest of its subtree
        if (rank == k) return root->key;
        if (k < rank) root = root->left;             // answer is in the left subtree
        else { k -= rank; root = root->right; }      // skip the left subtree and this node
    }
    return -1;
}

int main() {
    Node* root = nullptr;
    for (int x : {20, 8, 22, 4, 12, 10, 14}) root = insert(root, x);
    for (int k : {3, 7, 8}) cout << "k=" << k << ": " << kthSmallest(root, k) << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key, lcount;                 // lcount = number of nodes in the left subtree
        Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {
        if (root == null) return new Node(key);
        if (key < root.key) {
            root.left = insert(root.left, key);
            root.lcount++;               // one more node went into my left subtree
        } else if (key > root.key) {
            root.right = insert(root.right, key);
        }
        return root;
    }

    static int kthSmallest(Node root, int k) {
        while (root != null) {
            int rank = root.lcount + 1;  // this node is the rank-th smallest of its subtree
            if (rank == k) return root.key;
            if (k < rank) root = root.left;              // answer is in the left subtree
            else { k -= rank; root = root.right; }       // skip the left subtree and this node
        }
        return -1;
    }

    public static void main(String[] args) {
        Node root = null;
        for (int x : new int[]{20, 8, 22, 4, 12, 10, 14}) root = insert(root, x);
        for (int k : new int[]{3, 7, 8}) System.out.println("k=" + k + ": " + kthSmallest(root, k));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; this.lcount = 0; }
}

function insert(root, key) {
    if (!root) return new Node(key);
    if (key < root.key) {
        root.left = insert(root.left, key);
        root.lcount++;                   // one more node went into my left subtree
    } else if (key > root.key) {
        root.right = insert(root.right, key);
    }
    return root;
}

function kthSmallest(root, k) {
    while (root) {
        const rank = root.lcount + 1;    // this node is the rank-th smallest of its subtree
        if (rank === k) return root.key;
        if (k < rank) root = root.left;                  // answer is in the left subtree
        else { k -= rank; root = root.right; }           // skip the left subtree and this node
    }
    return -1;
}

let root = null;
for (const x of [20, 8, 22, 4, 12, 10, 14]) root = insert(root, x);
for (const k of [3, 7, 8]) console.log(`k=${k}: ${kthSmallest(root, k)}`);
```

```text filename:Output
k=3: 10
k=7: 22
k=8: -1
```

Time O(h) · Space O(1)

> [!NOTE] Key point
>
> The same `lcount` field answers <strong>rank(x)</strong> (how many keys are `< x`) in `O(h)`, and `n - k + 1` turns <em>kth smallest</em> into <em>kth largest</em>. If the tree also supports `delete`, every node on the deletion path whose left subtree shrank must have its `lcount` decremented — forgetting that silently corrupts later queries.

# Check whether a binary tree is a BST

```text filename:Every%20node%20of%20tree%20B%20passes%20a%20parent-vs-children%20check%2C%20yet%20tree%20B%20is%20not%20a%20BST
tree A (valid)             tree B (NOT a BST)
      20                         20
    /    \                     /    \
   8      22                  8      22
 /   \                      /   \
4     12                   4     25   ← 25 > 20 but sits in 20's left subtree
     /  \
   10    14
```

> [!TIP] Example
>
> <strong>Input:</strong> `tree A`<br><strong>Output:</strong> `Yes`<br><strong>Input:</strong> `tree B`<br><strong>Output:</strong> `No`

The tempting solution compares each node with its two children only. It accepts tree B:

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def looks_like_bst(root):                 # WRONG: only compares a node with its own children
    if root is None:
        return True
    if root.left and root.left.key > root.key:
        return False
    if root.right and root.right.key < root.key:
        return False
    return looks_like_bst(root.left) and looks_like_bst(root.right)

b = Node(20)
b.left, b.right = Node(8), Node(22)
b.left.left, b.left.right = Node(4), Node(25)      # 25 violates the rule at its grandparent 20
print("tree B:", "Yes" if looks_like_bst(b) else "No")
```

```text filename:Output
tree B: Yes
```

> [!DANGER] Avoid
>
> `8 < 20`, `4 < 8 < 25`, `20 < 22` — every local check passes, yet `25` is in the left subtree of `20`. The BST rule constrains a node by <strong>all</strong> of its ancestors, not just its parent.

A correct but slow fix checks, for every node, the maximum of the whole left subtree and the minimum of the whole right subtree. Each node is scanned by each of its ancestors, which is `O(n²)` on a skewed tree:

```python filename:Python
import sys

class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def max_key(root):
    if root is None:
        return -sys.maxsize
    return max(root.key, max_key(root.left), max_key(root.right))

def min_key(root):
    if root is None:
        return sys.maxsize
    return min(root.key, min_key(root.left), min_key(root.right))

def is_bst_slow(root):
    if root is None:
        return True
    if root.left and max_key(root.left) >= root.key:        # whole left subtree must be smaller
        return False
    if root.right and min_key(root.right) <= root.key:      # whole right subtree must be larger
        return False
    return is_bst_slow(root.left) and is_bst_slow(root.right)

a = Node(20)
a.left, a.right = Node(8), Node(22)
a.left.left, a.left.right = Node(4), Node(12)
a.left.right.left, a.left.right.right = Node(10), Node(14)

b = Node(20)
b.left, b.right = Node(8), Node(22)
b.left.left, b.left.right = Node(4), Node(25)

print("tree A:", "Yes" if is_bst_slow(a) else "No")
print("tree B:", "Yes" if is_bst_slow(b) else "No")
```

```text filename:Output
tree A: Yes
tree B: No
```

Time O(n²) worst case · Space O(h)

> [!NOTE] Idea
>
> <strong>Range method.</strong> Pass down the open interval `(lo, hi)` that the ancestors allow. The root may be anything; going left tightens `hi` to the current key, going right tightens `lo`. Each node is visited once and checked against two numbers — `O(n)`.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def is_bst(root, lo=float("-inf"), hi=float("inf")):
    if root is None:
        return True
    if not (lo < root.key < hi):             # must lie strictly inside the ancestors' range
        return False
    return (is_bst(root.left, lo, root.key)   # left subtree: everything < root.key
            and is_bst(root.right, root.key, hi))   # right subtree: everything > root.key

a = Node(20)
a.left, a.right = Node(8), Node(22)
a.left.left, a.left.right = Node(4), Node(12)
a.left.right.left, a.left.right.right = Node(10), Node(14)

b = Node(20)
b.left, b.right = Node(8), Node(22)
b.left.left, b.left.right = Node(4), Node(25)

print("tree A:", "Yes" if is_bst(a) else "No")
print("tree B:", "Yes" if is_bst(b) else "No")
```

```cpp filename:C%2B%2B
#include <climits>
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

bool isBST(Node* root, long long lo, long long hi) {
    if (!root) return true;
    if (root->key <= lo || root->key >= hi) return false;     // outside the ancestors' range
    return isBST(root->left, lo, root->key)                  // left: everything < key
        && isBST(root->right, root->key, hi);                // right: everything > key
}

int main() {
    Node* a = new Node(20);
    a->left = new Node(8); a->right = new Node(22);
    a->left->left = new Node(4); a->left->right = new Node(12);
    a->left->right->left = new Node(10); a->left->right->right = new Node(14);

    Node* b = new Node(20);
    b->left = new Node(8); b->right = new Node(22);
    b->left->left = new Node(4); b->left->right = new Node(25);

    cout << "tree A: " << (isBST(a, LLONG_MIN, LLONG_MAX) ? "Yes" : "No") << "\n";
    cout << "tree B: " << (isBST(b, LLONG_MIN, LLONG_MAX) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static boolean isBST(Node root, long lo, long hi) {
        if (root == null) return true;
        if (root.key <= lo || root.key >= hi) return false;   // outside the ancestors' range
        return isBST(root.left, lo, root.key)                 // left: everything < key
            && isBST(root.right, root.key, hi);               // right: everything > key
    }

    public static void main(String[] args) {
        Node a = new Node(20);
        a.left = new Node(8); a.right = new Node(22);
        a.left.left = new Node(4); a.left.right = new Node(12);
        a.left.right.left = new Node(10); a.left.right.right = new Node(14);

        Node b = new Node(20);
        b.left = new Node(8); b.right = new Node(22);
        b.left.left = new Node(4); b.left.right = new Node(25);

        System.out.println("tree A: " + (isBST(a, Long.MIN_VALUE, Long.MAX_VALUE) ? "Yes" : "No"));
        System.out.println("tree B: " + (isBST(b, Long.MIN_VALUE, Long.MAX_VALUE) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function isBST(root, lo = -Infinity, hi = Infinity) {
    if (!root) return true;
    if (root.key <= lo || root.key >= hi) return false;       // outside the ancestors' range
    return isBST(root.left, lo, root.key)                     // left: everything < key
        && isBST(root.right, root.key, hi);                   // right: everything > key
}

const a = new Node(20);
a.left = new Node(8); a.right = new Node(22);
a.left.left = new Node(4); a.left.right = new Node(12);
a.left.right.left = new Node(10); a.left.right.right = new Node(14);

const b = new Node(20);
b.left = new Node(8); b.right = new Node(22);
b.left.left = new Node(4); b.left.right = new Node(25);

console.log("tree A:", isBST(a) ? "Yes" : "No");
console.log("tree B:", isBST(b) ? "Yes" : "No");
```

```text filename:Output
tree A: Yes
tree B: No
```

Time O(n) · Space O(h)

> [!WARNING] Pitfall
>
> Using `INT_MIN` / `INT_MAX` as the initial bounds with `int` keys rejects a tree that legitimately contains `INT_MIN` or `INT_MAX` (the check is strict). Use a wider type for the bounds (`long long` / `long`), `±Infinity` in JavaScript, or `None` sentinels meaning <em>unbounded</em>.

> [!NOTE] Idea
>
> <strong>Inorder-previous method.</strong> Inorder of a BST is strictly increasing. Traverse inorder and remember the previous key; the moment the current key is `<=` the previous one, the tree is not a BST. One pass, no bounds, and it stops at the first violation.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def is_bst(root):
    stack, node, prev = [], root, None
    while stack or node:
        while node:                        # iterative inorder traversal
            stack.append(node)
            node = node.left
        node = stack.pop()
        if prev is not None and node.key <= prev:     # inorder must strictly increase
            return False
        prev = node.key
        node = node.right
    return True

a = Node(20)
a.left, a.right = Node(8), Node(22)
a.left.left, a.left.right = Node(4), Node(12)
a.left.right.left, a.left.right.right = Node(10), Node(14)

b = Node(20)
b.left, b.right = Node(8), Node(22)
b.left.left, b.left.right = Node(4), Node(25)

print("tree A:", "Yes" if is_bst(a) else "No")
print("tree B:", "Yes" if is_bst(b) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <stack>
using namespace std;

struct Node {
    int key;
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

bool isBST(Node* root) {
    stack<Node*> st;
    Node* node = root;
    bool havePrev = false;
    int prev = 0;
    while (!st.empty() || node) {
        while (node) { st.push(node); node = node->left; }   // iterative inorder traversal
        node = st.top(); st.pop();
        if (havePrev && node->key <= prev) return false;     // inorder must strictly increase
        prev = node->key; havePrev = true;
        node = node->right;
    }
    return true;
}

int main() {
    Node* a = new Node(20);
    a->left = new Node(8); a->right = new Node(22);
    a->left->left = new Node(4); a->left->right = new Node(12);
    a->left->right->left = new Node(10); a->left->right->right = new Node(14);

    Node* b = new Node(20);
    b->left = new Node(8); b->right = new Node(22);
    b->left->left = new Node(4); b->left->right = new Node(25);

    cout << "tree A: " << (isBST(a) ? "Yes" : "No") << "\n";
    cout << "tree B: " << (isBST(b) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static boolean isBST(Node root) {
        Deque<Node> stack = new ArrayDeque<>();
        Node node = root;
        Integer prev = null;
        while (!stack.isEmpty() || node != null) {
            while (node != null) { stack.push(node); node = node.left; }   // iterative inorder
            node = stack.pop();
            if (prev != null && node.key <= prev) return false;             // must strictly increase
            prev = node.key;
            node = node.right;
        }
        return true;
    }

    public static void main(String[] args) {
        Node a = new Node(20);
        a.left = new Node(8); a.right = new Node(22);
        a.left.left = new Node(4); a.left.right = new Node(12);
        a.left.right.left = new Node(10); a.left.right.right = new Node(14);

        Node b = new Node(20);
        b.left = new Node(8); b.right = new Node(22);
        b.left.left = new Node(4); b.left.right = new Node(25);

        System.out.println("tree A: " + (isBST(a) ? "Yes" : "No"));
        System.out.println("tree B: " + (isBST(b) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function isBST(root) {
    const stack = [];
    let node = root, prev = null;
    while (stack.length || node) {
        while (node) { stack.push(node); node = node.left; }   // iterative inorder traversal
        node = stack.pop();
        if (prev !== null && node.key <= prev) return false;    // inorder must strictly increase
        prev = node.key;
        node = node.right;
    }
    return true;
}

const a = new Node(20);
a.left = new Node(8); a.right = new Node(22);
a.left.left = new Node(4); a.left.right = new Node(12);
a.left.right.left = new Node(10); a.left.right.right = new Node(14);

const b = new Node(20);
b.left = new Node(8); b.right = new Node(22);
b.left.left = new Node(4); b.left.right = new Node(25);

console.log("tree A:", isBST(a) ? "Yes" : "No");
console.log("tree B:", isBST(b) ? "Yes" : "No");
```

```text filename:Output
tree A: Yes
tree B: No
```

Time O(n) · Space O(h)

> [!NOTE] Key point
>
> Both methods use a <strong>strict</strong> comparison, so a tree with duplicate keys is rejected. If your definition allows duplicates on one side (say `left <= node`), relax exactly that one bound — and say so in the interview before you code.

# Fix a BST with two nodes swapped

```text filename:Swapping%2060%20and%208%20back%20restores%20the%20sorted%20inorder%20sequence
    given (two keys swapped)             fixed
            20                             20
          /    \                         /    \
        60      80        ──▶           8      80
       /  \    /  \                   /  \    /  \
      4   10  8   100                4   10  60   100

inorder:  4  60  10  20  8  80  100   →   4  8  10  20  60  80  100
             ^^^^^^      ^^^^^
              dip 1       dip 2
```

> [!TIP] Example
>
> <strong>Input:</strong> `tree above`<br><strong>Output:</strong> `inorder before: 4 60 10 20 8 80 100, after: 4 8 10 20 60 80 100`

> [!NOTE] Idea
>
> The inorder sequence of a BST is sorted; swapping two keys creates <strong>one or two dips</strong> (a place where a key is smaller than its predecessor). With two dips, the swapped nodes are the <em>larger</em> element of the first dip and the <em>smaller</em> element of the second; with one dip (the two nodes are inorder-adjacent) they are the two elements of that dip. Record `first` at the first dip and overwrite `second` at every dip, then swap their keys.

1. <strong>Traverse inorder, remembering </strong><strong>`prev`</strong>

   At each node compare `node.key` with `prev.key`.

2. <strong>First dip (</strong><strong>`node.key < prev.key`</strong><strong>)</strong>

   Set `first = prev` and `second = node`.

3. <strong>Second dip</strong>

   Only `second = node` changes — `first` stays the larger element of the first dip.

4. <strong>Swap</strong>

   Exchange `first.key` and `second.key`. The structure of the tree is untouched.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

class Fixer:
    def __init__(self):
        self.prev = self.first = self.second = None

    def visit(self, node):                        # inorder, looking for dips
        if node is None:
            return
        self.visit(node.left)
        if self.prev and node.key < self.prev.key:  # a dip: smaller key after a larger one
            if self.first is None:
                self.first = self.prev            # first dip: remember the larger element
            self.second = node                    # the smaller element (overwritten by a 2nd dip)
        self.prev = node
        self.visit(node.right)

def fix_bst(root):
    f = Fixer()
    f.visit(root)
    if f.first and f.second:
        f.first.key, f.second.key = f.second.key, f.first.key

def inorder(node, out):
    if node:
        inorder(node.left, out)
        out.append(node.key)
        inorder(node.right, out)

root = Node(20)
root.left, root.right = Node(60), Node(80)
root.left.left, root.left.right = Node(4), Node(10)
root.right.left, root.right.right = Node(8), Node(100)

before = []
inorder(root, before)
print("before:", *before)
fix_bst(root)
after = []
inorder(root, after)
print("after:", *after)
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

struct Node {
    int key;
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

struct Fixer {
    Node *prev = nullptr, *first = nullptr, *second = nullptr;
    void visit(Node* node) {                           // inorder, looking for dips
        if (!node) return;
        visit(node->left);
        if (prev && node->key < prev->key) {           // a dip: smaller key after a larger one
            if (!first) first = prev;                  // first dip: remember the larger element
            second = node;                             // the smaller element (overwritten by a 2nd dip)
        }
        prev = node;
        visit(node->right);
    }
};

void fixBST(Node* root) {
    Fixer f;
    f.visit(root);
    if (f.first && f.second) swap(f.first->key, f.second->key);
}

void inorder(Node* node, vector<int>& out) {
    if (!node) return;
    inorder(node->left, out);
    out.push_back(node->key);
    inorder(node->right, out);
}

void printKeys(const char* label, Node* root) {
    vector<int> keys;
    inorder(root, keys);
    cout << label;
    for (int k : keys) cout << " " << k;
    cout << "\n";
}

int main() {
    Node* root = new Node(20);
    root->left = new Node(60); root->right = new Node(80);
    root->left->left = new Node(4); root->left->right = new Node(10);
    root->right->left = new Node(8); root->right->right = new Node(100);

    printKeys("before:", root);
    fixBST(root);
    printKeys("after:", root);
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static class Fixer {
        Node prev, first, second;
        void visit(Node node) {                        // inorder, looking for dips
            if (node == null) return;
            visit(node.left);
            if (prev != null && node.key < prev.key) { // a dip: smaller key after a larger one
                if (first == null) first = prev;       // first dip: remember the larger element
                second = node;                         // the smaller element (overwritten by a 2nd dip)
            }
            prev = node;
            visit(node.right);
        }
    }

    static void fixBST(Node root) {
        Fixer f = new Fixer();
        f.visit(root);
        if (f.first != null && f.second != null) {
            int t = f.first.key; f.first.key = f.second.key; f.second.key = t;
        }
    }

    static void inorder(Node node, List<Integer> out) {
        if (node == null) return;
        inorder(node.left, out);
        out.add(node.key);
        inorder(node.right, out);
    }

    static void printKeys(String label, Node root) {
        List<Integer> keys = new ArrayList<>();
        inorder(root, keys);
        StringBuilder sb = new StringBuilder(label);
        for (int k : keys) sb.append(' ').append(k);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Node root = new Node(20);
        root.left = new Node(60); root.right = new Node(80);
        root.left.left = new Node(4); root.left.right = new Node(10);
        root.right.left = new Node(8); root.right.right = new Node(100);

        printKeys("before:", root);
        fixBST(root);
        printKeys("after:", root);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

class Fixer {
    constructor() { this.prev = null; this.first = null; this.second = null; }
    visit(node) {                                        // inorder, looking for dips
        if (!node) return;
        this.visit(node.left);
        if (this.prev && node.key < this.prev.key) {     // a dip: smaller key after a larger one
            if (!this.first) this.first = this.prev;     // first dip: remember the larger element
            this.second = node;                          // the smaller element (overwritten by a 2nd dip)
        }
        this.prev = node;
        this.visit(node.right);
    }
}

function fixBST(root) {
    const f = new Fixer();
    f.visit(root);
    if (f.first && f.second) [f.first.key, f.second.key] = [f.second.key, f.first.key];
}

function inorder(node, out) {
    if (!node) return;
    inorder(node.left, out);
    out.push(node.key);
    inorder(node.right, out);
}

const root = new Node(20);
root.left = new Node(60); root.right = new Node(80);
root.left.left = new Node(4); root.left.right = new Node(10);
root.right.left = new Node(8); root.right.right = new Node(100);

const before = [];
inorder(root, before);
console.log("before:", before.join(" "));
fixBST(root);
const after = [];
inorder(root, after);
console.log("after:", after.join(" "));
```

```text filename:Output
before: 4 60 10 20 8 80 100
after: 4 8 10 20 60 80 100
```

Time O(n) · Space O(h)

> [!WARNING] Pitfall
>
> Setting `second = prev` at the second dip (instead of `second = node`) picks the wrong node. Trace the adjacent case too: in `8 / 20 22` (the root `20` swapped with its child `8`) the inorder is `20 8 22` — a single dip, so `first = 20`, `second = 8`, and the single swap is correct. The original notes kept `prev`/`first`/`second` as globals, which breaks as soon as the function is called twice; the `Fixer` object above resets them per call.

# Pair with a given sum in a BST

> [!TIP] Example
>
> <strong>Input:</strong> `tree A, sum = 30`<br><strong>Output:</strong> `Yes (8 + 22, or 10 + 20)`<br><strong>Input:</strong> `tree A, sum = 29`<br><strong>Output:</strong> `No`

> [!NOTE] Idea
>
> <strong>Method 1 — inorder + two pointers.</strong> Inorder gives the keys sorted. Then the classic sorted-array trick: a pointer at each end, move the left one right when the sum is too small and the right one left when it is too large. `O(n)` time, `O(n)` for the array.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root

def inorder(node, out):
    if node:
        inorder(node.left, out)
        out.append(node.key)
        inorder(node.right, out)

def pair_sum(root, target):
    keys = []
    inorder(root, keys)                     # sorted keys
    i, j = 0, len(keys) - 1
    while i < j:                            # two pointers on a sorted array
        s = keys[i] + keys[j]
        if s == target:
            return (keys[i], keys[j])
        if s < target:
            i += 1                          # need a bigger sum
        else:
            j -= 1                          # need a smaller sum
    return None

root = None
for x in [20, 8, 22, 4, 12, 10, 14]:
    root = insert(root, x)
for target in (30, 29):
    res = pair_sum(root, target)
    print(f"sum={target}:", f"Yes ({res[0]} + {res[1]})" if res else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

struct Node {
    int key;
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;
}

void inorder(Node* node, vector<int>& out) {
    if (!node) return;
    inorder(node->left, out);
    out.push_back(node->key);
    inorder(node->right, out);
}

bool pairSum(Node* root, int target, int& a, int& b) {
    vector<int> keys;
    inorder(root, keys);                              // sorted keys
    int i = 0, j = (int)keys.size() - 1;
    while (i < j) {                                   // two pointers on a sorted array
        int s = keys[i] + keys[j];
        if (s == target) { a = keys[i]; b = keys[j]; return true; }
        if (s < target) i++;                          // need a bigger sum
        else j--;                                     // need a smaller sum
    }
    return false;
}

int main() {
    Node* root = nullptr;
    for (int x : {20, 8, 22, 4, 12, 10, 14}) root = insert(root, x);
    for (int target : {30, 29}) {
        int a, b;
        if (pairSum(root, target, a, b)) cout << "sum=" << target << ": Yes (" << a << " + " << b << ")\n";
        else cout << "sum=" << target << ": No\n";
    }
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;
    }

    static void inorder(Node node, List<Integer> out) {
        if (node == null) return;
        inorder(node.left, out);
        out.add(node.key);
        inorder(node.right, out);
    }

    static int[] pairSum(Node root, int target) {
        List<Integer> keys = new ArrayList<>();
        inorder(root, keys);                              // sorted keys
        int i = 0, j = keys.size() - 1;
        while (i < j) {                                   // two pointers on a sorted array
            int s = keys.get(i) + keys.get(j);
            if (s == target) return new int[]{keys.get(i), keys.get(j)};
            if (s < target) i++;                          // need a bigger sum
            else j--;                                     // need a smaller sum
        }
        return null;
    }

    public static void main(String[] args) {
        Node root = null;
        for (int x : new int[]{20, 8, 22, 4, 12, 10, 14}) root = insert(root, x);
        for (int target : new int[]{30, 29}) {
            int[] res = pairSum(root, target);
            System.out.println("sum=" + target + ": " + (res == null ? "No" : "Yes (" + res[0] + " + " + res[1] + ")"));
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {
    if (!root) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;
}

function inorder(node, out) {
    if (!node) return;
    inorder(node.left, out);
    out.push(node.key);
    inorder(node.right, out);
}

function pairSum(root, target) {
    const keys = [];
    inorder(root, keys);                                  // sorted keys
    let i = 0, j = keys.length - 1;
    while (i < j) {                                       // two pointers on a sorted array
        const s = keys[i] + keys[j];
        if (s === target) return [keys[i], keys[j]];
        if (s < target) i++;                              // need a bigger sum
        else j--;                                         // need a smaller sum
    }
    return null;
}

let root = null;
for (const x of [20, 8, 22, 4, 12, 10, 14]) root = insert(root, x);
for (const target of [30, 29]) {
    const res = pairSum(root, target);
    console.log(`sum=${target}:`, res ? `Yes (${res[0]} + ${res[1]})` : "No");
}
```

```text filename:Output
sum=30: Yes (8 + 22)
sum=29: No
```

Time O(n) · Space O(n)

> [!NOTE] Idea
>
> <strong>Method 2 — hash set during the traversal.</strong> Visit the nodes (inorder here, but any order works) and keep the keys seen so far in a set. At each node ask whether `target - key` has already been seen; if not, add `key`. This is exactly the array “pair sum with hashing” solution, run on the tree in place. It reports a different (equally valid) pair than the two-pointer method — `10 + 20` is complete as soon as `20` is visited, before `22` is reached.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root

def pair_sum(node, target, seen):
    if node is None:
        return None
    found = pair_sum(node.left, target, seen)
    if found:
        return found
    if target - node.key in seen:            # the partner was visited earlier
        return (target - node.key, node.key)
    seen.add(node.key)
    return pair_sum(node.right, target, seen)

root = None
for x in [20, 8, 22, 4, 12, 10, 14]:
    root = insert(root, x)
for target in (30, 29):
    res = pair_sum(root, target, set())      # a fresh set per query
    print(f"sum={target}:", f"Yes ({res[0]} + {res[1]})" if res else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
using namespace std;

struct Node {
    int key;
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;
}

bool pairSum(Node* node, int target, unordered_set<int>& seen, int& a, int& b) {
    if (!node) return false;
    if (pairSum(node->left, target, seen, a, b)) return true;
    if (seen.count(target - node->key)) {               // the partner was visited earlier
        a = target - node->key; b = node->key;
        return true;
    }
    seen.insert(node->key);
    return pairSum(node->right, target, seen, a, b);
}

int main() {
    Node* root = nullptr;
    for (int x : {20, 8, 22, 4, 12, 10, 14}) root = insert(root, x);
    for (int target : {30, 29}) {
        unordered_set<int> seen;                         // a fresh set per query
        int a, b;
        if (pairSum(root, target, seen, a, b)) cout << "sum=" << target << ": Yes (" << a << " + " << b << ")\n";
        else cout << "sum=" << target << ": No\n";
    }
}
```

```java filename:Java
import java.util.HashSet;
import java.util.Set;

public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;
    }

    static int[] pairSum(Node node, int target, Set<Integer> seen) {
        if (node == null) return null;
        int[] found = pairSum(node.left, target, seen);
        if (found != null) return found;
        if (seen.contains(target - node.key))             // the partner was visited earlier
            return new int[]{target - node.key, node.key};
        seen.add(node.key);
        return pairSum(node.right, target, seen);
    }

    public static void main(String[] args) {
        Node root = null;
        for (int x : new int[]{20, 8, 22, 4, 12, 10, 14}) root = insert(root, x);
        for (int target : new int[]{30, 29}) {
            int[] res = pairSum(root, target, new HashSet<>());   // a fresh set per query
            System.out.println("sum=" + target + ": " + (res == null ? "No" : "Yes (" + res[0] + " + " + res[1] + ")"));
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {
    if (!root) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;
}

function pairSum(node, target, seen) {
    if (!node) return null;
    const found = pairSum(node.left, target, seen);
    if (found) return found;
    if (seen.has(target - node.key))                      // the partner was visited earlier
        return [target - node.key, node.key];
    seen.add(node.key);
    return pairSum(node.right, target, seen);
}

let root = null;
for (const x of [20, 8, 22, 4, 12, 10, 14]) root = insert(root, x);
for (const target of [30, 29]) {
    const res = pairSum(root, target, new Set());        // a fresh set per query
    console.log(`sum=${target}:`, res ? `Yes (${res[0]} + ${res[1]})` : "No");
}
```

```text filename:Output
sum=30: Yes (10 + 20)
sum=29: No
```

Time O(n) · Space O(n)

> [!NOTE] Key point
>
> Both methods are `O(n)` time and `O(n)` extra space. The <strong>`O(h)`</strong><strong> space</strong> version runs the two-pointer idea directly on the tree: one stack performs a forward inorder (left-node-right) and a second stack a reverse inorder (right-node-left); advance whichever side the two-pointer rule says to move. It is the same algorithm with the sorted array replaced by two lazy iterators.

> [!WARNING] Pitfall
>
> `target - node.key in seen` must be checked <strong>before</strong> `seen.add(node.key)`; otherwise a node pairs with itself when `target = 2 * key` (sum `40` would report `20 + 20` on tree A).

# Interview Q&amp;A

```question
Why is the inorder traversal of a BST sorted?

---

Inorder visits the left subtree, then the node, then the right subtree. By the BST invariant everything in the left subtree is smaller than the node and everything in the right subtree is larger, and the same holds recursively inside each subtree — so the sequence produced is ascending. Reverse inorder (right, node, left) gives descending order.
```

```question
How do you find the kth smallest in O(h) when the tree changes over time?

---

Augment every node with the size of its left subtree. Insert and delete update that count along the single path they touch (`O(h)`), and the query walks down comparing `k` with `lcount + 1`. The plain inorder method is `O(h + k)` per query and needs no extra field — fine for one-off queries, not for a stream of them.
```

```question
Why does comparing a node with its children not prove a tree is a BST?

---

Because the invariant constrains a node by <strong>all</strong> its ancestors. In tree B above, `25` is a valid right child of `8` but it lives in the left subtree of `20`, where every key must be below `20`. Pass down the `(lo, hi)` range from the ancestors, or check that the inorder sequence strictly increases — both are `O(n)`.
```

```question
Two nodes of a BST were swapped. How many dips can the inorder sequence have, and which nodes do you swap back?

---

One or two. If the swapped nodes are adjacent in inorder there is one dip and its two elements are the culprits. Otherwise there are two dips: the larger element of the first dip and the smaller element of the second. Recording `first = prev` only at the first dip and `second = node` at every dip handles both cases with one pass.
```

```question
What are std::set, TreeMap and heapq in terms of BSTs?

---

`std::set`/`std::map` and Java's `TreeSet`/`TreeMap` are red-black trees — self-balancing BSTs with `O(log n)` insert, delete, `lower_bound`/`ceiling`, `floor` and ordered iteration. `heapq` is <strong>not</strong> a BST: a heap only exposes its minimum, so it cannot answer floor/ceiling or kth queries. Python and JavaScript have no ordered-set container in the standard library.
```

```question
How would you find the lowest common ancestor of two keys in a BST?

---

Walk down from the root: if both keys are smaller go left, if both are larger go right, otherwise the current node is the split point and therefore the LCA. `O(h)` time, no parent pointers and no recursion needed — a general binary tree needs an `O(n)` traversal instead.
```
