---
id: 7540e22a-9094-78c1-8780-dffef668d526
key: topic:dsa-basics/bst
subject: dsa-basics
topic: bst
title: Binary Search Tree
slug: binary-search-tree
order: 1
---

A binary search tree keeps keys <strong>in order</strong>: smaller keys to the left, larger to the right, at every node. That one rule turns search, insert, delete, floor and ceiling into a single walk down one path — `O(log n)` when the tree is balanced — and makes an inorder traversal print the keys sorted.

> [!INFO]
>
> <strong>Binary search tree (BST)</strong> — a binary tree in which, for <strong>every</strong> node, all keys in its left subtree are smaller than the node's key and all keys in its right subtree are greater. Keys are usually assumed distinct. Like a linked list it is a <em>linked</em> data structure: nodes connected by pointers, no fixed capacity.

```text filename:The%20sample%20BST%3A%20an%20empty%20tree%20after%20inserting%2020%2C%2015%2C%2030%2C%2040%2C%2050%2C%2012%2C%2018%2C%2035%2C%2080%2C%207%20in%20that%20order
          20
       /      \
     15        30
    /  \         \
  12    18        40
 /               /  \
7              35    50
                       \
                        80
```

Check the invariant at any node: left of `20` are `15 12 18 7` (all smaller), right are `30 40 35 50 80` (all larger). Left of `40` is `35`, right is `50 80`. It holds <strong>for the whole subtree</strong>, not just the two children — a tree where `35` sat under `15` would have every child in order and still be wrong.

> [!WARNING] Watch out
>
> The invariant is <em>left subtree &lt; node &lt; right subtree</em>, <strong>not</strong> <em>left child &lt; node &lt; right child</em>. A node's right child may have a left child, and that grandchild must still be greater than the node — e.g. `35` is a left child of `40` but greater than `30`.

# Why a BST: comparison with other structures

A BST is the structure for data that must stay <strong>sorted while it changes</strong>. Arrays are fast at one thing and slow at the other; a hash table is fastest for exact lookups but knows nothing about order.

| Operation | Unsorted array | Sorted array | Linked list | BST (balanced) | Hash table |
| --- | --- | --- | --- | --- | --- |
| Search | O(n) | O(log n) | O(n) | <strong>O(log n)</strong> | O(1) average |
| Insert | O(1) | O(n) | O(1) | <strong>O(log n)</strong> | O(1) average |
| Delete | O(n) | O(n) | O(n) | <strong>O(log n)</strong> | O(1) average |
| Find closest (floor / ceiling) | O(n) | O(log n) | O(n) | <strong>O(log n)</strong> | O(n) |
| Sorted traversal | O(n log n) | O(n) | O(n log n) | <strong>O(n)</strong> | O(n log n) |

Every BST operation walks one root-to-leaf path, so it costs `O(h)` where `h` is the height. The <em>balanced</em> column assumes `h = O(log n)`; the self-balancing section shows how libraries guarantee it. Those libraries are the ready-made BSTs you should normally use:

| Language | Ordered set | Ordered map | Implementation |
| --- | --- | --- | --- |
| C++ | `std::set`, `std::multiset` | `std::map`, `std::multimap` | red-black tree |
| Java | `TreeSet` | `TreeMap` | red-black tree |
| Python | — (use `sortedcontainers.SortedList`, or `bisect` on a list) | — | no BST in the standard library |
| JavaScript | — | — | none built in — implement one or use a library |

# Operations and their cost

| Operation | How | Time |
| --- | --- | --- |
| `search(k)` | Go left if `k` is smaller, right if larger, stop on match or `null` | O(h) |
| `insert(k)` | Search for `k`; attach a new leaf where the search fell off | O(h) |
| `delete(k)` | Search, then one of three cases (leaf, one child, two children) | O(h) |
| `min()` / `max()` | Follow left / right pointers to the end | O(h) |
| `floor(k)` / `ceil(k)` | Search, remembering the last candidate on the way down | O(h) |
| `inorder()` | Left, node, right — visits keys in sorted order | O(n) |

`h` is `⌈log₂(n + 1)⌉` for a perfectly balanced tree and `n` for a degenerate one, so the same code runs in `O(log n)` or `O(n)` depending only on the <strong>shape</strong>.

# Insert

> [!TIP] Example
>
> <strong>Input:</strong> `insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7 into an empty tree`<br><strong>Output:</strong> `the sample BST; inorder 7 12 15 18 20 30 35 40 50 80`<br><strong>Input:</strong> `then insert 60`<br><strong>Output:</strong> `60 becomes the left child of 80`

> [!NOTE] Idea
>
> Search for the key. If you find it, do nothing (no duplicates). If you fall off the tree at a `null` pointer, that is exactly where the key belongs: create a leaf there. The recursive version returns the (possibly new) root of each subtree so the parent can re-attach it — `root.left = insert(root.left, key)` — which handles the empty-tree case for free.

```text filename:Every%20insert%20adds%20a%20new%20leaf%20at%20the%20point%20where%20the%20search%20ends
insert 7:   20 → smaller, go left            20
            15 → smaller, go left          /    \
            12 → smaller, go left        15      30
            null → create 7 here        /  \       \
                                      12    18      40
                                     /             /  \
                                   [7]           35    50
```

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):               # insert key, keeping the BST invariant
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root                      # duplicates are ignored

def inorder(root):
    if root:
        inorder(root.left)
        print(root.key, end=" ")
        inorder(root.right)

def sample_bst():                    # insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    root = None
    for key in (20, 15, 30, 40, 50, 12, 18, 35, 80, 7):
        root = insert(root, key)
    return root

root = sample_bst()
print("inorder:", end=" "); inorder(root); print()
print("root:", root.key)
root = insert(root, 40)              # already present: tree unchanged
print("after insert 40 (duplicate):", end=" "); inorder(root); print()
root = insert(root, 60)              # 20 → 30 → 40 → 50 → 80 → left of 80
print("after insert 60:", end=" "); inorder(root); print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* insert(Node* root, int key) {       // insert key, keeping the BST invariant
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;                          // duplicates are ignored
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->key << " ";
    inorder(root->right);
}

Node* sampleBST() {                       // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    Node* root = nullptr;
    for (int key : {20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
    return root;
}

int main() {
    Node* root = sampleBST();
    cout << "inorder: "; inorder(root); cout << "\n";
    cout << "root: " << root->key << "\n";
    root = insert(root, 40);              // already present: tree unchanged
    cout << "after insert 40 (duplicate): "; inorder(root); cout << "\n";
    root = insert(root, 60);              // 20 → 30 → 40 → 50 → 80 → left of 80
    cout << "after insert 60: "; inorder(root); cout << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {   // insert key, keeping the BST invariant
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;                           // duplicates are ignored
    }

    static void inorder(Node root) {
        if (root == null) return;
        inorder(root.left);
        System.out.print(root.key + " ");
        inorder(root.right);
    }

    static Node sampleBST() {                  // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
        Node root = null;
        for (int key : new int[]{20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
        return root;
    }

    public static void main(String[] args) {
        Node root = sampleBST();
        System.out.print("inorder: "); inorder(root); System.out.println();
        System.out.println("root: " + root.key);
        root = insert(root, 40);               // already present: tree unchanged
        System.out.print("after insert 40 (duplicate): "); inorder(root); System.out.println();
        root = insert(root, 60);               // 20 → 30 → 40 → 50 → 80 → left of 80
        System.out.print("after insert 60: "); inorder(root); System.out.println();
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {              // insert key, keeping the BST invariant
    if (root === null) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;                          // duplicates are ignored
}

function inorder(root) {
    if (root === null) return;
    inorder(root.left);
    process.stdout.write(root.key + " ");
    inorder(root.right);
}

function sampleBST() {                    // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    let root = null;
    for (const key of [20, 15, 30, 40, 50, 12, 18, 35, 80, 7]) root = insert(root, key);
    return root;
}

let root = sampleBST();
process.stdout.write("inorder: "); inorder(root); console.log();
console.log("root:", root.key);
root = insert(root, 40);                  // already present: tree unchanged
process.stdout.write("after insert 40 (duplicate): "); inorder(root); console.log();
root = insert(root, 60);                  // 20 → 30 → 40 → 50 → 80 → left of 80
process.stdout.write("after insert 60: "); inorder(root); console.log();
```

```text filename:Output
inorder: 7 12 15 18 20 30 35 40 50 80
root: 20
after insert 40 (duplicate): 7 12 15 18 20 30 35 40 50 80
after insert 60: 7 12 15 18 20 30 35 40 50 60 80
```

Time O(h) · Space O(h) recursion stack

<strong>Iterative insert</strong> avoids the recursion stack: walk down with a `parent` pointer until `curr` is `null`, then hang the new node on the correct side of `parent`. Same `O(h)` time, `O(1)` extra space.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert_iter(root, key):
    node = Node(key)
    if root is None:
        return node                      # empty tree: the new node is the root
    parent, curr = None, root
    while curr is not None:              # search, remembering the parent
        if key == curr.key:
            return root                  # duplicate: nothing to do
        parent = curr
        curr = curr.left if key < curr.key else curr.right
    if key < parent.key:                 # hang the leaf on the correct side
        parent.left = node
    else:
        parent.right = node
    return root

def inorder(root):
    if root:
        inorder(root.left)
        print(root.key, end=" ")
        inorder(root.right)

root = None
for key in (20, 15, 30, 40, 50, 12, 18, 35, 80, 7):
    root = insert_iter(root, key)
print("inorder:", end=" "); inorder(root); print()
print("root:", root.key)
root = insert_iter(root, 40)
print("after insert 40 (duplicate):", end=" "); inorder(root); print()
root = insert_iter(root, 60)
print("after insert 60:", end=" "); inorder(root); print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* insertIter(Node* root, int key) {
    Node* node = new Node(key);
    if (!root) return node;                   // empty tree: the new node is the root
    Node* parent = nullptr;
    Node* curr = root;
    while (curr) {                            // search, remembering the parent
        if (key == curr->key) { delete node; return root; }   // duplicate
        parent = curr;
        curr = key < curr->key ? curr->left : curr->right;
    }
    if (key < parent->key) parent->left = node;   // hang the leaf on the correct side
    else parent->right = node;
    return root;
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->key << " ";
    inorder(root->right);
}

int main() {
    Node* root = nullptr;
    for (int key : {20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insertIter(root, key);
    cout << "inorder: "; inorder(root); cout << "\n";
    cout << "root: " << root->key << "\n";
    root = insertIter(root, 40);
    cout << "after insert 40 (duplicate): "; inorder(root); cout << "\n";
    root = insertIter(root, 60);
    cout << "after insert 60: "; inorder(root); cout << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insertIter(Node root, int key) {
        Node node = new Node(key);
        if (root == null) return node;             // empty tree: the new node is the root
        Node parent = null, curr = root;
        while (curr != null) {                     // search, remembering the parent
            if (key == curr.key) return root;      // duplicate: nothing to do
            parent = curr;
            curr = key < curr.key ? curr.left : curr.right;
        }
        if (key < parent.key) parent.left = node;  // hang the leaf on the correct side
        else parent.right = node;
        return root;
    }

    static void inorder(Node root) {
        if (root == null) return;
        inorder(root.left);
        System.out.print(root.key + " ");
        inorder(root.right);
    }

    public static void main(String[] args) {
        Node root = null;
        for (int key : new int[]{20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insertIter(root, key);
        System.out.print("inorder: "); inorder(root); System.out.println();
        System.out.println("root: " + root.key);
        root = insertIter(root, 40);
        System.out.print("after insert 40 (duplicate): "); inorder(root); System.out.println();
        root = insertIter(root, 60);
        System.out.print("after insert 60: "); inorder(root); System.out.println();
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insertIter(root, key) {
    const node = new Node(key);
    if (root === null) return node;           // empty tree: the new node is the root
    let parent = null, curr = root;
    while (curr !== null) {                   // search, remembering the parent
        if (key === curr.key) return root;    // duplicate: nothing to do
        parent = curr;
        curr = key < curr.key ? curr.left : curr.right;
    }
    if (key < parent.key) parent.left = node; // hang the leaf on the correct side
    else parent.right = node;
    return root;
}

function inorder(root) {
    if (root === null) return;
    inorder(root.left);
    process.stdout.write(root.key + " ");
    inorder(root.right);
}

let root = null;
for (const key of [20, 15, 30, 40, 50, 12, 18, 35, 80, 7]) root = insertIter(root, key);
process.stdout.write("inorder: "); inorder(root); console.log();
console.log("root:", root.key);
root = insertIter(root, 40);
process.stdout.write("after insert 40 (duplicate): "); inorder(root); console.log();
root = insertIter(root, 60);
process.stdout.write("after insert 60: "); inorder(root); console.log();
```

```text filename:Output
inorder: 7 12 15 18 20 30 35 40 50 80
root: 20
after insert 40 (duplicate): 7 12 15 18 20 30 35 40 50 80
after insert 60: 7 12 15 18 20 30 35 40 50 60 80
```

Time O(h) · Space O(1)

> [!WARNING] Pitfall
>
> Inserting keys that arrive <strong>already sorted</strong> (`1, 2, 3, 4, …`) builds a right-skewed chain of height `n`: every later operation is `O(n)`. Shuffle the input, or use a self-balancing tree.

> [!NOTE] Key point
>
> Inorder traversal of a BST always prints the keys in ascending order — so <em>build a BST, traverse inorder</em> is a sorting algorithm (tree sort), `O(n log n)` when the tree stays balanced.

# Search

> [!TIP] Example
>
> <strong>Input:</strong> `the sample BST, key = 7`<br><strong>Output:</strong> `true`<br><strong>Input:</strong> `key = 25`<br><strong>Output:</strong> `false`

> [!NOTE] Idea
>
> Compare the key with the current node. Equal — found. Smaller — the key can only be in the left subtree, so go left. Larger — go right. Reaching `null` means the key is absent. Each step discards an entire subtree, which is why it is `O(h)` and not `O(n)`: binary search on a tree.

```text filename:A%20search%20follows%20one%20path%20from%20the%20root
search 7:  20 → 15 → 12 → 7  ✓ found (4 comparisons)
search 25: 20 → 30 → null    ✗ 25 > 20 go right, 25 < 30 go left, nothing there
```

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):               # insert key, keeping the BST invariant
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root                      # duplicates are ignored

def inorder(root):
    if root:
        inorder(root.left)
        print(root.key, end=" ")
        inorder(root.right)

def sample_bst():                    # insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    root = None
    for key in (20, 15, 30, 40, 50, 12, 18, 35, 80, 7):
        root = insert(root, key)
    return root

def search(root, key):                   # recursive
    if root is None:
        return False
    if key == root.key:
        return True
    if key < root.key:
        return search(root.left, key)    # only the left subtree can hold it
    return search(root.right, key)

def search_iter(root, key):              # iterative: O(1) space
    while root is not None:
        if key == root.key:
            return True
        root = root.left if key < root.key else root.right
    return False

root = sample_bst()
print("search 7:", "true" if search(root, 7) else "false")
print("search 25:", "true" if search(root, 25) else "false")
print("search 35 (iterative):", "true" if search_iter(root, 35) else "false")
print("search 100 (iterative):", "true" if search_iter(root, 100) else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* insert(Node* root, int key) {       // insert key, keeping the BST invariant
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;                          // duplicates are ignored
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->key << " ";
    inorder(root->right);
}

Node* sampleBST() {                       // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    Node* root = nullptr;
    for (int key : {20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
    return root;
}

bool search(Node* root, int key) {            // recursive
    if (!root) return false;
    if (key == root->key) return true;
    if (key < root->key) return search(root->left, key);   // only the left subtree can hold it
    return search(root->right, key);
}

bool searchIter(Node* root, int key) {        // iterative: O(1) space
    while (root) {
        if (key == root->key) return true;
        root = key < root->key ? root->left : root->right;
    }
    return false;
}

int main() {
    Node* root = sampleBST();
    cout << "search 7: " << (search(root, 7) ? "true" : "false") << "\n";
    cout << "search 25: " << (search(root, 25) ? "true" : "false") << "\n";
    cout << "search 35 (iterative): " << (searchIter(root, 35) ? "true" : "false") << "\n";
    cout << "search 100 (iterative): " << (searchIter(root, 100) ? "true" : "false") << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {   // insert key, keeping the BST invariant
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;                           // duplicates are ignored
    }

    static void inorder(Node root) {
        if (root == null) return;
        inorder(root.left);
        System.out.print(root.key + " ");
        inorder(root.right);
    }

    static Node sampleBST() {                  // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
        Node root = null;
        for (int key : new int[]{20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
        return root;
    }

    static boolean search(Node root, int key) {        // recursive
        if (root == null) return false;
        if (key == root.key) return true;
        if (key < root.key) return search(root.left, key);   // only the left subtree can hold it
        return search(root.right, key);
    }

    static boolean searchIter(Node root, int key) {    // iterative: O(1) space
        while (root != null) {
            if (key == root.key) return true;
            root = key < root.key ? root.left : root.right;
        }
        return false;
    }

    public static void main(String[] args) {
        Node root = sampleBST();
        System.out.println("search 7: " + search(root, 7));
        System.out.println("search 25: " + search(root, 25));
        System.out.println("search 35 (iterative): " + searchIter(root, 35));
        System.out.println("search 100 (iterative): " + searchIter(root, 100));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {              // insert key, keeping the BST invariant
    if (root === null) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;                          // duplicates are ignored
}

function inorder(root) {
    if (root === null) return;
    inorder(root.left);
    process.stdout.write(root.key + " ");
    inorder(root.right);
}

function sampleBST() {                    // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    let root = null;
    for (const key of [20, 15, 30, 40, 50, 12, 18, 35, 80, 7]) root = insert(root, key);
    return root;
}

function search(root, key) {                  // recursive
    if (root === null) return false;
    if (key === root.key) return true;
    if (key < root.key) return search(root.left, key);   // only the left subtree can hold it
    return search(root.right, key);
}

function searchIter(root, key) {              // iterative: O(1) space
    while (root !== null) {
        if (key === root.key) return true;
        root = key < root.key ? root.left : root.right;
    }
    return false;
}

const root = sampleBST();
console.log("search 7:", search(root, 7));
console.log("search 25:", search(root, 25));
console.log("search 35 (iterative):", searchIter(root, 35));
console.log("search 100 (iterative):", searchIter(root, 100));
```

```text filename:Output
search 7: true
search 25: false
search 35 (iterative): true
search 100 (iterative): false
```

Time O(h) · Space O(h) recursive, O(1) iterative

> [!NOTE] Key point
>
> The recursion here is a <strong>tail call</strong> — nothing happens after it returns — which is why the iterative version is a trivial rewrite and the one to prefer in production code.

# Delete

> [!TIP] Example
>
> <strong>Input:</strong> `the sample BST, delete 7 (a leaf)`<br><strong>Output:</strong> `inorder 12 15 18 20 30 35 40 50 80`<br><strong>Input:</strong> `delete 30 (one child)`<br><strong>Output:</strong> `40 takes its place: 12 15 18 20 35 40 50 80`<br><strong>Input:</strong> `delete 20 (two children)`<br><strong>Output:</strong> `replaced by its inorder successor 35: 12 15 18 35 40 50 80`

> [!NOTE] Idea
>
> Search for the key, then fix the hole it leaves. A <strong>leaf</strong> can simply go. A node with <strong>one child</strong> is replaced by that child. A node with <strong>two children</strong> cannot be unlinked without breaking the shape — instead copy the <strong>inorder successor</strong> (the smallest key of the right subtree, found by walking left from `right`) into the node and delete the successor from the right subtree; the successor has no left child, so that second deletion is always case 1 or 2.

```text filename:The%20three%20cases%20of%20BST%20deletion
Case 1 — leaf: unlink it            Case 2 — one child: parent adopts the child
        15                                   20                 20
       /  \        delete 7                   \     delete 30     \
     12    18     ────────▶    12             30   ──────────▶    40
    /                                            \               /  \
   7                                              40           35    50

Case 3 — two children: copy the inorder successor, then delete the successor
        20          successor of 20 = min of right subtree = 35
     /      \                                   35
   15        40        delete 20             /      \
  /  \      /  \      ────────▶            15        40
12    18  35    50                        /  \         \
 /               \                      12    18        50
7                 80                     /                \
                                        7                  80
```

1. <strong>Find the node</strong>

   Recurse left or right as in search; `root.left = delete(root.left, key)` re-attaches whatever comes back.

2. <strong>Leaf, or one child</strong>

   Return the child (or `null`) to the parent — the node is bypassed.

3. <strong>Two children</strong>

   Find `succ = min(root.right)`, copy `succ.key` into `root`, then `root.right = delete(root.right, succ.key)`.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):               # insert key, keeping the BST invariant
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root                      # duplicates are ignored

def inorder(root):
    if root:
        inorder(root.left)
        print(root.key, end=" ")
        inorder(root.right)

def sample_bst():                    # insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    root = None
    for key in (20, 15, 30, 40, 50, 12, 18, 35, 80, 7):
        root = insert(root, key)
    return root

def min_node(node):                      # leftmost node of a subtree
    while node.left is not None:
        node = node.left
    return node

def delete_key(root, key):
    if root is None:
        return None
    if key < root.key:
        root.left = delete_key(root.left, key)
    elif key > root.key:
        root.right = delete_key(root.right, key)
    else:                                # found it
        if root.left is None:            # case 1 & 2: zero or one child
            return root.right
        if root.right is None:
            return root.left
        succ = min_node(root.right)      # case 3: two children
        root.key = succ.key              # copy the inorder successor ...
        root.right = delete_key(root.right, succ.key)   # ... and remove it from the right
    return root

root = sample_bst()
root = delete_key(root, 7)
print("delete 7 (leaf):", end=" "); inorder(root); print()
root = delete_key(root, 30)
print("delete 30 (one child):", end=" "); inorder(root); print()
root = delete_key(root, 20)
print("delete 20 (two children):", end=" "); inorder(root); print()
print("new root:", root.key)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* insert(Node* root, int key) {       // insert key, keeping the BST invariant
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;                          // duplicates are ignored
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->key << " ";
    inorder(root->right);
}

Node* sampleBST() {                       // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    Node* root = nullptr;
    for (int key : {20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
    return root;
}

Node* minNode(Node* node) {                   // leftmost node of a subtree
    while (node->left) node = node->left;
    return node;
}

Node* deleteKey(Node* root, int key) {
    if (!root) return nullptr;
    if (key < root->key) root->left = deleteKey(root->left, key);
    else if (key > root->key) root->right = deleteKey(root->right, key);
    else {                                    // found it
        if (!root->left || !root->right) {    // case 1 & 2: zero or one child
            Node* child = root->left ? root->left : root->right;
            delete root;
            return child;
        }
        Node* succ = minNode(root->right);    // case 3: two children
        root->key = succ->key;                // copy the inorder successor ...
        root->right = deleteKey(root->right, succ->key);   // ... and remove it from the right
    }
    return root;
}

int main() {
    Node* root = sampleBST();
    root = deleteKey(root, 7);
    cout << "delete 7 (leaf): "; inorder(root); cout << "\n";
    root = deleteKey(root, 30);
    cout << "delete 30 (one child): "; inorder(root); cout << "\n";
    root = deleteKey(root, 20);
    cout << "delete 20 (two children): "; inorder(root); cout << "\n";
    cout << "new root: " << root->key << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {   // insert key, keeping the BST invariant
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;                           // duplicates are ignored
    }

    static void inorder(Node root) {
        if (root == null) return;
        inorder(root.left);
        System.out.print(root.key + " ");
        inorder(root.right);
    }

    static Node sampleBST() {                  // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
        Node root = null;
        for (int key : new int[]{20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
        return root;
    }

    static Node minNode(Node node) {               // leftmost node of a subtree
        while (node.left != null) node = node.left;
        return node;
    }

    static Node deleteKey(Node root, int key) {
        if (root == null) return null;
        if (key < root.key) root.left = deleteKey(root.left, key);
        else if (key > root.key) root.right = deleteKey(root.right, key);
        else {                                     // found it
            if (root.left == null) return root.right;   // case 1 & 2: zero or one child
            if (root.right == null) return root.left;
            Node succ = minNode(root.right);       // case 3: two children
            root.key = succ.key;                   // copy the inorder successor ...
            root.right = deleteKey(root.right, succ.key);   // ... and remove it from the right
        }
        return root;
    }

    public static void main(String[] args) {
        Node root = sampleBST();
        root = deleteKey(root, 7);
        System.out.print("delete 7 (leaf): "); inorder(root); System.out.println();
        root = deleteKey(root, 30);
        System.out.print("delete 30 (one child): "); inorder(root); System.out.println();
        root = deleteKey(root, 20);
        System.out.print("delete 20 (two children): "); inorder(root); System.out.println();
        System.out.println("new root: " + root.key);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {              // insert key, keeping the BST invariant
    if (root === null) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;                          // duplicates are ignored
}

function inorder(root) {
    if (root === null) return;
    inorder(root.left);
    process.stdout.write(root.key + " ");
    inorder(root.right);
}

function sampleBST() {                    // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    let root = null;
    for (const key of [20, 15, 30, 40, 50, 12, 18, 35, 80, 7]) root = insert(root, key);
    return root;
}

function minNode(node) {                      // leftmost node of a subtree
    while (node.left !== null) node = node.left;
    return node;
}

function deleteKey(root, key) {
    if (root === null) return null;
    if (key < root.key) root.left = deleteKey(root.left, key);
    else if (key > root.key) root.right = deleteKey(root.right, key);
    else {                                    // found it
        if (root.left === null) return root.right;    // case 1 & 2: zero or one child
        if (root.right === null) return root.left;
        const succ = minNode(root.right);     // case 3: two children
        root.key = succ.key;                  // copy the inorder successor ...
        root.right = deleteKey(root.right, succ.key);   // ... and remove it from the right
    }
    return root;
}

let root = sampleBST();
root = deleteKey(root, 7);
process.stdout.write("delete 7 (leaf): "); inorder(root); console.log();
root = deleteKey(root, 30);
process.stdout.write("delete 30 (one child): "); inorder(root); console.log();
root = deleteKey(root, 20);
process.stdout.write("delete 20 (two children): "); inorder(root); console.log();
console.log("new root:", root.key);
```

```text filename:Output
delete 7 (leaf): 12 15 18 20 30 35 40 50 80
delete 30 (one child): 12 15 18 20 35 40 50 80
delete 20 (two children): 12 15 18 35 40 50 80
new root: 35
```

Time O(h) · Space O(h)

> [!WARNING] Pitfall
>
> In case 3 you may equally use the <strong>inorder predecessor</strong> (max of the left subtree). What you must not do is move the successor <em>node</em> without removing it from where it was, or forget to re-attach the result of the recursive delete — the classic bug is `delete_key(root.right, succ.key)` without the `root.right =`.

> [!NOTE] Key point
>
> Why `O(h)`: the search is one path down, and the successor walk plus its deletion continue down the <strong>same</strong> path (successor is in the right subtree, and deleting it is another walk down). Total work is at most twice the height.

# Floor in a BST

> [!TIP] Example
>
> <strong>Input:</strong> `the sample BST, x = 14`<br><strong>Output:</strong> `12 (the largest key ≤ 14)`<br><strong>Input:</strong> `x = 1`<br><strong>Output:</strong> `none (every key is larger)`<br><strong>Input:</strong> `x = 20`<br><strong>Output:</strong> `20`<br><strong>Input:</strong> `x = 100`<br><strong>Output:</strong> `80`

> [!INFO]
>
> <strong>Floor of x</strong> — the largest key in the tree that is <strong>≤ x</strong>. Ceiling is the smallest key <strong>≥ x</strong>. Together they answer <em>what is closest to x</em> — something a hash table cannot do.

> [!NOTE] Idea
>
> Walk down as in search, keeping the best candidate seen so far. At a node with key <strong>&lt; x</strong> the node is a candidate — remember it, then go <strong>right</strong> to look for something closer to `x`. At a node with key <strong>&gt; x</strong> it cannot be the floor, go <strong>left</strong>. On an exact match the answer is the node itself. When the walk hits `null`, the remembered candidate is the floor.

1. <strong>key == x</strong>

   Return this node — nothing can be closer.

2. <strong>key &gt; x</strong>

   Too big; the floor must be in the left subtree: `root = root.left`.

3. <strong>key &lt; x</strong>

   A valid candidate; a larger one may exist to the right: `res = root; root = root.right`.

```text filename:The%20candidate%20is%20updated%20only%20when%20we%20step%20right
floor(14):  20 > 14  → go left           candidate: —
            15 > 14  → go left           candidate: —
            12 < 14  → remember, go right  candidate: 12
            null     → answer 12
```

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):               # insert key, keeping the BST invariant
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root                      # duplicates are ignored

def inorder(root):
    if root:
        inorder(root.left)
        print(root.key, end=" ")
        inorder(root.right)

def sample_bst():                    # insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    root = None
    for key in (20, 15, 30, 40, 50, 12, 18, 35, 80, 7):
        root = insert(root, key)
    return root

def floor(root, x):
    res = None
    while root is not None:
        if root.key == x:
            return root                  # exact match
        if root.key > x:
            root = root.left             # too big: look left
        else:
            res = root                   # candidate; a larger one may be on the right
            root = root.right
    return res

root = sample_bst()
for x in (14, 1, 20, 100):
    node = floor(root, x)
    print(f"floor({x}) =", node.key if node else "none")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* insert(Node* root, int key) {       // insert key, keeping the BST invariant
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;                          // duplicates are ignored
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->key << " ";
    inorder(root->right);
}

Node* sampleBST() {                       // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    Node* root = nullptr;
    for (int key : {20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
    return root;
}

Node* floorNode(Node* root, int x) {
    Node* res = nullptr;
    while (root) {
        if (root->key == x) return root;      // exact match
        if (root->key > x) root = root->left; // too big: look left
        else { res = root; root = root->right; }   // candidate; a larger one may be on the right
    }
    return res;
}

int main() {
    Node* root = sampleBST();
    for (int x : {14, 1, 20, 100}) {
        Node* node = floorNode(root, x);
        cout << "floor(" << x << ") = ";
        if (node) cout << node->key << "\n"; else cout << "none\n";
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {   // insert key, keeping the BST invariant
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;                           // duplicates are ignored
    }

    static void inorder(Node root) {
        if (root == null) return;
        inorder(root.left);
        System.out.print(root.key + " ");
        inorder(root.right);
    }

    static Node sampleBST() {                  // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
        Node root = null;
        for (int key : new int[]{20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
        return root;
    }

    static Node floor(Node root, int x) {
        Node res = null;
        while (root != null) {
            if (root.key == x) return root;            // exact match
            if (root.key > x) root = root.left;        // too big: look left
            else { res = root; root = root.right; }    // candidate; a larger one may be on the right
        }
        return res;
    }

    public static void main(String[] args) {
        Node root = sampleBST();
        for (int x : new int[]{14, 1, 20, 100}) {
            Node node = floor(root, x);
            System.out.println("floor(" + x + ") = " + (node != null ? String.valueOf(node.key) : "none"));
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {              // insert key, keeping the BST invariant
    if (root === null) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;                          // duplicates are ignored
}

function inorder(root) {
    if (root === null) return;
    inorder(root.left);
    process.stdout.write(root.key + " ");
    inorder(root.right);
}

function sampleBST() {                    // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    let root = null;
    for (const key of [20, 15, 30, 40, 50, 12, 18, 35, 80, 7]) root = insert(root, key);
    return root;
}

function floor(root, x) {
    let res = null;
    while (root !== null) {
        if (root.key === x) return root;          // exact match
        if (root.key > x) root = root.left;       // too big: look left
        else { res = root; root = root.right; }   // candidate; a larger one may be on the right
    }
    return res;
}

const root = sampleBST();
for (const x of [14, 1, 20, 100]) {
    const node = floor(root, x);
    console.log(`floor(${x}) =`, node ? node.key : "none");
}
```

```text filename:Output
floor(14) = 12
floor(1) = none
floor(20) = 20
floor(100) = 80
```

Time O(h) · Space O(1)

# Ceiling in a BST

> [!TIP] Example
>
> <strong>Input:</strong> `the sample BST, x = 21`<br><strong>Output:</strong> `30 (the smallest key ≥ 21)`<br><strong>Input:</strong> `x = 5`<br><strong>Output:</strong> `7`<br><strong>Input:</strong> `x = 7`<br><strong>Output:</strong> `7`<br><strong>Input:</strong> `x = 81`<br><strong>Output:</strong> `none`

> [!NOTE] Idea
>
> The mirror image of floor. A key <strong>&gt; x</strong> is a candidate — remember it and go <strong>left</strong> for something closer; a key <strong>&lt; x</strong> is useless, go <strong>right</strong>; an exact match is the answer.

1. <strong>key == x</strong>

   Return this node.

2. <strong>key &lt; x</strong>

   Too small; the ceiling must be on the right: `root = root.right`.

3. <strong>key &gt; x</strong>

   A valid candidate; a smaller one may exist to the left: `res = root; root = root.left`.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def insert(root, key):               # insert key, keeping the BST invariant
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    return root                      # duplicates are ignored

def inorder(root):
    if root:
        inorder(root.left)
        print(root.key, end=" ")
        inorder(root.right)

def sample_bst():                    # insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    root = None
    for key in (20, 15, 30, 40, 50, 12, 18, 35, 80, 7):
        root = insert(root, key)
    return root

def ceil(root, x):
    res = None
    while root is not None:
        if root.key == x:
            return root                  # exact match
        if root.key < x:
            root = root.right            # too small: look right
        else:
            res = root                   # candidate; a smaller one may be on the left
            root = root.left
    return res

root = sample_bst()
for x in (21, 5, 7, 81):
    node = ceil(root, x)
    print(f"ceil({x}) =", node.key if node else "none")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* insert(Node* root, int key) {       // insert key, keeping the BST invariant
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    return root;                          // duplicates are ignored
}

void inorder(Node* root) {
    if (!root) return;
    inorder(root->left);
    cout << root->key << " ";
    inorder(root->right);
}

Node* sampleBST() {                       // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    Node* root = nullptr;
    for (int key : {20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
    return root;
}

Node* ceilNode(Node* root, int x) {
    Node* res = nullptr;
    while (root) {
        if (root->key == x) return root;       // exact match
        if (root->key < x) root = root->right; // too small: look right
        else { res = root; root = root->left; }   // candidate; a smaller one may be on the left
    }
    return res;
}

int main() {
    Node* root = sampleBST();
    for (int x : {21, 5, 7, 81}) {
        Node* node = ceilNode(root, x);
        cout << "ceil(" << x << ") = ";
        if (node) cout << node->key << "\n"; else cout << "none\n";
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node insert(Node root, int key) {   // insert key, keeping the BST invariant
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        return root;                           // duplicates are ignored
    }

    static void inorder(Node root) {
        if (root == null) return;
        inorder(root.left);
        System.out.print(root.key + " ");
        inorder(root.right);
    }

    static Node sampleBST() {                  // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
        Node root = null;
        for (int key : new int[]{20, 15, 30, 40, 50, 12, 18, 35, 80, 7}) root = insert(root, key);
        return root;
    }

    static Node ceil(Node root, int x) {
        Node res = null;
        while (root != null) {
            if (root.key == x) return root;            // exact match
            if (root.key < x) root = root.right;       // too small: look right
            else { res = root; root = root.left; }     // candidate; a smaller one may be on the left
        }
        return res;
    }

    public static void main(String[] args) {
        Node root = sampleBST();
        for (int x : new int[]{21, 5, 7, 81}) {
            Node node = ceil(root, x);
            System.out.println("ceil(" + x + ") = " + (node != null ? String.valueOf(node.key) : "none"));
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function insert(root, key) {              // insert key, keeping the BST invariant
    if (root === null) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    return root;                          // duplicates are ignored
}

function inorder(root) {
    if (root === null) return;
    inorder(root.left);
    process.stdout.write(root.key + " ");
    inorder(root.right);
}

function sampleBST() {                    // insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7
    let root = null;
    for (const key of [20, 15, 30, 40, 50, 12, 18, 35, 80, 7]) root = insert(root, key);
    return root;
}

function ceil(root, x) {
    let res = null;
    while (root !== null) {
        if (root.key === x) return root;          // exact match
        if (root.key < x) root = root.right;      // too small: look right
        else { res = root; root = root.left; }    // candidate; a smaller one may be on the left
    }
    return res;
}

const root = sampleBST();
for (const x of [21, 5, 7, 81]) {
    const node = ceil(root, x);
    console.log(`ceil(${x}) =`, node ? node.key : "none");
}
```

```text filename:Output
ceil(21) = 30
ceil(5) = 7
ceil(7) = 7
ceil(81) = none
```

Time O(h) · Space O(1)

> [!NOTE] Key point
>
> Floor and ceiling in a <strong>sorted array</strong> are binary search (`bisect_right(a, x) - 1` and `bisect_left(a, x)` in Python). The BST versions are the same idea on a structure that also supports `O(log n)` insert and delete — which is exactly what <em>floor / ceiling in a stream</em> needs.

# Self-balancing BSTs: why and how

The same set of keys can make BSTs of very different heights — it depends only on the <strong>insertion order</strong>. The operations above are `O(h)`, so the whole point of balancing is to keep `h = O(log n)` no matter what order the keys arrive in.

```text filename:Same%20keys%2C%20two%20heights%3A%20every%20operation%20is%20O(n)%20on%20the%20left%20and%20O(log%20n)%20on%20the%20right
insert 7, 10, 11, 15, 30, 35, 40          insert 15, 10, 35, 7, 11, 30, 40
(sorted order → height 7)                 (balanced → height 3)

  7                                                  15
   \                                               /    \
    10                                           10      35
      \                                         /  \    /  \
       11                                      7    11 30   40
         \
          15
            \
             30
               \
                35
                  \
                   40
```

If all keys were known in advance we could build the perfectly balanced tree directly (insert the middle of the sorted keys, then recurse on each half). With <strong>random insertions and deletions</strong> we cannot — so a self-balancing tree <strong>restructures</strong> itself after every insert or delete that makes it lopsided.

```text filename:Inserting%20100%2C%20200%2C%20300%20produces%20a%20chain%3B%20one%20rotation%20turns%20it%20back%20into%20a%20balanced%20tree
insert 100          insert 200          insert 300           restructure
                                                             (rotate left at 100)
   100                 100                 100                     200
                          \                   \                   /   \
                           200                 200              100     300
                                                  \
                                                   300
```

The restructuring tool is the <strong>rotation</strong>: a local change of two or three pointers that moves a subtree one level up on one side and one level down on the other <strong>without breaking the BST order</strong> — the inorder sequence `T1 y T2 x T3` is the same before and after.

```text filename:A%20rotation%20re-hangs%20T2%20on%20the%20other%20node%20and%20is%20O(1)
        P                                            P
        |                                            |
        x            Right rotation at x             y
      /   \         ─────────────────────▶         /   \
     y     T3                                     T1    x
    / \             ◀─────────────────────             / \
  T1   T2            Left rotation at y              T2   T3

inorder before:  T1  y  T2  x  T3          inorder after:  T1  y  T2  x  T3   (unchanged)
```

| Rotation | Pointer changes | Effect |
| --- | --- | --- |
| <strong>Right</strong> rotation at `x` | `y = x.left; x.left = y.right; y.right = x`; `P` now points at `y` | Left subtree gets one level shorter, right subtree one level taller |
| <strong>Left</strong> rotation at `y` | `x = y.right; y.right = x.left; x.left = y`; `P` now points at `x` | The mirror image |

The two famous self-balancing BSTs differ only in <strong>what counts as balanced</strong> and therefore in when they rotate: the <strong>AVL tree</strong> (strict, by height) and the <strong>red-black tree</strong> (looser, by colouring).

# AVL tree

> [!INFO]
>
> <strong>AVL tree</strong> — a BST in which, for <strong>every</strong> node, the heights of the left and right subtrees differ by at most 1. The <strong>balance factor</strong> `bf = height(left) − height(right)` is therefore always `−1`, `0` or `+1`; a node with `|bf| > 1` is unbalanced and must be rotated.

Named after Adelson-Velsky and Landis (1962). The height condition guarantees `h ≤ 1.44 log₂ n`, so every operation is `O(log n)`. Each node stores its height so the balance factor is `O(1)` to compute.

1. <strong>Normal BST insert</strong>

   Walk down and attach the new leaf as usual.

2. <strong>Walk back up updating heights</strong>

   The recursion returns through every ancestor of the new node; recompute `height = 1 + max(hL, hR)` at each.

3. <strong>Find the first unbalanced ancestor</strong>

   The lowest node with `|bf| > 1`. Only ancestors can be unbalanced, and fixing the lowest one fixes everything above it for an insert.

4. <strong>Rotate according to one of four cases</strong>

   Decided by <em>which grandchild subtree</em> the new key went into.

| Case | Where the key went | Fix | Rotations |
| --- | --- | --- | --- |
| <strong>Left-Left</strong> (LL) | Left child's left subtree (`bf > 1` and `key < left.key`) | Right rotation at the unbalanced node | 1 (single) |
| <strong>Right-Right</strong> (RR) | Right child's right subtree (`bf < −1` and `key > right.key`) | Left rotation at the unbalanced node | 1 (single) |
| <strong>Left-Right</strong> (LR) | Left child's right subtree (`bf > 1` and `key > left.key`) | Left rotation at the left child, then right rotation at the node | 2 (double) |
| <strong>Right-Left</strong> (RL) | Right child's left subtree (`bf < −1` and `key < right.key`) | Right rotation at the right child, then left rotation at the node | 2 (double) |

```text filename:The%20LL%20case%3A%20the%20chain%2020%20%E2%86%92%2015%20%E2%86%92%205%20becomes%20a%20balanced%20tree%20rooted%20at%2015%20(from%20the%20notes)
insert 20         insert 15         insert 5             Left-Left at 20:
                                                         right rotation
   20                20                20                      15
                    /                 /                      /    \
                  15                15                      5      20
                                   /
                                  5          bf(20) = 2 - 0 = +2 → unbalanced
```

```text filename:The%20double-rotation%20cases%3A%20the%20first%20rotation%20turns%20them%20into%20LL%20%2F%20RR%2C%20the%20second%20fixes%20the%20balance
Left-Right at 30 (insert 30, 10, 20):      Right-Left at 10 (insert 10, 30, 20):

    30            30            20            10           10            20
   /    left     /    right    /  \            \   right    \   left    /  \
 10   rotate   20   rotate   10    30          30  rotate   20  rotate 10    30
   \  at 10    /     at 30                     /   at 30      \   at 10
    20       10                              20                30
```

> [!TIP] Example
>
> <strong>Input:</strong> `insert 20, 15, 5`<br><strong>Output:</strong> `root 15 — preorder 15 5 20`<br><strong>Input:</strong> `insert 20, 15, 30, 40, 50, 12, 18, 35, 80, 7`<br><strong>Output:</strong> `preorder 20 15 12 7 18 40 30 35 50 80, height 4 (a plain BST has height 5)`

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = self.right = None
        self.height = 1                  # a new node is a leaf (node-counting convention)

def height(node):
    return node.height if node else 0

def balance(node):
    return height(node.left) - height(node.right)

def update(node):
    node.height = 1 + max(height(node.left), height(node.right))

def rotate_right(x):                     # x's left child y becomes the subtree root
    y = x.left
    x.left = y.right                     # T2 moves across
    y.right = x
    update(x); update(y)                 # x first: it is now below y
    return y

def rotate_left(x):                      # mirror image
    y = x.right
    x.right = y.left
    y.left = x
    update(x); update(y)
    return y

def insert(root, key):
    if root is None:
        return Node(key)
    if key < root.key:
        root.left = insert(root.left, key)
    elif key > root.key:
        root.right = insert(root.right, key)
    else:
        return root                      # duplicate
    update(root)                         # on the way back up
    bf = balance(root)
    if bf > 1 and key < root.left.key:   # Left-Left
        return rotate_right(root)
    if bf < -1 and key > root.right.key: # Right-Right
        return rotate_left(root)
    if bf > 1 and key > root.left.key:   # Left-Right
        root.left = rotate_left(root.left)
        return rotate_right(root)
    if bf < -1 and key < root.right.key: # Right-Left
        root.right = rotate_right(root.right)
        return rotate_left(root)
    return root

def preorder(root):
    if root:
        print(root.key, end=" ")
        preorder(root.left)
        preorder(root.right)

def build(keys):
    root = None
    for k in keys:
        root = insert(root, k)
    return root

for label, keys in (("LL", (20, 15, 5)), ("RR", (100, 200, 300)), ("LR", (30, 10, 20)), ("RL", (10, 30, 20))):
    root = build(keys)
    print(label, " ".join(map(str, keys)) + ": root", str(root.key) + ", preorder", end=" ")
    preorder(root); print()
root = build((20, 15, 30, 40, 50, 12, 18, 35, 80, 7))
print("sample keys: preorder", end=" "); preorder(root); print()
print("height:", root.height)
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

struct Node {
    int key, height = 1;                 // a new node is a leaf (node-counting convention)
    Node *left = nullptr, *right = nullptr;
    Node(int k) : key(k) {}
};

int height(Node* n) { return n ? n->height : 0; }
int balance(Node* n) { return height(n->left) - height(n->right); }
void update(Node* n) { n->height = 1 + max(height(n->left), height(n->right)); }

Node* rotateRight(Node* x) {             // x's left child y becomes the subtree root
    Node* y = x->left;
    x->left = y->right;                  // T2 moves across
    y->right = x;
    update(x); update(y);                // x first: it is now below y
    return y;
}

Node* rotateLeft(Node* x) {              // mirror image
    Node* y = x->right;
    x->right = y->left;
    y->left = x;
    update(x); update(y);
    return y;
}

Node* insert(Node* root, int key) {
    if (!root) return new Node(key);
    if (key < root->key) root->left = insert(root->left, key);
    else if (key > root->key) root->right = insert(root->right, key);
    else return root;                                   // duplicate
    update(root);                                       // on the way back up
    int bf = balance(root);
    if (bf > 1 && key < root->left->key) return rotateRight(root);       // Left-Left
    if (bf < -1 && key > root->right->key) return rotateLeft(root);      // Right-Right
    if (bf > 1 && key > root->left->key) {                               // Left-Right
        root->left = rotateLeft(root->left);
        return rotateRight(root);
    }
    if (bf < -1 && key < root->right->key) {                             // Right-Left
        root->right = rotateRight(root->right);
        return rotateLeft(root);
    }
    return root;
}

void preorder(Node* root) {
    if (!root) return;
    cout << root->key << " ";
    preorder(root->left);
    preorder(root->right);
}

Node* build(const vector<int>& keys) {
    Node* root = nullptr;
    for (int k : keys) root = insert(root, k);
    return root;
}

int main() {
    vector<pair<string, vector<int>>> cases = {
        {"LL", {20, 15, 5}}, {"RR", {100, 200, 300}}, {"LR", {30, 10, 20}}, {"RL", {10, 30, 20}}};
    for (auto& [label, keys] : cases) {
        Node* root = build(keys);
        cout << label;
        for (int k : keys) cout << " " << k;
        cout << ": root " << root->key << ", preorder ";
        preorder(root); cout << "\n";
    }
    Node* root = build({20, 15, 30, 40, 50, 12, 18, 35, 80, 7});
    cout << "sample keys: preorder "; preorder(root); cout << "\n";
    cout << "height: " << root->height << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key, height = 1;             // a new node is a leaf (node-counting convention)
        Node left, right;
        Node(int k) { key = k; }
    }

    static int height(Node n) { return n == null ? 0 : n.height; }
    static int balance(Node n) { return height(n.left) - height(n.right); }
    static void update(Node n) { n.height = 1 + Math.max(height(n.left), height(n.right)); }

    static Node rotateRight(Node x) {    // x's left child y becomes the subtree root
        Node y = x.left;
        x.left = y.right;                // T2 moves across
        y.right = x;
        update(x); update(y);            // x first: it is now below y
        return y;
    }

    static Node rotateLeft(Node x) {     // mirror image
        Node y = x.right;
        x.right = y.left;
        y.left = x;
        update(x); update(y);
        return y;
    }

    static Node insert(Node root, int key) {
        if (root == null) return new Node(key);
        if (key < root.key) root.left = insert(root.left, key);
        else if (key > root.key) root.right = insert(root.right, key);
        else return root;                                   // duplicate
        update(root);                                       // on the way back up
        int bf = balance(root);
        if (bf > 1 && key < root.left.key) return rotateRight(root);       // Left-Left
        if (bf < -1 && key > root.right.key) return rotateLeft(root);      // Right-Right
        if (bf > 1 && key > root.left.key) {                               // Left-Right
            root.left = rotateLeft(root.left);
            return rotateRight(root);
        }
        if (bf < -1 && key < root.right.key) {                             // Right-Left
            root.right = rotateRight(root.right);
            return rotateLeft(root);
        }
        return root;
    }

    static void preorder(Node root) {
        if (root == null) return;
        System.out.print(root.key + " ");
        preorder(root.left);
        preorder(root.right);
    }

    static Node build(int[] keys) {
        Node root = null;
        for (int k : keys) root = insert(root, k);
        return root;
    }

    public static void main(String[] args) {
        String[] labels = {"LL", "RR", "LR", "RL"};
        int[][] cases = {{20, 15, 5}, {100, 200, 300}, {30, 10, 20}, {10, 30, 20}};
        for (int i = 0; i < 4; i++) {
            Node root = build(cases[i]);
            StringBuilder sb = new StringBuilder(labels[i]);
            for (int k : cases[i]) sb.append(" ").append(k);
            System.out.print(sb + ": root " + root.key + ", preorder ");
            preorder(root); System.out.println();
        }
        Node root = build(new int[]{20, 15, 30, 40, 50, 12, 18, 35, 80, 7});
        System.out.print("sample keys: preorder "); preorder(root); System.out.println();
        System.out.println("height: " + root.height);
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; this.height = 1; }
}                                        // a new node is a leaf (node-counting convention)

const height = (n) => n === null ? 0 : n.height;
const balance = (n) => height(n.left) - height(n.right);
const update = (n) => { n.height = 1 + Math.max(height(n.left), height(n.right)); };

function rotateRight(x) {                // x's left child y becomes the subtree root
    const y = x.left;
    x.left = y.right;                    // T2 moves across
    y.right = x;
    update(x); update(y);                // x first: it is now below y
    return y;
}

function rotateLeft(x) {                 // mirror image
    const y = x.right;
    x.right = y.left;
    y.left = x;
    update(x); update(y);
    return y;
}

function insert(root, key) {
    if (root === null) return new Node(key);
    if (key < root.key) root.left = insert(root.left, key);
    else if (key > root.key) root.right = insert(root.right, key);
    else return root;                                   // duplicate
    update(root);                                       // on the way back up
    const bf = balance(root);
    if (bf > 1 && key < root.left.key) return rotateRight(root);       // Left-Left
    if (bf < -1 && key > root.right.key) return rotateLeft(root);      // Right-Right
    if (bf > 1 && key > root.left.key) {                               // Left-Right
        root.left = rotateLeft(root.left);
        return rotateRight(root);
    }
    if (bf < -1 && key < root.right.key) {                             // Right-Left
        root.right = rotateRight(root.right);
        return rotateLeft(root);
    }
    return root;
}

function preorder(root) {
    if (root === null) return;
    process.stdout.write(root.key + " ");
    preorder(root.left);
    preorder(root.right);
}

const build = (keys) => keys.reduce((root, k) => insert(root, k), null);

for (const [label, keys] of [["LL", [20, 15, 5]], ["RR", [100, 200, 300]], ["LR", [30, 10, 20]], ["RL", [10, 30, 20]]]) {
    const root = build(keys);
    process.stdout.write(`${label} ${keys.join(" ")}: root ${root.key}, preorder `);
    preorder(root); console.log();
}
const root = build([20, 15, 30, 40, 50, 12, 18, 35, 80, 7]);
process.stdout.write("sample keys: preorder "); preorder(root); console.log();
console.log("height:", root.height);
```

```text filename:Output
LL 20 15 5: root 15, preorder 15 5 20
RR 100 200 300: root 200, preorder 200 100 300
LR 30 10 20: root 20, preorder 20 10 30
RL 10 30 20: root 20, preorder 20 10 30
sample keys: preorder 20 15 12 7 18 40 30 35 50 80
height: 4
```

Time O(log n) per insert — one path down plus at most two rotations · Space O(log n) recursion stack

> [!NOTE] Key point
>
> Why at most <strong>two</strong> rotations: after an insert, fixing the lowest unbalanced node restores that subtree to its <strong>original height</strong>, so no ancestor can still be unbalanced. Deletion is different — a rotation may shorten the subtree, so the fix can cascade up the whole path, `O(log n)` rotations.

> [!WARNING] Pitfall
>
> The notes wrote the AVL condition as `|lh − rh| < 1`; it is `|lh − rh| ≤ 1`. With `< 1` only perfect trees would qualify and no tree with `n = 2` nodes could exist.

# Red-black tree

> [!INFO]
>
> <strong>Red-black tree</strong> — a BST in which every node carries one extra bit — a <strong>colour</strong>, red or black — and four rules on the colours keep the longest root-to-leaf path at most <strong>twice</strong> as long as the shortest. This guarantees `h ≤ 2 log₂(n + 1)`, so all operations are `O(log n)`.

1. Every node is either <strong>red</strong> or <strong>black</strong>.
2. The <strong>root</strong> is always black.
3. <strong>No two consecutive reds</strong>: a red node has only black children (a red node's parent is black).
4. Every path from a node down to its descendant `null` leaves has the <strong>same number of black nodes</strong> (the <em>black height</em>).

```text filename:A%20valid%20red-black%20tree%20holding%20the%20sample%20keys%20%E2%80%94%20the%20colouring%20the%20notes%20drew%20violated%20rule%204%2C%20so%20it%20is%20redrawn%20here
                 20 (B)
              /         \
         15 (B)           40 (B)
        /     \          /      \
   12 (B)    18 (B)   30 (B)    50 (B)
   /                      \         \
7 (R)                    35 (R)    80 (R)

black nodes on every root → null path: 3   (20-15-12, 20-15-18, 20-40-30, 20-40-50, …)
longest path: 20-15-12-7-null (4 nodes)   shortest: 20-15-18-null (3 nodes)  → ≤ 2×
```

<strong>Why the rules bound the height.</strong> Rule 4 says every path has the same number `b` of black nodes; rule 3 says reds cannot be adjacent, so a path has at most `b` reds squeezed between its blacks. The shortest possible path is all black (`b` nodes); the longest alternates (`2b` nodes). Hence <em>no path is more than twice as long as any other</em> — the statement at the end of the notes — and since a tree with `b` blacks on every path has at least `2^b − 1` nodes, `b ≤ log₂(n + 1)` and `h ≤ 2 log₂(n + 1)`.

Insertion colours the new node <strong>red</strong> (that never breaks rule 4), then fixes any red-red violation by <strong>recolouring</strong> and at most two rotations. Deletion is more involved but also needs at most three rotations. The code is long and rarely asked in interviews; the properties and the comparison below are.

|  | AVL tree | Red-black tree |
| --- | --- | --- |
| Balance rule | `&#124;hL − hR&#124; ≤ 1` at every node (strict) | Colour rules; longest path ≤ 2 × shortest (loose) |
| Height bound | `≤ 1.44 log₂ n` — shorter | `≤ 2 log₂ n` — a bit taller |
| Search | Faster (shorter tree) | Slightly slower |
| Insert | ≤ 2 rotations, but more frequent rebalancing | ≤ 2 rotations, mostly just recolouring |
| Delete | Up to `O(log n)` rotations | ≤ 3 rotations |
| Extra data per node | Height (an int) or balance factor | 1 bit (the colour) |
| Best for | Lookup-heavy data that changes rarely (databases, dictionaries) | Frequent inserts/deletes |
| Used in | Some database indexes, Windows kernel | `std::map`/`set`, Java `TreeMap`/`TreeSet`, Linux scheduler (CFS) and memory manager |

# Applications of a BST

> [!NOTE] Sorted dynamic data
>
> Keep a stream of keys sorted while they keep arriving: inorder is always sorted, insert/delete stay `O(log n)` — `std::set`, `TreeMap`.

> [!NOTE] Double-ended priority queue
>
> A heap gives only the min <em>or</em> the max; a BST gives both (leftmost and rightmost) plus delete-any in `O(log n)`.

> [!NOTE] Floor, ceiling, nearest in a stream
>
> <em>What is the largest value ≤ x among the values seen so far?</em> — floor/ceiling on a self-balancing BST.

> [!NOTE] Count smaller / greater in a stream
>
> Augment each node with the size of its subtree; rank queries then take one walk down, `O(log n)`.

> [!NOTE] Range queries
>
> All keys in `[lo, hi]`: go down to `lo`, then inorder until `hi` — `O(h + k)` for `k` results.

> [!NOTE] Language libraries
>
> C++ `map`/`set`/`multimap`/`multiset`, Java `TreeMap`/`TreeSet` are red-black trees; database B-trees are the same idea with many keys per node.

# Interview Q&amp;A

```question
How do you check whether a binary tree is a BST?

---

Not by comparing each node with its two children — that misses a grandchild on the wrong side. Either do an <strong>inorder traversal</strong> and check that the sequence is strictly increasing, or pass a valid <strong>range</strong> `(lo, hi)` down the recursion: the left child must be in `(lo, node.key)`, the right in `(node.key, hi)`. Both are `O(n)`.
```

```question
What is the worst-case complexity of search in a BST, and how do you avoid it?

---

`O(n)`, when the tree is skewed (keys inserted in sorted order make a linked list). Avoid it with a <strong>self-balancing</strong> tree — AVL or red-black — which guarantees `h = O(log n)` by rotating after inserts and deletes.
```

```question
How do you delete a node that has two children?

---

Replace its key with the <strong>inorder successor</strong> (the minimum of the right subtree) or the inorder predecessor (maximum of the left), then delete that successor from the subtree it came from. The successor has at most one child, so the second deletion is the easy case. Total `O(h)`.
```

```question
How do you find the kth smallest element in a BST?

---

An inorder traversal visits keys in ascending order, so stop at the kth visited node — `O(h + k)`. If the query is frequent, store the <strong>subtree size</strong> in each node: at a node with `s` keys in its left subtree, go left if `k ≤ s`, return the node if `k = s + 1`, else go right with `k − s − 1`. That is `O(h)`.
```

```question
AVL or red-black — which would you choose?

---

AVL for lookup-heavy workloads: its stricter balance keeps the tree shorter. Red-black for insert/delete-heavy workloads: fewer rotations per update and only one bit of extra storage. Most standard libraries (`std::map`, `TreeMap`) chose red-black.
```

```question
How do a BST and a hash table compare?

---

A hash table gives `O(1)` average search/insert/delete but has no notion of order: no min/max, floor/ceiling, sorted traversal or range queries. A balanced BST gives all of those in `O(log n)` and has no worst-case collisions. Use a hash table for pure key lookups, a BST when order matters.
```
