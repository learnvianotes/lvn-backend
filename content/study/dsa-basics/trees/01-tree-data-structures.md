---
id: 96630eeb-0cf3-7ef5-867c-99c67c04d5d4
key: topic:dsa-basics/trees
subject: dsa-basics
topic: trees
title: Tree Data Structures
slug: tree-data-structures
order: 1
---

A tree is a <strong>non-linear</strong>, hierarchical data structure: one root node with children, each of which is the root of a smaller tree. Folders, HTML documents, organisation charts, expression parsers, database indexes and every search tree and heap are trees — and most tree algorithms are five-line recursions once you see the structure.

> [!INFO]
>
> <strong>Tree</strong> — a collection of nodes connected by edges such that there is exactly one <em>root</em> and every other node has exactly one parent — so there are no cycles and `n` nodes always have `n − 1` edges. A <strong>binary tree</strong> is a tree in which every node has at most two children, called `left` and `right`.

```text filename:The%20sample%20binary%20tree%20used%20in%20every%20example%20below
       10                  ← root (depth 0, level 0)
     /    \
   20      30              ← depth 1
  /  \       \
40    50      60           ← depth 2
     /  \
   70    80                ← depth 3 — 40, 70, 80, 60 are the leaves
```

# Terminology

| Term | Meaning | In the sample tree |
| --- | --- | --- |
| <strong>Node</strong> | One element: a key plus links to its children | `10`, `20`, … (8 nodes) |
| <strong>Edge</strong> | The link from a parent to a child; a tree of `n` nodes has `n − 1` edges | 7 edges |
| <strong>Root</strong> | The topmost node — the only node without a parent | `10` |
| <strong>Parent / child</strong> | The node directly above / directly below along an edge | `50` is the parent of `70` and `80` |
| <strong>Siblings</strong> | Children of the same parent | `70` and `80`; `20` and `30` |
| <strong>Leaf</strong> (external node) | A node with no children | `40`, `70`, `80`, `60` |
| <strong>Internal node</strong> | A node with at least one child | `10`, `20`, `30`, `50` |
| <strong>Subtree</strong> | A node together with all its descendants — itself a tree | the subtree rooted at `20` is `20, 40, 50, 70, 80` |
| <strong>Ancestors</strong> | All nodes on the path from a node up to the root | ancestors of `70`: `50`, `20`, `10` |
| <strong>Descendants</strong> | All nodes in a node's subtree except itself | descendants of `20`: `40`, `50`, `70`, `80` |
| <strong>Degree</strong> of a node | Number of children (at most 2 in a binary tree) | degree of `20` is 2, of `30` is 1, of `40` is 0 |
| <strong>Depth</strong> of a node | Number of edges from the root down to the node | depth of `70` is 3, of the root is 0 |
| <strong>Level</strong> | All nodes at the same depth (`level 0` = root) | level 2 is `40 50 60` |
| <strong>Height</strong> of a node | Number of edges on the longest downward path to a leaf (a leaf has height 0) | height of `20` is 2 |
| <strong>Height</strong> of the tree | Height of the root | 3 edges — or 4 if you count <strong>nodes</strong> on that path (the convention of these notes) |

> [!NOTE] Key point
>
> Two height conventions exist. Counting <strong>edges</strong>, the sample tree has height 3 and an empty tree has height −1. Counting <strong>nodes</strong> on the longest root-to-leaf path (what the notes and GeeksforGeeks do, and what the `height()` code below returns), it has height 4 and an empty tree has height 0. Interviewers accept either — just say which one you use.

# Where trees are used

Trees are the natural representation of anything <strong>hierarchical</strong>, and the basis of most fast search structures.

> [!NOTE] Hierarchical data
>
> Organisation structures, folder / file systems, XML and HTML documents (the DOM), nested JSON objects, class inheritance in OOP.

> [!NOTE] Binary search tree
>
> Keys kept in sorted order with `O(log n)` search, insert and delete — `std::map`, `TreeMap` (next topic).

> [!NOTE] Binary heap
>
> A complete binary tree in an array; the priority queue behind heap sort, Dijkstra and schedulers (topic after next).

> [!NOTE] B and B+ trees
>
> Wide, shallow search trees that keep disk reads to a minimum — the indexes of every relational database.

> [!NOTE] Spanning and shortest-path trees
>
> Prim's and Kruskal's minimum spanning trees, Dijkstra's shortest-path tree — the backbone of routing in computer networks.

> [!NOTE] Parse and expression trees
>
> Compilers turn source code into a syntax tree; `(a + b) * c` is a tree with `*` at the root.

<strong>Special-purpose variations</strong> you will meet later in DSA Advanced:

| Variation | What it is for |
| --- | --- |
| <strong>Trie</strong> (prefix tree) | Strings keyed character by character — autocomplete, spell check, IP routing tables |
| <strong>Suffix tree</strong> | All suffixes of a text — substring search in `O(m)` |
| <strong>Binary Indexed Tree</strong> (Fenwick tree) | Prefix sums with `O(log n)` point updates in a plain array |
| <strong>Segment tree</strong> | Range queries (sum, min, max) with `O(log n)` updates |

# Kinds of binary tree

The same `n` keys can form very different binary trees. The shape decides the height, and the height decides how fast everything runs — so the special shapes have names.

```text filename:The%20named%20shapes%20of%20a%20binary%20tree
FULL (0 or 2 children)      COMPLETE (left-filled)      PERFECT (all leaves same level)
         1                          1                            1
       /   \                      /   \                        /   \
      2     3                    2     3                      2     3
     / \                        / \   /                      / \   / \
    4   5                      4   5 6                      4   5 6   7

BALANCED (|hL − hR| ≤ 1 at every node)      DEGENERATE / SKEWED (a linked list)
         1                                      1
       /   \                                     \
      2     3                                      2
     /       \                                      \
    4         5                                       3
                                                       \
                                                        4
```

| Kind | Rule | Why it matters |
| --- | --- | --- |
| <strong>Full</strong> (strict / proper) | Every node has either 0 or 2 children | Leaves = internal nodes + 1; expression trees are full |
| <strong>Complete</strong> | Every level is completely filled except possibly the last, which is filled from <strong>left to right</strong> | Can be stored in an array with no gaps — this is what a binary heap is |
| <strong>Perfect</strong> | All internal nodes have 2 children and all leaves are on the same level | Exactly `2^h − 1` nodes for height `h` (in nodes); the densest possible tree |
| <strong>Balanced</strong> | Height is `O(log n)` — e.g. AVL: left and right heights differ by at most 1 at every node | Guarantees `O(log n)` search, insert and delete in a BST |
| <strong>Degenerate</strong> (skewed) | Every node has exactly one child | Height `n − 1`: it behaves like a linked list, every operation becomes `O(n)` |

Useful facts (height counted in nodes): level `l` holds at most `2^l` nodes; a tree of height `h` holds at most `2^h − 1` nodes; therefore `n` nodes need height at least `⌈log₂(n + 1)⌉`. A perfect tree is always complete and full; a complete tree need not be full (node `3` above has one child); a full tree need not be complete.

# Binary tree node and building the sample tree

A binary tree is a <strong>linked</strong> data structure, like a linked list with two links. Each node stores a key and pointers to its left and right child; a missing child is `None` / `nullptr` / `null`. The tree is identified by its root pointer alone — there is no separate container object. Every program in this topic starts by building the sample tree with this node class.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

def is_leaf(node):
    return node.left is None and node.right is None

root = sample_tree()
print("root:", root.key)
print("children of root:", root.left.key, root.right.key)
print("left child of 20:", root.left.left.key)
print("right child of 30:", root.right.right.key)
print("30 has a left child:", "true" if root.right.left else "false")
print("70 is a leaf:", "true" if is_leaf(root.left.right.left) else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

bool isLeaf(Node* node) { return !node->left && !node->right; }

int main() {
    Node* root = sampleTree();
    cout << "root: " << root->key << "\n";
    cout << "children of root: " << root->left->key << " " << root->right->key << "\n";
    cout << "left child of 20: " << root->left->left->key << "\n";
    cout << "right child of 30: " << root->right->right->key << "\n";
    cout << "30 has a left child: " << (root->right->left ? "true" : "false") << "\n";
    cout << "70 is a leaf: " << (isLeaf(root->left->right->left) ? "true" : "false") << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static boolean isLeaf(Node node) { return node.left == null && node.right == null; }

    public static void main(String[] args) {
        Node root = sampleTree();
        System.out.println("root: " + root.key);
        System.out.println("children of root: " + root.left.key + " " + root.right.key);
        System.out.println("left child of 20: " + root.left.left.key);
        System.out.println("right child of 30: " + root.right.right.key);
        System.out.println("30 has a left child: " + (root.right.left != null ? "true" : "false"));
        System.out.println("70 is a leaf: " + (isLeaf(root.left.right.left) ? "true" : "false"));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

const isLeaf = (node) => node.left === null && node.right === null;

const root = sampleTree();
console.log("root:", root.key);
console.log("children of root:", root.left.key, root.right.key);
console.log("left child of 20:", root.left.left.key);
console.log("right child of 30:", root.right.right.key);
console.log("30 has a left child:", root.right.left ? "true" : "false");
console.log("70 is a leaf:", isLeaf(root.left.right.left) ? "true" : "false");
```

```text filename:Output
root: 10
children of root: 20 30
left child of 20: 40
right child of 30: 60
30 has a left child: false
70 is a leaf: true
```

> [!NOTE] Key point
>
> Building a tree by hand like this is fine for examples. Real code builds trees by <strong>insertion</strong> (a BST), from an array (a heap, or a level-order array with `-1` for missing nodes) or by parsing input.

# Tree traversals

Traversing means visiting every node exactly once. A list has one natural order; a tree has several, and each one is useful for something.

| Traversal | Order | Sample tree gives | Typical use |
| --- | --- | --- | --- |
| <strong>Inorder</strong> (depth-first) | Left subtree → <strong>Root</strong> → Right subtree | `40 20 70 50 80 10 30 60` | Sorted output of a binary search tree |
| <strong>Preorder</strong> (depth-first) | <strong>Root</strong> → Left → Right | `10 20 40 50 70 80 30 60` | Copying / serialising a tree, prefix expressions |
| <strong>Postorder</strong> (depth-first) | Left → Right → <strong>Root</strong> | `40 70 80 50 20 60 30 10` | Deleting a tree (children before parent), folder sizes, postfix expressions |
| <strong>Level order</strong> (breadth-first) | Level 0, then level 1, … left to right | `10 20 30 40 50 60 70 80` | Shortest paths, printing by level, anything that needs <em>closest first</em> |

```text filename:The%20three%20depth-first%20orders%20differ%20only%20in%20when%20the%20root%20is%20visited%20relative%20to%20its%20subtrees
       10            Inorder   : (left of 10) 10 (right of 10)
     /    \                     = (40 20 70 50 80) 10 (30 60)
   20      30
  /  \       \      Preorder  : 10 (left of 10) (right of 10)
40    50      60                = 10 (20 40 50 70 80) (30 60)
     /  \
   70    80          Postorder : (left of 10) (right of 10) 10
                                = (40 70 80 50 20) (60 30) 10
```

> [!NOTE] Idea
>
> All three depth-first traversals are the <strong>same recursion</strong> — `visit(root.left)`, `visit(root.right)` and <em>print the root</em> — in a different order. The names say where the root goes: <strong>pre</strong>-order before the children, <strong>in</strong>-order in between, <strong>post</strong>-order after. Each recursive call handles one node and makes two calls, so the total work is `O(n)`; the recursion stack is as deep as the tree, so auxiliary space is `O(h)`.

# Inorder traversal

> [!TIP] Example
>
> <strong>Input:</strong> `the sample tree`<br><strong>Output:</strong> `40 20 70 50 80 10 30 60`

Recurse into the left subtree, print the node, recurse into the right subtree. On a BST this prints the keys in sorted order, which is why inorder is the traversal you will use most.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

def inorder(root):
    if root is None:                 # base case: empty subtree
        return
    inorder(root.left)               # 1. left subtree
    print(root.key, end=" ")         # 2. root
    inorder(root.right)              # 3. right subtree

inorder(sample_tree())
print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

void inorder(Node* root) {
    if (!root) return;               // base case: empty subtree
    inorder(root->left);             // 1. left subtree
    cout << root->key << " ";        // 2. root
    inorder(root->right);            // 3. right subtree
}

int main() {
    inorder(sampleTree());
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static void inorder(Node root) {
        if (root == null) return;        // base case: empty subtree
        inorder(root.left);              // 1. left subtree
        System.out.print(root.key + " "); // 2. root
        inorder(root.right);             // 3. right subtree
    }

    public static void main(String[] args) {
        inorder(sampleTree());
        System.out.println();
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function inorder(root) {
    if (root === null) return;       // base case: empty subtree
    inorder(root.left);              // 1. left subtree
    process.stdout.write(root.key + " "); // 2. root
    inorder(root.right);             // 3. right subtree
}

inorder(sampleTree());
console.log();
```

```text filename:Output
40 20 70 50 80 10 30 60
```

Time O(n) · Space O(h) recursion stack — O(n) for a skewed tree, O(log n) when balanced

> [!WARNING] Pitfall
>
> The notes' comment <em>Auxiliary space Θ(n)</em> is the worst case only. The stack holds one frame per <strong>ancestor</strong> of the current node, so its depth is the height `h`; it reaches `n` only for a degenerate (linked-list-shaped) tree.

# Preorder traversal

> [!TIP] Example
>
> <strong>Input:</strong> `the sample tree`<br><strong>Output:</strong> `10 20 40 50 70 80 30 60`

Print the node first, then its subtrees. Preorder lists every node before its descendants, so writing a tree out in preorder (with markers for missing children) is enough to rebuild it — this is how trees are serialised and copied.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

def preorder(root):
    if root is None:
        return
    print(root.key, end=" ")         # 1. root first
    preorder(root.left)              # 2. left subtree
    preorder(root.right)             # 3. right subtree

preorder(sample_tree())
print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

void preorder(Node* root) {
    if (!root) return;
    cout << root->key << " ";        // 1. root first
    preorder(root->left);            // 2. left subtree
    preorder(root->right);           // 3. right subtree
}

int main() {
    preorder(sampleTree());
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static void preorder(Node root) {
        if (root == null) return;
        System.out.print(root.key + " "); // 1. root first
        preorder(root.left);             // 2. left subtree
        preorder(root.right);            // 3. right subtree
    }

    public static void main(String[] args) {
        preorder(sampleTree());
        System.out.println();
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function preorder(root) {
    if (root === null) return;
    process.stdout.write(root.key + " "); // 1. root first
    preorder(root.left);             // 2. left subtree
    preorder(root.right);            // 3. right subtree
}

preorder(sampleTree());
console.log();
```

```text filename:Output
10 20 40 50 70 80 30 60
```

Time O(n) · Space O(h)

# Postorder traversal

> [!TIP] Example
>
> <strong>Input:</strong> `the sample tree`<br><strong>Output:</strong> `40 70 80 50 20 60 30 10`

Both subtrees first, the node last. Postorder visits children before their parent, so it is the order for anything that must finish the parts before the whole: freeing a tree's nodes, computing directory sizes, evaluating an expression tree.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

def postorder(root):
    if root is None:
        return
    postorder(root.left)             # 1. left subtree
    postorder(root.right)            # 2. right subtree
    print(root.key, end=" ")         # 3. root last

postorder(sample_tree())
print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

void postorder(Node* root) {
    if (!root) return;
    postorder(root->left);           // 1. left subtree
    postorder(root->right);          // 2. right subtree
    cout << root->key << " ";        // 3. root last
}

int main() {
    postorder(sampleTree());
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static void postorder(Node root) {
        if (root == null) return;
        postorder(root.left);            // 1. left subtree
        postorder(root.right);           // 2. right subtree
        System.out.print(root.key + " "); // 3. root last
    }

    public static void main(String[] args) {
        postorder(sampleTree());
        System.out.println();
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function postorder(root) {
    if (root === null) return;
    postorder(root.left);            // 1. left subtree
    postorder(root.right);           // 2. right subtree
    process.stdout.write(root.key + " "); // 3. root last
}

postorder(sampleTree());
console.log();
```

```text filename:Output
40 70 80 50 20 60 30 10
```

Time O(n) · Space O(h)

> [!NOTE] Key point
>
> In C++ the destructor of a tree <em>is</em> a postorder traversal: `delete` the left subtree, `delete` the right subtree, then the node — deleting the node first would lose the pointers to its children.

# Height of a binary tree

> [!TIP] Example
>
> <strong>Input:</strong> `the sample tree`<br><strong>Output:</strong> `4 (nodes on the longest root-to-leaf path 10 → 20 → 50 → 70)`<br><strong>Input:</strong> `an empty tree`<br><strong>Output:</strong> `0`

> [!NOTE] Idea
>
> The height of a tree is <strong>one more than the taller of its two subtrees</strong>. That is the whole algorithm: recurse into both children, take the maximum, add 1. The base case — an empty subtree — has height 0 under the node-counting convention.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

def height(root):
    if root is None:
        return 0                             # empty tree (node convention)
    return max(height(root.left), height(root.right)) + 1   # +1 for the root

root = sample_tree()
print("height:", height(root))
print("height of left subtree:", height(root.left))
print("height of right subtree:", height(root.right))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

int height(Node* root) {
    if (!root) return 0;                     // empty tree (node convention)
    return max(height(root->left), height(root->right)) + 1;   // +1 for the root
}

int main() {
    Node* root = sampleTree();
    cout << "height: " << height(root) << "\n";
    cout << "height of left subtree: " << height(root->left) << "\n";
    cout << "height of right subtree: " << height(root->right) << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static int height(Node root) {
        if (root == null) return 0;              // empty tree (node convention)
        return Math.max(height(root.left), height(root.right)) + 1;   // +1 for the root
    }

    public static void main(String[] args) {
        Node root = sampleTree();
        System.out.println("height: " + height(root));
        System.out.println("height of left subtree: " + height(root.left));
        System.out.println("height of right subtree: " + height(root.right));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function height(root) {
    if (root === null) return 0;             // empty tree (node convention)
    return Math.max(height(root.left), height(root.right)) + 1;   // +1 for the root
}

const root = sampleTree();
console.log("height:", height(root));
console.log("height of left subtree:", height(root.left));
console.log("height of right subtree:", height(root.right));
```

```text filename:Output
height: 4
height of left subtree: 3
height of right subtree: 2
```

Time O(n) · Space O(h)

> [!NOTE] Key point
>
> To count <strong>edges</strong> instead, return `-1` for an empty tree; the sample tree then has height 3. The `+ 1` stays the same.

# Print nodes at distance K from the root

> [!TIP] Example
>
> <strong>Input:</strong> `the sample tree, K = 2`<br><strong>Output:</strong> `40 50 60`<br><strong>Input:</strong> `K = 1`<br><strong>Output:</strong> `20 30`<br><strong>Input:</strong> `K = 3`<br><strong>Output:</strong> `70 80`

> [!NOTE] Idea
>
> A node is at distance `K` from the root exactly when it is at distance `K − 1` from one of the root's children. So pass `K` down the recursion, decrementing at each level; when it reaches 0, the current node is one of the answers. Nothing needs to come back up — the recursion just needs to reach depth `K`.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

def print_k_distance(root, k):
    if root is None:
        return
    if k == 0:                           # reached distance K: this node is an answer
        print(root.key, end=" ")
    else:                                # both children are one step closer
        print_k_distance(root.left, k - 1)
        print_k_distance(root.right, k - 1)

root = sample_tree()
for k in range(4):
    print(f"k = {k}:", end=" ")
    print_k_distance(root, k)
    print()
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

void printKDistance(Node* root, int k) {
    if (!root) return;
    if (k == 0) {                            // reached distance K: this node is an answer
        cout << root->key << " ";
    } else {                                 // both children are one step closer
        printKDistance(root->left, k - 1);
        printKDistance(root->right, k - 1);
    }
}

int main() {
    Node* root = sampleTree();
    for (int k = 0; k < 4; k++) {
        cout << "k = " << k << ": ";
        printKDistance(root, k);
        cout << "\n";
    }
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static void printKDistance(Node root, int k) {
        if (root == null) return;
        if (k == 0) {                            // reached distance K: this node is an answer
            System.out.print(root.key + " ");
        } else {                                 // both children are one step closer
            printKDistance(root.left, k - 1);
            printKDistance(root.right, k - 1);
        }
    }

    public static void main(String[] args) {
        Node root = sampleTree();
        for (int k = 0; k < 4; k++) {
            System.out.print("k = " + k + ": ");
            printKDistance(root, k);
            System.out.println();
        }
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function printKDistance(root, k) {
    if (root === null) return;
    if (k === 0) {                           // reached distance K: this node is an answer
        process.stdout.write(root.key + " ");
    } else {                                 // both children are one step closer
        printKDistance(root.left, k - 1);
        printKDistance(root.right, k - 1);
    }
}

const root = sampleTree();
for (let k = 0; k < 4; k++) {
    process.stdout.write(`k = ${k}: `);
    printKDistance(root, k);
    console.log();
}
```

```text filename:Output
k = 0: 10
k = 1: 20 30
k = 2: 40 50 60
k = 3: 70 80
```

Time O(n) · Space O(h)

> [!NOTE] Key point
>
> The recursion visits at most all nodes down to depth `K`, so it is `O(n)` in the worst case but stops early for small `K`. Nodes at distance `K` from the root are exactly <strong>level K</strong> — the level-order traversal below produces the same groups without recursion.

# Level order traversal (breadth-first)

> [!TIP] Example
>
> <strong>Input:</strong> `the sample tree`<br><strong>Output:</strong> `10 20 30 40 50 60 70 80`<br><strong>Input:</strong> `the tree 3 → 4 → 5 (each the left child of the previous)`<br><strong>Output:</strong> `3 4 5`

> [!NOTE] Idea
>
> Recursion naturally goes <em>deep</em>. To go <em>wide</em> — whole level before the next — use a <strong>queue</strong>: start with the root, and every time you dequeue a node, enqueue its children. Because a queue is FIFO, all of level `d` is dequeued before anything from level `d + 1`, which was enqueued later.

1. <strong>Start</strong>

   Push the root into an empty queue.

2. <strong>Loop while the queue is not empty</strong>

   Pop the front node and print it.

3. <strong>Enqueue children</strong>

   Push its left child, then its right child (if they exist) — they will be visited after everything already in the queue.

```text filename:The%20queue%20holds%20at%20most%20one%20level%20(plus%20part%20of%20the%20next)%20at%20any%20time
queue →  [10]                 print 10, push 20 30
         [20 30]              print 20, push 40 50
         [30 40 50]           print 30, push 60
         [40 50 60]           print 40 (leaf)
         [50 60]              print 50, push 70 80
         [60 70 80]           print 60, 70, 80 (leaves)
         []                   done:  10 20 30 40 50 60 70 80
```

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

from collections import deque

def level_order(root):
    if root is None:
        return
    q = deque([root])
    while q:
        node = q.popleft()               # oldest node first (FIFO)
        print(node.key, end=" ")
        if node.left:                    # its children join the back of the line
            q.append(node.left)
        if node.right:
            q.append(node.right)

level_order(sample_tree())
print()
```

```cpp filename:C%2B%2B
#include <queue>
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

void levelOrder(Node* root) {
    if (!root) return;
    queue<Node*> q;
    q.push(root);
    while (!q.empty()) {
        Node* node = q.front(); q.pop();     // oldest node first (FIFO)
        cout << node->key << " ";
        if (node->left) q.push(node->left);  // its children join the back of the line
        if (node->right) q.push(node->right);
    }
}

int main() {
    levelOrder(sampleTree());
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Queue;

public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static void levelOrder(Node root) {
        if (root == null) return;
        Queue<Node> q = new ArrayDeque<>();
        q.offer(root);
        while (!q.isEmpty()) {
            Node node = q.poll();                // oldest node first (FIFO)
            System.out.print(node.key + " ");
            if (node.left != null) q.offer(node.left);   // children join the back of the line
            if (node.right != null) q.offer(node.right);
        }
    }

    public static void main(String[] args) {
        levelOrder(sampleTree());
        System.out.println();
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function levelOrder(root) {
    if (root === null) return;
    const q = [root];
    let head = 0;                        // index of the front: avoids O(n) shift()
    while (head < q.length) {
        const node = q[head++];          // oldest node first (FIFO)
        process.stdout.write(node.key + " ");
        if (node.left) q.push(node.left);    // its children join the back of the line
        if (node.right) q.push(node.right);
    }
}

levelOrder(sampleTree());
console.log();
```

```text filename:Output
10 20 30 40 50 60 70 80
```

Time O(n) · Space O(w) — the widest level, up to n/2 nodes for a perfect tree

<strong>Level by level.</strong> Interviewers usually want each level on its own line. Record the queue's size at the start of each round: exactly that many nodes belong to the current level, so pop just those, then start the next line.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

from collections import deque

def level_order_lines(root):
    if root is None:
        return
    q = deque([root])
    while q:
        count = len(q)                   # nodes of the current level
        for _ in range(count):
            node = q.popleft()
            print(node.key, end=" ")
            if node.left:
                q.append(node.left)
            if node.right:
                q.append(node.right)
        print()                          # level finished

level_order_lines(sample_tree())
```

```cpp filename:C%2B%2B
#include <queue>
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

void levelOrderLines(Node* root) {
    if (!root) return;
    queue<Node*> q;
    q.push(root);
    while (!q.empty()) {
        int count = (int)q.size();           // nodes of the current level
        for (int i = 0; i < count; i++) {
            Node* node = q.front(); q.pop();
            cout << node->key << " ";
            if (node->left) q.push(node->left);
            if (node->right) q.push(node->right);
        }
        cout << "\n";                        // level finished
    }
}

int main() { levelOrderLines(sampleTree()); }
```

```java filename:Java
import java.util.ArrayDeque;
import java.util.Queue;

public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static void levelOrderLines(Node root) {
        if (root == null) return;
        Queue<Node> q = new ArrayDeque<>();
        q.offer(root);
        while (!q.isEmpty()) {
            int count = q.size();                // nodes of the current level
            for (int i = 0; i < count; i++) {
                Node node = q.poll();
                System.out.print(node.key + " ");
                if (node.left != null) q.offer(node.left);
                if (node.right != null) q.offer(node.right);
            }
            System.out.println();                // level finished
        }
    }

    public static void main(String[] args) { levelOrderLines(sampleTree()); }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function levelOrderLines(root) {
    if (root === null) return;
    let level = [root];
    while (level.length) {               // the current level is a whole array
        const next = [];
        process.stdout.write(level.map(n => n.key).join(" ") + "\n");
        for (const node of level) {
            if (node.left) next.push(node.left);
            if (node.right) next.push(node.right);
        }
        level = next;                    // level finished
    }
}

levelOrderLines(sampleTree());
```

```text filename:Output
10
20 30
40 50 60
70 80
```

Time O(n) · Space O(w)

> [!WARNING] Pitfall
>
> Using a plain list / array as the queue and removing from the front (`list.pop(0)`, `Array.shift()`) makes every dequeue `O(n)` and the traversal `O(n²)`. Use `collections.deque`, `std::queue`, `ArrayDeque`, or an index into the array as above.

# Size of a binary tree

> [!TIP] Example
>
> <strong>Input:</strong> `the sample tree`<br><strong>Output:</strong> `8`<br><strong>Input:</strong> `an empty tree`<br><strong>Output:</strong> `0`

> [!NOTE] Idea
>
> The size of a tree is the size of the left subtree plus the size of the right subtree plus one for the root. Same shape as `height()`, with `+` instead of `max`.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

def size(root):
    if root is None:
        return 0
    return size(root.left) + size(root.right) + 1    # left + right + the root

root = sample_tree()
print("size:", size(root))
print("size of left subtree:", size(root.left))
print("size of right subtree:", size(root.right))
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

int size(Node* root) {
    if (!root) return 0;
    return size(root->left) + size(root->right) + 1;  // left + right + the root
}

int main() {
    Node* root = sampleTree();
    cout << "size: " << size(root) << "\n";
    cout << "size of left subtree: " << size(root->left) << "\n";
    cout << "size of right subtree: " << size(root->right) << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static int size(Node root) {
        if (root == null) return 0;
        return size(root.left) + size(root.right) + 1;    // left + right + the root
    }

    public static void main(String[] args) {
        Node root = sampleTree();
        System.out.println("size: " + size(root));
        System.out.println("size of left subtree: " + size(root.left));
        System.out.println("size of right subtree: " + size(root.right));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function size(root) {
    if (root === null) return 0;
    return size(root.left) + size(root.right) + 1;    // left + right + the root
}

const root = sampleTree();
console.log("size:", size(root));
console.log("size of left subtree:", size(root.left));
console.log("size of right subtree:", size(root.right));
```

```text filename:Output
size: 8
size of left subtree: 5
size of right subtree: 2
```

Time O(n) · Space O(h)

> [!NOTE] Key point
>
> Every node is visited once and does `O(1)` work, hence `O(n)` time. An iterative version is level order with a counter — the recursion is just shorter.

# Maximum value in a binary tree

> [!TIP] Example
>
> <strong>Input:</strong> `the sample tree`<br><strong>Output:</strong> `80`<br><strong>Input:</strong> `an empty tree`<br><strong>Output:</strong> `-inf (no maximum)`

> [!NOTE] Idea
>
> The maximum of a tree is the largest of three things: the root's key, the maximum of the left subtree and the maximum of the right subtree. The base case returns `−∞` so that an empty subtree never wins. A plain binary tree has no ordering, so <strong>every</strong> node must be looked at — unlike a BST, where the maximum is simply the rightmost node.

```python filename:Python
class Node:
    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None

def sample_tree():                   # the tree from the notes
    root = Node(10)
    root.left = Node(20)
    root.right = Node(30)
    root.left.left = Node(40)
    root.left.right = Node(50)
    root.right.right = Node(60)
    root.left.right.left = Node(70)
    root.left.right.right = Node(80)
    return root

import math

def get_max(root):
    if root is None:
        return -math.inf                     # identity for max: never wins
    return max(root.key, get_max(root.left), get_max(root.right))

root = sample_tree()
print("max:", get_max(root))
print("max of right subtree:", get_max(root.right))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <climits>
#include <iostream>
using namespace std;

struct Node {
    int key;
    Node *left, *right;
    Node(int k) : key(k), left(nullptr), right(nullptr) {}
};

Node* sampleTree() {                 // the tree from the notes
    Node* root = new Node(10);
    root->left = new Node(20);
    root->right = new Node(30);
    root->left->left = new Node(40);
    root->left->right = new Node(50);
    root->right->right = new Node(60);
    root->left->right->left = new Node(70);
    root->left->right->right = new Node(80);
    return root;
}

int getMax(Node* root) {
    if (!root) return INT_MIN;               // identity for max: never wins
    return max({root->key, getMax(root->left), getMax(root->right)});
}

int main() {
    Node* root = sampleTree();
    cout << "max: " << getMax(root) << "\n";
    cout << "max of right subtree: " << getMax(root->right) << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        int key; Node left, right;
        Node(int k) { key = k; }
    }

    static Node sampleTree() {           // the tree from the notes
        Node root = new Node(10);
        root.left = new Node(20);
        root.right = new Node(30);
        root.left.left = new Node(40);
        root.left.right = new Node(50);
        root.right.right = new Node(60);
        root.left.right.left = new Node(70);
        root.left.right.right = new Node(80);
        return root;
    }

    static int getMax(Node root) {
        if (root == null) return Integer.MIN_VALUE;   // identity for max: never wins
        return Math.max(root.key, Math.max(getMax(root.left), getMax(root.right)));
    }

    public static void main(String[] args) {
        Node root = sampleTree();
        System.out.println("max: " + getMax(root));
        System.out.println("max of right subtree: " + getMax(root.right));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor(key) { this.key = key; this.left = null; this.right = null; }
}

function sampleTree() {              // the tree from the notes
    const root = new Node(10);
    root.left = new Node(20);
    root.right = new Node(30);
    root.left.left = new Node(40);
    root.left.right = new Node(50);
    root.right.right = new Node(60);
    root.left.right.left = new Node(70);
    root.left.right.right = new Node(80);
    return root;
}

function getMax(root) {
    if (root === null) return -Infinity;     // identity for max: never wins
    return Math.max(root.key, getMax(root.left), getMax(root.right));
}

const root = sampleTree();
console.log("max:", getMax(root));
console.log("max of right subtree:", getMax(root.right));
```

```text filename:Output
max: 80
max of right subtree: 60
```

Time O(n) · Space O(h)

> [!WARNING] Pitfall
>
> Returning `0` for an empty subtree is wrong as soon as all keys are negative. Use the smallest possible value (`-math.inf`, `INT_MIN`, `Integer.MIN_VALUE`, `-Infinity`) as the base case — the same trick gives `getMin` with `+∞` and `min`.

# Recursion on trees: the pattern

Height, size, maximum, and most other tree problems have the same three-line shape — remember it and you can derive the others in an interview.

1. <strong>Base case</strong>

   `if root is None: return <identity>` — `0` for counting, `0`/`-1` for height, `−∞` for max, `+∞` for min, `True` for <em>is valid</em>.

2. <strong>Recurse</strong>

   Solve the problem for `root.left` and `root.right` — trust the recursion to return the right answer for each subtree.

3. <strong>Combine</strong>

   Mix the two answers with the root: `max(l, r) + 1`, `l + r + 1`, `max(key, l, r)`, `l and r and <condition on root>`.

| Problem | Base case | Combine |
| --- | --- | --- |
| Height | `0` | `max(l, r) + 1` |
| Size | `0` | `l + r + 1` |
| Maximum | `−∞` | `max(key, l, r)` |
| Sum of keys | `0` | `l + r + key` |
| Count leaves | `0`; a leaf returns `1` | `l + r` |
| Is balanced | `True` | `l and r and &#124;height(left) − height(right)&#124; ≤ 1` |

# Interview Q&amp;A

```question
What is the difference between a binary tree and a binary search tree?

---

A binary tree only limits every node to at most two children — the keys can be anywhere. A binary search tree adds an <strong>ordering invariant</strong>: every key in a node's left subtree is smaller and every key in its right subtree is larger. That invariant is what makes search `O(h)` instead of `O(n)`.
```

```question
Why is the height of a tree so important?

---

Almost every operation walks one root-to-leaf path, so it costs `O(h)`. For a balanced tree `h = O(log n)`; for a skewed tree `h = n − 1`, and the tree degrades into a linked list. Self-balancing trees (AVL, red-black) exist purely to keep `h` logarithmic.
```

```question
Which traversal would you use to delete every node of a tree, and why?

---

<strong>Postorder</strong>: both children are freed before the parent, so no pointer to a child is ever lost. Preorder would free the parent — and the links to its children — first.
```

```question
How do you get the inorder sequence without recursion?

---

Use an explicit stack: walk left pushing every node, pop one and print it, then move to its right child and repeat. It is the same `O(n)` time and `O(h)` space, but the stack is yours instead of the call stack — useful in languages with a small recursion limit (Python stops at about 1000 frames).
```

```question
Is level order traversal depth-first or breadth-first, and what data structure does it need?

---

Breadth-first — it finishes a level before starting the next. It needs a <strong>queue</strong>; the three depth-first traversals need a <strong>stack</strong> (the call stack when written recursively). Space is `O(w)` for the widest level versus `O(h)` for depth-first; for a perfect tree the last level holds about `n/2` nodes, so BFS can use far more memory.
```

```question
Can you rebuild a binary tree from its traversals?

---

From <strong>inorder plus preorder</strong> (or inorder plus postorder), yes: the first preorder element is the root, its position in the inorder sequence splits the inorder into the left and right subtrees, and you recurse. Preorder plus postorder alone is <strong>not</strong> enough — a node with a single child is ambiguous. A single traversal with `null` markers is also enough, which is how serialisation works.
```
