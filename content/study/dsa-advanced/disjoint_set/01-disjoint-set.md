---
id: cb7ae394-c66b-754e-a632-58215d9ad546
key: topic:dsa-advanced/disjoint_set
subject: dsa-advanced
topic: disjoint_set
title: Disjoint Set
slug: disjoint-set
order: 1
---

A disjoint-set (union–find) structure keeps track of a collection of elements partitioned into <strong>non-overlapping groups</strong>, and answers two questions almost instantly: <em>which group is x in?</em> and <em>merge the groups of x and y</em>. It is the engine behind Kruskal's MST, cycle detection and dynamic connectivity.

> [!INFO]
>
> <strong>Disjoint set (union–find)</strong> — a data structure over elements `0 … n-1` that maintains a partition into disjoint sets, each identified by one <strong>representative</strong> element, supporting `find(x)` → representative of `x`'s set, and `union(x, y)` → merge the two sets containing `x` and `y`.

# The problem: dynamic connectivity

`n` people are initially strangers. Two operations arrive in any order: `makeFriends(x, y)` — now `x` and `y` are in the same friend circle (friendship is transitive) — and `areFriends(x, y)` — are they in the same circle? Answer the queries as they come, with no knowledge of future operations.

> [!TIP] Example
>
> <strong>Input:</strong> `n = 4; makeFriends(0, 1), makeFriends(1, 3), areFriends(0, 2), areFriends(0, 1), areFriends(0, 3)`<br><strong>Output:</strong> `No Yes Yes`

| Approach | `makeFriends` | `areFriends` | Problem |
| --- | --- | --- | --- |
| Adjacency list + DFS/BFS | O(1) | O(n + m) — traverse the graph | a query must explore the whole component |
| Adjacency matrix + DFS/BFS | O(1) | O(n²) | same, and n² memory |
| Store the component id of every node | Θ(n) — relabel one whole component | Θ(1) | every merge rewrites up to n labels |
| <strong>Disjoint set</strong> | <strong>≈ O(1)</strong> amortised | <strong>≈ O(1)</strong> amortised | — |

> [!NOTE] Idea
>
> Represent every set as a <strong>tree</strong>: each element stores its parent, the root is the set's representative. `find(x)` climbs to the root. `union(x, y)` makes one root the parent of the other. Two elements are in the same set exactly when they climb to the same root.

```text filename:Each%20set%20is%20a%20tree%20stored%20in%20a%20parent%20array%3B%20a%20root%20is%20its%20own%20parent
initially                 makeFriends(0, 1)        makeFriends(1, 3)
parent: 0 1 2 3           parent: 0 0 2 3          parent: 0 0 2 0

(0) (1) (2) (3)            (0)   (2) (3)              (0)    (2)
                            │                         / \
                           (1)                      (1) (3)

areFriends(0, 2): find(0)=0, find(2)=2 → No
areFriends(0, 3): find(0)=0, find(3)=0 → Yes
```

# Basic implementation: parent array

1. <strong>`make_set`</strong>

   `parent[i] = i` for every element — `n` singleton sets.

2. <strong>`find(x)`</strong>

   Follow `parent` links until reaching an element that is its own parent; that root is the representative.

3. <strong>`union(x, y)`</strong>

   `rx = find(x)`, `ry = find(y)`; if they differ, `parent[ry] = rx`.

4. <strong>`areFriends(x, y)`</strong>

   `find(x) == find(y)`.

```python filename:Python
class DisjointSet:
    def __init__(self, n):
        self.parent = list(range(n))       # every element starts as its own set

    def find(self, x):
        while self.parent[x] != x:         # climb to the root
            x = self.parent[x]
        return x

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx != ry:
            self.parent[ry] = rx           # hang one tree under the other root

    def are_friends(self, x, y):
        return self.find(x) == self.find(y)

ds = DisjointSet(4)
ds.union(0, 1)                             # makeFriends
ds.union(1, 3)
for x, y in [(0, 2), (0, 1), (0, 3)]:
    print(f"areFriends({x}, {y}):", "Yes" if ds.are_friends(x, y) else "No")
print("parent:", " ".join(map(str, ds.parent)))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

class DisjointSet {
    vector<int> parent;
public:
    DisjointSet(int n) : parent(n) {
        for (int i = 0; i < n; i++) parent[i] = i;      // every element starts as its own set
    }
    int find(int x) {
        while (parent[x] != x) x = parent[x];          // climb to the root
        return x;
    }
    void unite(int x, int y) {                         // "union" is a C++ keyword
        int rx = find(x), ry = find(y);
        if (rx != ry) parent[ry] = rx;                 // hang one tree under the other root
    }
    bool areFriends(int x, int y) { return find(x) == find(y); }
    const vector<int>& parents() const { return parent; }
};

int main() {
    DisjointSet ds(4);
    ds.unite(0, 1);                                    // makeFriends
    ds.unite(1, 3);
    int queries[3][2] = {{0, 2}, {0, 1}, {0, 3}};
    for (auto& q : queries)
        cout << "areFriends(" << q[0] << ", " << q[1] << "): " << (ds.areFriends(q[0], q[1]) ? "Yes" : "No") << "\n";
    cout << "parent:";
    for (int p : ds.parents()) cout << " " << p;
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static class DisjointSet {
        int[] parent;
        DisjointSet(int n) {
            parent = new int[n];
            for (int i = 0; i < n; i++) parent[i] = i;   // every element starts as its own set
        }
        int find(int x) {
            while (parent[x] != x) x = parent[x];       // climb to the root
            return x;
        }
        void union(int x, int y) {
            int rx = find(x), ry = find(y);
            if (rx != ry) parent[ry] = rx;              // hang one tree under the other root
        }
        boolean areFriends(int x, int y) { return find(x) == find(y); }
    }

    public static void main(String[] args) {
        DisjointSet ds = new DisjointSet(4);
        ds.union(0, 1);                                 // makeFriends
        ds.union(1, 3);
        int[][] queries = {{0, 2}, {0, 1}, {0, 3}};
        for (int[] q : queries)
            System.out.println("areFriends(" + q[0] + ", " + q[1] + "): " + (ds.areFriends(q[0], q[1]) ? "Yes" : "No"));
        StringBuilder sb = new StringBuilder("parent:");
        for (int p : ds.parent) sb.append(' ').append(p);
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
class DisjointSet {
    constructor(n) { this.parent = Array.from({ length: n }, (_, i) => i); }   // every element is its own set
    find(x) {
        while (this.parent[x] !== x) x = this.parent[x];   // climb to the root
        return x;
    }
    union(x, y) {
        const rx = this.find(x), ry = this.find(y);
        if (rx !== ry) this.parent[ry] = rx;               // hang one tree under the other root
    }
    areFriends(x, y) { return this.find(x) === this.find(y); }
}

const ds = new DisjointSet(4);
ds.union(0, 1);                                            // makeFriends
ds.union(1, 3);
for (const [x, y] of [[0, 2], [0, 1], [0, 3]])
    console.log(`areFriends(${x}, ${y}):`, ds.areFriends(x, y) ? "Yes" : "No");
console.log("parent:", ds.parent.join(" "));
```

```text filename:Output
areFriends(0, 2): No
areFriends(0, 1): Yes
areFriends(0, 3): Yes
parent: 0 0 2 0
```

Time O(n) worst case per operation — the tree can degenerate into a chain · Space O(n)

> [!WARNING] Pitfall
>
> Naive union can build a tree that is a straight line: `union(1,0), union(2,1), union(3,2), …` makes `find(0)` walk `n` steps. The two optimisations below exist to keep every tree shallow.

# Union by rank (or by size)

Keep an extra array `rank` that stores an upper bound on the <strong>height</strong> of each root's tree. When uniting two roots, make the root of the <strong>shorter</strong> tree a child of the taller one — the height does not grow. Only when both have equal rank does the merged tree get one level taller.

```text filename:Attach%20the%20shallower%20tree%20under%20the%20deeper%20root%20%E2%80%94%20height%20grows%20only%20on%20a%20tie
rank[rx] < rank[ry]          rank[rx] > rank[ry]          rank[rx] == rank[ry]
parent[rx] = ry              parent[ry] = rx              parent[ry] = rx; rank[rx] += 1

    (ry)                         (rx)                         (rx)  rank+1
   /  │  \                      /  │  \                      /  │  \
 ...  ... (rx)                ...  ... (ry)                 ...  ... (ry)
```

| Variant | What is compared | Guarantee |
| --- | --- | --- |
| Union by rank | height bound of the two trees | height ≤ `log₂ n` → `find` is `O(log n)` |
| Union by size | number of elements in the two trees (attach smaller under larger) | same `O(log n)` bound; the size array is useful in its own right (component sizes) |

> [!NOTE] Why log n
>
> With union by rank alone, a tree of height `h` must contain at least `2^h` elements (each rank increase doubles the minimum size), so no tree is deeper than `log₂ n`.

# Path compression

`find(x)` already visits every node on the path from `x` to the root. While it is there, <strong>re-point each of them directly at the root</strong> — the next `find` on any of them is a single step. The parent array is only ever changed in a way that keeps the same sets.

```text filename:Path%20compression%20flattens%20the%20path%20that%20find()%20walks
before find(6)                      after find(6)

     (0)                               (0)
     / \                             / | \
   (1) (2)                         (1)(2)(4)        6 and 4 now point straight at 0;
         │                              │   \       5 still points at 4 (it was not on the path)
        (4)                            (3)  (6) …
       /   \
     (5)   (6)
```

> [!TIP] Example
>
> <strong>Input:</strong> `n = 7; union(0,1) union(2,3) union(4,5) union(1,3) union(5,6) union(3,5); then find(6)`<br><strong>Output:</strong> `parent array before / after shows the compression; connected(2, 5) = Yes`

```python filename:Python
class DisjointSet:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n                    # upper bound on the height of each root's tree
        self.components = n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])   # path compression: point straight at the root
        return self.parent[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False                       # already in the same set
        if self.rank[rx] < self.rank[ry]:      # union by rank: shallower tree goes under the deeper root
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1                 # only a tie makes the tree taller
        self.components -= 1
        return True

    def connected(self, x, y):
        return self.find(x) == self.find(y)

ds = DisjointSet(7)
for x, y in [(0, 1), (2, 3), (4, 5), (1, 3), (5, 6), (3, 5)]:
    ds.union(x, y)
print("parent after unions:", " ".join(map(str, ds.parent)))
print("find(6) =", ds.find(6))
print("parent after find(6):", " ".join(map(str, ds.parent)))
print("connected(2, 5):", "Yes" if ds.connected(2, 5) else "No")
print("connected(3, 6):", "Yes" if ds.connected(3, 6) else "No")
print("components:", ds.components)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

class DisjointSet {
    vector<int> parent, rnk;                      // rnk = upper bound on the height of each root's tree
public:
    int components;
    DisjointSet(int n) : parent(n), rnk(n, 0), components(n) {
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);   // path compression: point straight at the root
        return parent[x];
    }
    bool unite(int x, int y) {
        int rx = find(x), ry = find(y);
        if (rx == ry) return false;               // already in the same set
        if (rnk[rx] < rnk[ry]) swap(rx, ry);      // union by rank: shallower tree goes under the deeper root
        parent[ry] = rx;
        if (rnk[rx] == rnk[ry]) rnk[rx]++;        // only a tie makes the tree taller
        components--;
        return true;
    }
    bool connected(int x, int y) { return find(x) == find(y); }
    void printParents(const string& label) {
        cout << label << ":";
        for (int p : parent) cout << " " << p;
        cout << "\n";
    }
};

int main() {
    DisjointSet ds(7);
    int edges[6][2] = {{0, 1}, {2, 3}, {4, 5}, {1, 3}, {5, 6}, {3, 5}};
    for (auto& e : edges) ds.unite(e[0], e[1]);
    ds.printParents("parent after unions");
    cout << "find(6) = " << ds.find(6) << "\n";
    ds.printParents("parent after find(6)");
    cout << "connected(2, 5): " << (ds.connected(2, 5) ? "Yes" : "No") << "\n";
    cout << "connected(3, 6): " << (ds.connected(3, 6) ? "Yes" : "No") << "\n";
    cout << "components: " << ds.components << "\n";
}
```

```java filename:Java
public class Main {
    static class DisjointSet {
        int[] parent, rank;                           // rank = upper bound on the height of each root's tree
        int components;
        DisjointSet(int n) {
            parent = new int[n]; rank = new int[n]; components = n;
            for (int i = 0; i < n; i++) parent[i] = i;
        }
        int find(int x) {
            if (parent[x] != x) parent[x] = find(parent[x]);   // path compression: point straight at the root
            return parent[x];
        }
        boolean union(int x, int y) {
            int rx = find(x), ry = find(y);
            if (rx == ry) return false;               // already in the same set
            if (rank[rx] < rank[ry]) { int t = rx; rx = ry; ry = t; }   // union by rank: shallower under deeper
            parent[ry] = rx;
            if (rank[rx] == rank[ry]) rank[rx]++;     // only a tie makes the tree taller
            components--;
            return true;
        }
        boolean connected(int x, int y) { return find(x) == find(y); }
        String parents() {
            StringBuilder sb = new StringBuilder();
            for (int p : parent) sb.append(' ').append(p);
            return sb.toString();
        }
    }

    public static void main(String[] args) {
        DisjointSet ds = new DisjointSet(7);
        int[][] edges = {{0, 1}, {2, 3}, {4, 5}, {1, 3}, {5, 6}, {3, 5}};
        for (int[] e : edges) ds.union(e[0], e[1]);
        System.out.println("parent after unions:" + ds.parents());
        System.out.println("find(6) = " + ds.find(6));
        System.out.println("parent after find(6):" + ds.parents());
        System.out.println("connected(2, 5): " + (ds.connected(2, 5) ? "Yes" : "No"));
        System.out.println("connected(3, 6): " + (ds.connected(3, 6) ? "Yes" : "No"));
        System.out.println("components: " + ds.components);
    }
}
```

```javascript filename:JavaScript
class DisjointSet {
    constructor(n) {
        this.parent = Array.from({ length: n }, (_, i) => i);
        this.rank = new Array(n).fill(0);             // upper bound on the height of each root's tree
        this.components = n;
    }
    find(x) {
        if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);   // path compression
        return this.parent[x];
    }
    union(x, y) {
        let rx = this.find(x), ry = this.find(y);
        if (rx === ry) return false;                  // already in the same set
        if (this.rank[rx] < this.rank[ry]) [rx, ry] = [ry, rx];   // union by rank: shallower under deeper
        this.parent[ry] = rx;
        if (this.rank[rx] === this.rank[ry]) this.rank[rx]++;     // only a tie makes the tree taller
        this.components--;
        return true;
    }
    connected(x, y) { return this.find(x) === this.find(y); }
}

const ds = new DisjointSet(7);
for (const [x, y] of [[0, 1], [2, 3], [4, 5], [1, 3], [5, 6], [3, 5]]) ds.union(x, y);
console.log("parent after unions:", ds.parent.join(" "));
console.log("find(6) =", ds.find(6));
console.log("parent after find(6):", ds.parent.join(" "));
console.log("connected(2, 5):", ds.connected(2, 5) ? "Yes" : "No");
console.log("connected(3, 6):", ds.connected(3, 6) ? "Yes" : "No");
console.log("components:", ds.components);
```

```text filename:Output
parent after unions: 0 0 0 0 0 4 4
find(6) = 0
parent after find(6): 0 0 0 0 0 4 0
connected(2, 5): Yes
connected(3, 6): Yes
components: 1
```

Time O(α(n)) amortised per operation — effectively constant · Space O(n)

| Optimisations used | Amortised cost per operation |
| --- | --- |
| none | O(n) |
| union by rank only | O(log n) |
| path compression only | O(log n) |
| <strong>both</strong> | <strong>O(α(n))</strong> — the inverse Ackermann function, `≤ 4` for every `n` that fits in the universe |

> [!NOTE] Rank ≠ height
>
> After path compression the `rank` values are no longer exact heights — they are only upper bounds. That is fine: the proof of the `log n` bound only needs ranks to be upper bounds, and leaving them untouched keeps `find` simple.

> [!WARNING] Pitfall
>
> The recursive `find` compresses the path but recurses once per level. Python's recursion limit (1000) can be hit on adversarial inputs <em>before</em> the first compression; an iterative two-pass version (first find the root, then re-point every node on the path) avoids that.

# Detect a cycle in an undirected graph

Process the edges one by one. For edge `(u, v)`: if `u` and `v` are already in the same set, this edge closes a <strong>cycle</strong>; otherwise unite them. This is also exactly the test Kruskal's algorithm uses to decide whether an edge may join the spanning tree.

> [!TIP] Example
>
> <strong>Input:</strong> `n = 4, edges = (0,1) (1,2) (2,3) (3,1)`<br><strong>Output:</strong> `cycle found at edge 3-1`

> [!NOTE] Idea
>
> An edge between two vertices that are already connected creates a second path between them — a cycle. Union–find answers "already connected?" in near-constant time, so the whole scan is `O(E · α(V))`.

```python filename:Python
class DisjointSet:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        return True

def has_cycle(n, edges):
    ds = DisjointSet(n)
    for u, v in edges:
        if ds.find(u) == ds.find(v):                 # already connected → this edge closes a cycle
            print(f"edge {u}-{v}: already connected → cycle")
            return True
        ds.union(u, v)
        print(f"edge {u}-{v}: joined")
    return False

edges = [(0, 1), (1, 2), (2, 3), (3, 1)]
print("graph has a cycle:", "Yes" if has_cycle(4, edges) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

struct DisjointSet {
    vector<int> parent, rnk;
    DisjointSet(int n) : parent(n), rnk(n, 0) { for (int i = 0; i < n; i++) parent[i] = i; }
    int find(int x) { return parent[x] == x ? x : parent[x] = find(parent[x]); }
    bool unite(int x, int y) {
        int rx = find(x), ry = find(y);
        if (rx == ry) return false;
        if (rnk[rx] < rnk[ry]) swap(rx, ry);
        parent[ry] = rx;
        if (rnk[rx] == rnk[ry]) rnk[rx]++;
        return true;
    }
};

bool hasCycle(int n, const vector<pair<int,int>>& edges) {
    DisjointSet ds(n);
    for (auto [u, v] : edges) {
        if (ds.find(u) == ds.find(v)) {              // already connected → this edge closes a cycle
            cout << "edge " << u << "-" << v << ": already connected → cycle\n";
            return true;
        }
        ds.unite(u, v);
        cout << "edge " << u << "-" << v << ": joined\n";
    }
    return false;
}

int main() {
    vector<pair<int,int>> edges = {{0, 1}, {1, 2}, {2, 3}, {3, 1}};
    bool cyc = hasCycle(4, edges);
    cout << "graph has a cycle: " << (cyc ? "Yes" : "No") << "\n";
}
```

```java filename:Java
public class Main {
    static class DisjointSet {
        int[] parent, rank;
        DisjointSet(int n) { parent = new int[n]; rank = new int[n]; for (int i = 0; i < n; i++) parent[i] = i; }
        int find(int x) { return parent[x] == x ? x : (parent[x] = find(parent[x])); }
        boolean union(int x, int y) {
            int rx = find(x), ry = find(y);
            if (rx == ry) return false;
            if (rank[rx] < rank[ry]) { int t = rx; rx = ry; ry = t; }
            parent[ry] = rx;
            if (rank[rx] == rank[ry]) rank[rx]++;
            return true;
        }
    }

    static boolean hasCycle(int n, int[][] edges) {
        DisjointSet ds = new DisjointSet(n);
        for (int[] e : edges) {
            int u = e[0], v = e[1];
            if (ds.find(u) == ds.find(v)) {              // already connected → this edge closes a cycle
                System.out.println("edge " + u + "-" + v + ": already connected → cycle");
                return true;
            }
            ds.union(u, v);
            System.out.println("edge " + u + "-" + v + ": joined");
        }
        return false;
    }

    public static void main(String[] args) {
        int[][] edges = {{0, 1}, {1, 2}, {2, 3}, {3, 1}};
        boolean cyc = hasCycle(4, edges);
        System.out.println("graph has a cycle: " + (cyc ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
class DisjointSet {
    constructor(n) { this.parent = Array.from({ length: n }, (_, i) => i); this.rank = new Array(n).fill(0); }
    find(x) { return this.parent[x] === x ? x : (this.parent[x] = this.find(this.parent[x])); }
    union(x, y) {
        let rx = this.find(x), ry = this.find(y);
        if (rx === ry) return false;
        if (this.rank[rx] < this.rank[ry]) [rx, ry] = [ry, rx];
        this.parent[ry] = rx;
        if (this.rank[rx] === this.rank[ry]) this.rank[rx]++;
        return true;
    }
}

function hasCycle(n, edges) {
    const ds = new DisjointSet(n);
    for (const [u, v] of edges) {
        if (ds.find(u) === ds.find(v)) {                 // already connected → this edge closes a cycle
            console.log(`edge ${u}-${v}: already connected → cycle`);
            return true;
        }
        ds.union(u, v);
        console.log(`edge ${u}-${v}: joined`);
    }
    return false;
}

const edges = [[0, 1], [1, 2], [2, 3], [3, 1]];
const cyc = hasCycle(4, edges);
console.log("graph has a cycle:", cyc ? "Yes" : "No");
```

```text filename:Output
edge 0-1: joined
edge 1-2: joined
edge 2-3: joined
edge 3-1: already connected → cycle
graph has a cycle: Yes
```

Time O(E · α(V)) · Space O(V)

> [!WARNING] Pitfall
>
> This test is for <strong>undirected</strong> graphs only. In a directed graph the edges `a → b` and `c → b` put `a`, `b`, `c` in one set without any cycle; directed cycle detection needs DFS with colours (see Graphs).

# Where disjoint sets are used

> [!NOTE] Kruskal's MST
>
> Sort edges by weight; add an edge iff its endpoints are in different sets.

> [!NOTE] Connected components
>
> Union every edge; the number of roots is the number of components — `components` above.

> [!NOTE] Cycle detection
>
> An edge inside one set closes a cycle (above).

> [!NOTE] Dynamic connectivity
>
> Answer "are x and y connected?" while edges keep arriving — the friends problem.

> [!NOTE] Image / grid regions
>
> Flood-fill alternatives: unite neighbouring pixels of the same colour (number of islands).

> [!NOTE] Percolation, LCA (Tarjan), equivalence classes
>
> Any problem that merges groups and never splits them.

> [!WARNING] Watch out
>
> Union–find supports <strong>merge only</strong> — there is no efficient `split`. If sets must be separated again, it is the wrong structure (use offline processing in reverse, or a link-cut tree).

# Interview Q&amp;A

```question
What is the amortised complexity of union–find with both optimisations, and what does α(n) mean?

---

`O(α(n))` per operation amortised, where `α` is the <strong>inverse Ackermann function</strong> — it grows so slowly that `α(n) ≤ 4` for any `n` below `2^65536`. In practice every operation is constant time. Tarjan proved this bound is tight for the structure.
```

```question
Union by rank vs union by size — any difference?

---

Both guarantee `O(log n)` tree height and `O(α(n))` with path compression. Size is more useful when you also need component sizes (e.g. "size of the largest group"); rank is a smaller number to store. Never attach arbitrarily — that is what allows `O(n)` chains.
```

```question
How does path compression work and why doesn't it break the sets?

---

During `find(x)`, every node on the path to the root gets `parent[node] = root`. Membership is defined by <em>which root you reach</em>, not by the exact path, so re-pointing nodes at the same root changes nothing about the sets while making future finds shorter.
```

```question
How would you detect a cycle in an undirected graph with union–find?

---

Process the edges; for `(u, v)` check `find(u) == find(v)`. Equal → the edge connects two already-connected vertices → cycle. Otherwise `union(u, v)`. Total `O(E · α(V))`. It also counts components: `V − (number of successful unions)`.
```

```question
Why does Kruskal's algorithm rely on union–find?

---

Kruskal adds the cheapest edge that does not form a cycle. The cycle test on each of `E` sorted edges would cost `O(V)` with DFS; union–find makes it near constant, giving `O(E log E)` total dominated by the sort.
```
