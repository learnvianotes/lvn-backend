---
id: 42154a68-d3e7-77e0-893f-5a276acaf4ca
key: topic:dsa-basics/hashing
subject: dsa-basics
topic: hashing
title: Hashing
slug: hashing
order: 1
---

Hashing turns a key into an array index with a <strong>hash function</strong>, so that search, insert and delete all run in <strong>O(1) on average</strong>. It is the engine behind every dictionary, set, cache and database index you will ever use.

> [!INFO]
>
> <strong>Hashing</strong> — a technique that maps keys from a large <em>universe</em> (all integers, all strings …) into a small array called the <strong>hash table</strong> using a hash function `h(key) → 0 … m-1`. The slot `h(key)` is where the key is stored and where it is looked up again.

Universe of keys → Hash function h(key) → Index 0 … m-1 → Hash table slot

| Operation | Average | Worst case | Why |
| --- | --- | --- | --- |
| `search(key)` | O(1) | O(n) | Compute `h(key)`, look in that slot. Worst case: every key collided into the same slot. |
| `insert(key)` | O(1) | O(n) | Same slot computation; the worst case is a full probe sequence or a long chain. |
| `delete(key)` | O(1) | O(n) | Find the key as in search, then unlink / mark it. |

> [!NOTE] Key point
>
> The O(1) is <strong>average</strong> and relies on a good hash function and a table that is not overfull (low <em>load factor</em>, see below). A bad hash function degrades a hash table to a linked list.

# What hashing is good for — and what it is not

> [!NOTE] Dictionaries and sets
>
> Language containers: Python `dict`/`set`, C++ `unordered_map`, Java `HashMap`, JS `Map`.

> [!NOTE] Database indexing
>
> Hash indexes answer `WHERE id = 42` without scanning the table.

> [!NOTE] Cryptography
>
> SHA-256 and friends are hash functions designed so that collisions are infeasible to find.

> [!NOTE] Caches
>
> A cache maps a request key to a stored response in O(1) — memoisation, CPU caches, CDNs.

> [!NOTE] Symbol tables
>
> Compilers and interpreters look up every identifier by name in a hash table.

> [!NOTE] Routers
>
> A router maps a destination address to an output port with a hash lookup.

> [!WARNING] Watch out
>
> Hashing is <strong>not</strong> the right tool when you need order: finding the <em>closest</em> value, the <em>k</em>-th smallest, a sorted traversal, or <em>prefix</em> searches (use a Trie) and range queries (use a balanced BST / sorted array). A hash table scatters keys deliberately, so neighbouring keys end up far apart.

# Direct address table

Suppose there are at most 1000 keys and every key is an integer between 0 and 999. The simplest O(1) structure is a boolean (or value) array of size 1000 where the key <strong>is</strong> the index: `table[key] = true` inserts, `table[key]` searches, `table[key] = false` deletes.

```text filename:A%20direct%20address%20table%20for%20keys%200%E2%80%939
key:    0     1     2     3     4     5     6     7     8     9
      ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
      │  T  │  F  │  F  │  T  │  F  │  F  │  F  │  T  │  F  │  F  │
      └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
after insert(0), insert(3), insert(7) — the key is the index, no hash function at all
```

```python filename:Python
table = [False] * 10          # keys 0..9, the key itself is the index

def insert(k): table[k] = True
def delete(k): table[k] = False
def search(k): return table[k]

for k in (0, 3, 7):
    insert(k)
print("search 3:", "true" if search(3) else "false")
print("search 5:", "true" if search(5) else "false")
delete(3)
print("after delete 3 → search 3:", "true" if search(3) else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

bool table[10] = {false};     // keys 0..9, the key itself is the index

void insertKey(int k) { table[k] = true; }
void deleteKey(int k) { table[k] = false; }
bool search(int k) { return table[k]; }

int main() {
    for (int k : {0, 3, 7}) insertKey(k);
    cout << "search 3: " << (search(3) ? "true" : "false") << "\n";
    cout << "search 5: " << (search(5) ? "true" : "false") << "\n";
    deleteKey(3);
    cout << "after delete 3 → search 3: " << (search(3) ? "true" : "false") << "\n";
}
```

```java filename:Java
public class Main {
    static boolean[] table = new boolean[10];   // keys 0..9, the key itself is the index

    static void insert(int k) { table[k] = true; }
    static void delete(int k) { table[k] = false; }
    static boolean search(int k) { return table[k]; }

    public static void main(String[] args) {
        for (int k : new int[]{0, 3, 7}) insert(k);
        System.out.println("search 3: " + search(3));
        System.out.println("search 5: " + search(5));
        delete(3);
        System.out.println("after delete 3 → search 3: " + search(3));
    }
}
```

```javascript filename:JavaScript
const table = new Array(10).fill(false);   // keys 0..9, the key itself is the index

const insert = (k) => { table[k] = true; };
const del = (k) => { table[k] = false; };
const search = (k) => table[k];

for (const k of [0, 3, 7]) insert(k);
console.log("search 3:", search(3));
console.log("search 5:", search(5));
del(3);
console.log("after delete 3 → search 3:", search(3));
```

```text filename:Output
search 3: true
search 5: false
after delete 3 → search 3: false
```

Time O(1) per operation · Space O(size of key universe)

> [!DANGER] Avoid
>
> The direct address table <strong>cannot handle large or non-integer keys</strong>: 10-digit phone numbers would need a 10-billion-slot array, and strings have no natural index at all. Hashing fixes this by <em>compressing</em> the key universe into a small range `0 … m-1`.

# Hash functions

A hash function `h` converts a key into a slot index. A good one has four properties:

1. <strong>Deterministic</strong> — the same key must always map to the same slot, or we could never find it again.
2. <strong>In range</strong> — produces values in `0 … m-1` where `m` is the table size.
3. <strong>Fast</strong> — O(1) for integers and O(len) for a string of length `len`.
4. <strong>Uniform</strong> — spreads keys evenly across the slots, so that chains and probe sequences stay short.

| Key type | Typical hash function | Note |
| --- | --- | --- |
| Integer | `h(key) = key % m` | Choose `m` <strong>prime</strong> and not close to a power of 2, so patterns in the keys (even numbers, multiples of 10) do not pile up in a few slots. |
| String | Weighted (polynomial) sum: `h = (h · 31 + c) % m` over the characters | Plain sum of character codes is bad: `"abc"`, `"bca"`, `"cab"` would all collide. The weight makes position matter. |
| Any | <strong>Universal hashing</strong>: pick `h` at random from a family of functions at start-up | No fixed input can be adversarially chosen to collide, because the attacker does not know which function was picked. |

```python filename:Python
def string_hash(s, m):
    h = 0
    for ch in s:
        h = (h * 31 + ord(ch)) % m    # weighted sum: position matters
    return h

M = 97                                # a prime table size
for s in ["abc", "cab", "bca", "hash"]:
    print(s, "→", string_hash(s, M))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
using namespace std;

int stringHash(const string& s, int m) {
    long long h = 0;
    for (char ch : s)
        h = (h * 31 + ch) % m;        // weighted sum: position matters
    return (int)h;
}

int main() {
    const int M = 97;                 // a prime table size
    for (string s : {"abc", "cab", "bca", "hash"})
        cout << s << " → " << stringHash(s, M) << "\n";
}
```

```java filename:Java
public class Main {
    static int stringHash(String s, int m) {
        long h = 0;
        for (char ch : s.toCharArray())
            h = (h * 31 + ch) % m;    // weighted sum: position matters
        return (int) h;
    }

    public static void main(String[] args) {
        final int M = 97;             // a prime table size
        for (String s : new String[]{"abc", "cab", "bca", "hash"})
            System.out.println(s + " → " + stringHash(s, M));
    }
}
```

```javascript filename:JavaScript
function stringHash(s, m) {
    let h = 0;
    for (const ch of s)
        h = (h * 31 + ch.charCodeAt(0)) % m;   // weighted sum: position matters
    return h;
}

const M = 97;                                  // a prime table size
for (const s of ["abc", "cab", "bca", "hash"])
    console.log(s, "→", stringHash(s, M));
```

```text filename:Output
abc → 33
cab → 80
bca → 53
hash → 67
```

Time O(len) per string · Space O(1)

> [!NOTE] Key point
>
> Java's `String.hashCode()` is exactly this polynomial with base 31 (without the modulo); Python and JavaScript engines use randomised variants so that attackers cannot pre-compute colliding keys.

# Collisions and how to handle them

> [!INFO]
>
> <strong>Collision</strong> — two different keys hashing to the same slot: `h(k1) == h(k2)` with `k1 != k2`. With more possible keys than slots, collisions are unavoidable (pigeonhole principle) — a hash table design is mostly a decision about what to do when they happen.

> [!NOTE] Perfect hashing
>
> If <strong>all keys are known in advance</strong> (keywords of a programming language, a fixed set of country codes) a collision-free function can be constructed offline. Not possible for dynamic data.

> [!NOTE] Chaining
>
> Each slot holds a <strong>list</strong> of all keys that hashed there. The table never fills up.

> [!NOTE] Open addressing
>
> All keys live <strong>inside the array</strong>. On a collision, probe other slots in a fixed order until an empty one is found: linear probing, quadratic probing or double hashing.

# Chaining

The table is an array of `m` list heads. `insert` appends to the list at `h(key)`, `search` and `delete` walk that one list only. With `h(key) = key % 7` and the keys `50, 21, 58, 17, 15, 49, 56, 22, 23, 25`:

```text filename:Chaining%20with%20m%20%3D%207%3A%20every%20slot%20owns%20the%20chain%20of%20keys%20that%20hashed%20to%20it
slot
 0  │ 21 │──▶│ 49 │──▶│ 56 │          21 % 7 = 0, 49 % 7 = 0, 56 % 7 = 0
 1  │ 50 │──▶│ 15 │──▶│ 22 │          50 % 7 = 1, 15 % 7 = 1, 22 % 7 = 1
 2  │ 58 │──▶│ 23 │                   58 % 7 = 2, 23 % 7 = 2
 3  │ 17 │
 4  │ 25 │
 5  │    │
 6  │    │
hash table = array of linked-list heads
```

<strong>Performance.</strong> Let `m` be the number of slots and `n` the number of keys. The <strong>load factor</strong> `α = n / m` is the expected chain length under uniform hashing, so:

`expected search / delete time = O(1 + α) — O(1) to hash, O(α) to walk the chain`

Keeping `α` bounded by a constant (Java's `HashMap` rehashes at `α = 0.75`) makes every operation O(1) on average. Chains can be stored in any of these:

| Chain structure | Pros | Cons |
| --- | --- | --- |
| Linked list | O(1) insert at head, no resizing | Poor cache locality, one pointer per key |
| Dynamic array (`vector`, `ArrayList`, Python `list`) | Cache friendly, simple | Delete from the middle shifts elements (chains are short, so it hardly matters) |
| Self-balancing BST (AVL, Red-Black) | Worst case per chain drops to O(log n) — Java 8+ `HashMap` switches a bucket to a tree when it grows past 8 entries | Heavier nodes, more code |

> [!TIP] Example
>
> <strong>Input:</strong> `buckets = 7; insert 70, 71, 9, 56, 72; delete 56; search 9, 93`<br><strong>Output:</strong> `9 → true, 93 → false`

```python filename:Python
class ChainedHash:
    def __init__(self, buckets):
        self.buckets = buckets
        self.table = [[] for _ in range(buckets)]   # one list per slot

    def _h(self, key):
        return key % self.buckets

    def insert(self, key):
        self.table[self._h(key)].append(key)        # O(1): append to the chain

    def delete(self, key):
        chain = self.table[self._h(key)]
        if key in chain:
            chain.remove(key)                       # O(chain length)

    def search(self, key):
        return key in self.table[self._h(key)]      # walk one chain only

    def show(self):
        for i, chain in enumerate(self.table):
            print(f"{i}:", *chain)

h = ChainedHash(7)
for k in (70, 71, 9, 56, 72):
    h.insert(k)
h.show()
h.delete(56)
print("after delete 56")
h.show()
print("search 9:", "true" if h.search(9) else "false")
print("search 93:", "true" if h.search(93) else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <list>
#include <vector>
#include <algorithm>
using namespace std;

class ChainedHash {
    int buckets;
    vector<list<int>> table;                        // one linked list per slot
    int h(int key) const { return key % buckets; }
public:
    ChainedHash(int b) : buckets(b), table(b) {}
    void insert(int key) { table[h(key)].push_back(key); }       // O(1)
    void remove(int key) { table[h(key)].remove(key); }          // O(chain length)
    bool search(int key) const {
        const list<int>& chain = table[h(key)];
        return find(chain.begin(), chain.end(), key) != chain.end();
    }
    void show() const {
        for (int i = 0; i < buckets; i++) {
            cout << i << ":";
            for (int k : table[i]) cout << " " << k;
            cout << "\n";
        }
    }
};

int main() {
    ChainedHash h(7);
    for (int k : {70, 71, 9, 56, 72}) h.insert(k);
    h.show();
    h.remove(56);
    cout << "after delete 56\n";
    h.show();
    cout << "search 9: " << (h.search(9) ? "true" : "false") << "\n";
    cout << "search 93: " << (h.search(93) ? "true" : "false") << "\n";
}
```

```java filename:Java
import java.util.LinkedList;

public class Main {
    static class ChainedHash {
        int buckets;
        LinkedList<Integer>[] table;                 // one linked list per slot

        @SuppressWarnings("unchecked")
        ChainedHash(int b) {
            buckets = b;
            table = new LinkedList[b];
            for (int i = 0; i < b; i++) table[i] = new LinkedList<>();
        }
        int h(int key) { return key % buckets; }
        void insert(int key) { table[h(key)].add(key); }                 // O(1)
        void delete(int key) { table[h(key)].remove(Integer.valueOf(key)); }   // O(chain length)
        boolean search(int key) { return table[h(key)].contains(key); }
        void show() {
            for (int i = 0; i < buckets; i++) {
                StringBuilder sb = new StringBuilder(i + ":");
                for (int k : table[i]) sb.append(" ").append(k);
                System.out.println(sb);
            }
        }
    }

    public static void main(String[] args) {
        ChainedHash h = new ChainedHash(7);
        for (int k : new int[]{70, 71, 9, 56, 72}) h.insert(k);
        h.show();
        h.delete(56);
        System.out.println("after delete 56");
        h.show();
        System.out.println("search 9: " + h.search(9));
        System.out.println("search 93: " + h.search(93));
    }
}
```

```javascript filename:JavaScript
class ChainedHash {
    constructor(buckets) {
        this.buckets = buckets;
        this.table = Array.from({ length: buckets }, () => []);   // one list per slot
    }
    h(key) { return key % this.buckets; }
    insert(key) { this.table[this.h(key)].push(key); }            // O(1)
    delete(key) {
        const chain = this.table[this.h(key)];
        const at = chain.indexOf(key);
        if (at !== -1) chain.splice(at, 1);                       // O(chain length)
    }
    search(key) { return this.table[this.h(key)].includes(key); }
    show() {
        this.table.forEach((chain, i) => console.log(`${i}:` + chain.map(k => " " + k).join("")));
    }
}

const h = new ChainedHash(7);
for (const k of [70, 71, 9, 56, 72]) h.insert(k);
h.show();
h.delete(56);
console.log("after delete 56");
h.show();
console.log("search 9:", h.search(9));
console.log("search 93:", h.search(93));
```

```text filename:Output
0: 70 56
1: 71
2: 9 72
3:
4:
5:
6:
after delete 56
0: 70
1: 71
2: 9 72
3:
4:
5:
6:
search 9: true
search 93: false
```

Time O(1 + α) average, O(n) worst · Space O(n + m)

# Load factor and rehashing

> [!INFO]
>
> <strong>Load factor α</strong> — `n / m` — the number of stored keys divided by the number of slots. It measures how full the table is and directly controls the cost of every operation.

```text filename:The%20load%20factor%20grows%20with%20every%20insert%20and%20drops%20when%20the%20table%20is%20resized
empty table, 10 slots         [_, _, _, _, _, _, _, _, _, _]                        α = 0.0
after 5 insertions            [x, x, x, x, x, _, _, _, _, _]                        α = 0.5
after 10 insertions           [x, x, x, x, x, x, x, x, x, x]                        α = 1.0  (full)
rehash to 20 slots, insert    [x, x, x, x, x, x, x, x, x, x, x, _, _, _, _, _, _, _, _, _]   α = 0.55
```

<strong>Rehashing</strong>: when `α` crosses a threshold (typically 0.75 for chaining, 0.5 for open addressing), allocate a new table about twice as large and re-insert every key with the <em>new</em> `h` — the slot of a key depends on `m`, so the old positions are useless. One rehash costs O(n), but it happens only after O(n) cheap inserts, so insertion stays <strong>amortised O(1)</strong>.

| Scheme | Expected successful search | Expected unsuccessful search / insert | Must keep |
| --- | --- | --- | --- |
| Chaining | O(1 + α) | O(1 + α) | `α` bounded by a constant (any value works, even `α > 1`) |
| Open addressing | about `1/α · ln(1/(1-α))` | about `1 / (1 - α)` | `α < 1`, in practice `α ≤ 0.5 … 0.7` |

> [!NOTE] Key point
>
> Read the open-addressing formula at `α = 0.5`: an unsuccessful search probes about 2 slots; at `α = 0.9` about 10. Performance degrades sharply as the table fills, which is why open-addressing tables resize early.

# Open addressing — linear probing

In open addressing there are no chains: <strong>every key lives in the array itself</strong>, so the number of slots must be `>=` the number of keys. On a collision we <em>probe</em> — try other slots in a fixed sequence until an empty one appears. Because all data is in one contiguous array, this is very <strong>cache friendly</strong>.

`linear probing: hash(key, i) = (h(key) + i) % m for i = 0, 1, 2, …`

With `m = 7`, `h(key) = key % 7` and the keys `50, 51, 49, 16, 56, 15, 19`:

```text filename:Linear%20probing%3A%20each%20collision%20slides%20to%20the%20next%20free%20slot%20(wrapping%20around%20at%20the%20end)
key   h(key)   placed at                    0 │ 49 │
 50     1      1                            1 │ 50 │
 51     2      2                            2 │ 51 │
 49     0      0                            3 │ 16 │  ← 2 taken, moved to 3
 16     2      3   (2 taken)                4 │ 56 │  ← 0,1,2,3 taken, moved to 4
 56     0      4   (0,1,2,3 taken)          5 │ 15 │  ← 1,2,3,4 taken, moved to 5
 15     1      5   (1,2,3,4 taken)          6 │ 19 │  ← 5 taken, moved to 6
 19     5      6   (5 taken)
```

> [!NOTE] Searching
>
> Compute `h(key)` and compare. If the slot holds another key, keep moving to the next slot. Stop with <em>not found</em> when you hit an <strong>empty</strong> slot or come back to the start index.

> [!NOTE] Deleting
>
> <strong>Never simply empty the slot.</strong> An empty slot ends every search passing through it, so keys that were probed past this slot would become unreachable. Instead write a special <strong>DELETED</strong> marker: search skips over it, insert may reuse it.

> [!NOTE] Inserting
>
> Probe from `h(key)` until an empty <em>or deleted</em> slot; fail if the table is full or the key already exists (search first).

> [!INFO]
>
> <strong>Primary clustering</strong> — the phenomenon where keys that hash to the same <strong>or nearby</strong> slots form long runs of occupied slots. Any key hashing into a cluster lands at its end and makes it longer, so clusters grow faster and faster — search, insert and delete all degrade towards O(n). Linear probing suffers from it most.

# Quadratic probing and double hashing

Both break clusters by making the probe sequence depend on something other than `+1`:

| Scheme | Probe sequence | Clustering | Guarantee |
| --- | --- | --- | --- |
| Linear probing | `(h(key) + i) % m` | Primary clustering | Always finds a free slot if one exists |
| Quadratic probing | `(h(key) + i²) % m` | Secondary clustering (keys with the same `h` still share a sequence) | Guaranteed to find a free slot only if `m` is prime and `α < 0.5` |
| Double hashing | `(h1(key) + i · h2(key)) % m` | None — different keys with the same `h1` almost always get different step sizes | Finds a free slot if one exists when `h2(key)` is <strong>relatively prime to </strong><strong>`m`</strong> (e.g. `m` prime and `h2(key) = 1 + key % (m-1)`) |

Double hashing distributes keys more uniformly than linear and quadratic probing and is the closest practical approximation to the <em>uniform hashing</em> assumption behind the `1 / (1 - α)` analysis. The insert routine from the notes:

1. <strong>Reject a full table</strong>

   If `n == m` return an error — open addressing cannot store more keys than slots.

2. <strong>Compute the start and the step</strong>

   `probe = h1(key)`, `offset = h2(key)`.

3. <strong>Walk the sequence</strong>

   While `table[probe]` is occupied: `probe = (probe + offset) % m`.

4. <strong>Store</strong>

   `table[probe] = key`.

> [!TIP] Example
>
> <strong>Input:</strong> `m = 7, h1 = key % 7, h2 = 1 + key % 6; insert 50, 51, 49, 16, 56, 15, 19`<br><strong>Output:</strong> `slots 0..6: 49 50 51 56 19 16 15`

```python filename:Python
M = 7
table = [None] * M

def h1(key): return key % M
def h2(key): return 1 + key % (M - 1)        # 1..6, all relatively prime to 7

def double_hashing_insert(key):
    probe, offset = h1(key), h2(key)
    while table[probe] is not None:
        probe = (probe + offset) % M          # jump by the key's own step size
    table[probe] = key
    print(f"insert {key}: h1={h1(key)} → slot {probe}")

for k in (50, 51, 49, 16, 56, 15, 19):
    double_hashing_insert(k)
print("table:", *table)
```

```cpp filename:C%2B%2B
#include <iostream>
using namespace std;

const int M = 7;
int table_[M];
bool used[M] = {false};

int h1(int key) { return key % M; }
int h2(int key) { return 1 + key % (M - 1); }   // 1..6, all relatively prime to 7

void doubleHashingInsert(int key) {
    int probe = h1(key), offset = h2(key);
    while (used[probe])
        probe = (probe + offset) % M;            // jump by the key's own step size
    table_[probe] = key; used[probe] = true;
    cout << "insert " << key << ": h1=" << h1(key) << " → slot " << probe << "\n";
}

int main() {
    for (int k : {50, 51, 49, 16, 56, 15, 19}) doubleHashingInsert(k);
    cout << "table:";
    for (int i = 0; i < M; i++) cout << " " << table_[i];
    cout << "\n";
}
```

```java filename:Java
public class Main {
    static final int M = 7;
    static Integer[] table = new Integer[M];

    static int h1(int key) { return key % M; }
    static int h2(int key) { return 1 + key % (M - 1); }   // 1..6, all relatively prime to 7

    static void doubleHashingInsert(int key) {
        int probe = h1(key), offset = h2(key);
        while (table[probe] != null)
            probe = (probe + offset) % M;                  // jump by the key's own step size
        table[probe] = key;
        System.out.println("insert " + key + ": h1=" + h1(key) + " → slot " + probe);
    }

    public static void main(String[] args) {
        for (int k : new int[]{50, 51, 49, 16, 56, 15, 19}) doubleHashingInsert(k);
        StringBuilder sb = new StringBuilder("table:");
        for (Integer v : table) sb.append(" ").append(v);
        System.out.println(sb);
    }
}
```

```javascript filename:JavaScript
const M = 7;
const table = new Array(M).fill(null);

const h1 = (key) => key % M;
const h2 = (key) => 1 + key % (M - 1);          // 1..6, all relatively prime to 7

function doubleHashingInsert(key) {
    let probe = h1(key);
    const offset = h2(key);
    while (table[probe] !== null)
        probe = (probe + offset) % M;            // jump by the key's own step size
    table[probe] = key;
    console.log(`insert ${key}: h1=${h1(key)} → slot ${probe}`);
}

for (const k of [50, 51, 49, 16, 56, 15, 19]) doubleHashingInsert(k);
console.log("table:", table.join(" "));
```

```text filename:Output
insert 50: h1=1 → slot 1
insert 51: h1=2 → slot 2
insert 49: h1=0 → slot 0
insert 16: h1=2 → slot 5
insert 56: h1=0 → slot 3
insert 15: h1=1 → slot 6
insert 19: h1=5 → slot 4
table: 49 50 51 56 19 16 15
```

Time O(1 / (1 - α)) expected per insert · Space O(m)

> [!WARNING] Pitfall
>
> `h2(key)` must never be 0 (the probe would stay in place forever) and must be relatively prime to `m`, otherwise the sequence visits only a fraction of the slots and can miss free ones. `m` prime with `h2 = 1 + key % (m - 1)` satisfies both.

# Implementation of open addressing

A complete linear-probing table with the DELETED marker. Empty slots are `-1`, deleted slots `-2`; keys are assumed non-negative. `insert` refuses duplicates and reuses deleted slots; `search` skips deleted slots and stops at an empty one.

> [!TIP] Example
>
> <strong>Input:</strong> `capacity = 7; insert 70, 71, 9, 56, 72; delete 9; search 9, 56; insert 56 again`<br><strong>Output:</strong> `search 9 → false, search 56 → true, insert 56 → false (duplicate)`

```python filename:Python
EMPTY, DELETED = -1, -2

class OpenHash:
    def __init__(self, capacity):
        self.cap = capacity
        self.table = [EMPTY] * capacity
        self.size = 0

    def _h(self, key):
        return key % self.cap

    def search(self, key):
        h = i = self._h(key)
        while self.table[i] != EMPTY:            # a DELETED slot does NOT stop the search
            if self.table[i] == key:
                return True
            i = (i + 1) % self.cap
            if i == h:                           # wrapped all the way round
                return False
        return False

    def insert(self, key):
        if self.size == self.cap or self.search(key):
            return False
        h = i = self._h(key)
        while self.table[i] not in (EMPTY, DELETED):   # a DELETED slot can be reused
            i = (i + 1) % self.cap
            if i == h:
                return False
        self.table[i] = key
        self.size += 1
        return True

    def delete(self, key):
        h = i = self._h(key)
        while self.table[i] != EMPTY:
            if self.table[i] == key:
                self.table[i] = DELETED          # mark, never empty the slot
                self.size -= 1
                return True
            i = (i + 1) % self.cap
            if i == h:
                return False
        return False

    def show(self):
        print(*["_" if v == EMPTY else "x" if v == DELETED else v for v in self.table])

def b(x): return "true" if x else "false"

t = OpenHash(7)
for k in (70, 71, 9, 56, 72):
    t.insert(k)
t.show()
print("search 9:", b(t.search(9)))
print("delete 9:", b(t.delete(9)))
t.show()
print("search 9:", b(t.search(9)))
print("search 56:", b(t.search(56)))
print("insert 56 again:", b(t.insert(56)))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

const int EMPTY = -1, DELETED = -2;

class OpenHash {
    int cap, size = 0;
    vector<int> table;
    int h(int key) const { return key % cap; }
public:
    OpenHash(int c) : cap(c), table(c, EMPTY) {}

    bool search(int key) const {
        int start = h(key), i = start;
        while (table[i] != EMPTY) {              // a DELETED slot does NOT stop the search
            if (table[i] == key) return true;
            i = (i + 1) % cap;
            if (i == start) return false;        // wrapped all the way round
        }
        return false;
    }
    bool insert(int key) {
        if (size == cap || search(key)) return false;
        int start = h(key), i = start;
        while (table[i] != EMPTY && table[i] != DELETED) {   // a DELETED slot can be reused
            i = (i + 1) % cap;
            if (i == start) return false;
        }
        table[i] = key; size++;
        return true;
    }
    bool remove(int key) {
        int start = h(key), i = start;
        while (table[i] != EMPTY) {
            if (table[i] == key) { table[i] = DELETED; size--; return true; }   // mark, never empty
            i = (i + 1) % cap;
            if (i == start) return false;
        }
        return false;
    }
    void show() const {
        for (int i = 0; i < cap; i++) {
            if (i) cout << " ";
            if (table[i] == EMPTY) cout << "_"; else if (table[i] == DELETED) cout << "x"; else cout << table[i];
        }
        cout << "\n";
    }
};

const char* b(bool x) { return x ? "true" : "false"; }

int main() {
    OpenHash t(7);
    for (int k : {70, 71, 9, 56, 72}) t.insert(k);
    t.show();
    cout << "search 9: " << b(t.search(9)) << "\n";
    cout << "delete 9: " << b(t.remove(9)) << "\n";
    t.show();
    cout << "search 9: " << b(t.search(9)) << "\n";
    cout << "search 56: " << b(t.search(56)) << "\n";
    cout << "insert 56 again: " << b(t.insert(56)) << "\n";
}
```

```java filename:Java
public class Main {
    static final int EMPTY = -1, DELETED = -2;

    static class OpenHash {
        int cap, size = 0;
        int[] table;
        OpenHash(int c) { cap = c; table = new int[c]; java.util.Arrays.fill(table, EMPTY); }
        int h(int key) { return key % cap; }

        boolean search(int key) {
            int start = h(key), i = start;
            while (table[i] != EMPTY) {              // a DELETED slot does NOT stop the search
                if (table[i] == key) return true;
                i = (i + 1) % cap;
                if (i == start) return false;        // wrapped all the way round
            }
            return false;
        }
        boolean insert(int key) {
            if (size == cap || search(key)) return false;
            int start = h(key), i = start;
            while (table[i] != EMPTY && table[i] != DELETED) {   // a DELETED slot can be reused
                i = (i + 1) % cap;
                if (i == start) return false;
            }
            table[i] = key; size++;
            return true;
        }
        boolean delete(int key) {
            int start = h(key), i = start;
            while (table[i] != EMPTY) {
                if (table[i] == key) { table[i] = DELETED; size--; return true; }   // mark, never empty
                i = (i + 1) % cap;
                if (i == start) return false;
            }
            return false;
        }
        void show() {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < cap; i++) {
                if (i > 0) sb.append(" ");
                sb.append(table[i] == EMPTY ? "_" : table[i] == DELETED ? "x" : String.valueOf(table[i]));
            }
            System.out.println(sb);
        }
    }

    public static void main(String[] args) {
        OpenHash t = new OpenHash(7);
        for (int k : new int[]{70, 71, 9, 56, 72}) t.insert(k);
        t.show();
        System.out.println("search 9: " + t.search(9));
        System.out.println("delete 9: " + t.delete(9));
        t.show();
        System.out.println("search 9: " + t.search(9));
        System.out.println("search 56: " + t.search(56));
        System.out.println("insert 56 again: " + t.insert(56));
    }
}
```

```javascript filename:JavaScript
const EMPTY = -1, DELETED = -2;

class OpenHash {
    constructor(capacity) {
        this.cap = capacity;
        this.table = new Array(capacity).fill(EMPTY);
        this.size = 0;
    }
    h(key) { return key % this.cap; }

    search(key) {
        const start = this.h(key);
        let i = start;
        while (this.table[i] !== EMPTY) {            // a DELETED slot does NOT stop the search
            if (this.table[i] === key) return true;
            i = (i + 1) % this.cap;
            if (i === start) return false;           // wrapped all the way round
        }
        return false;
    }
    insert(key) {
        if (this.size === this.cap || this.search(key)) return false;
        const start = this.h(key);
        let i = start;
        while (this.table[i] !== EMPTY && this.table[i] !== DELETED) {   // a DELETED slot can be reused
            i = (i + 1) % this.cap;
            if (i === start) return false;
        }
        this.table[i] = key; this.size++;
        return true;
    }
    delete(key) {
        const start = this.h(key);
        let i = start;
        while (this.table[i] !== EMPTY) {
            if (this.table[i] === key) { this.table[i] = DELETED; this.size--; return true; }   // mark, never empty
            i = (i + 1) % this.cap;
            if (i === start) return false;
        }
        return false;
    }
    show() {
        console.log(this.table.map(v => v === EMPTY ? "_" : v === DELETED ? "x" : v).join(" "));
    }
}

const t = new OpenHash(7);
for (const k of [70, 71, 9, 56, 72]) t.insert(k);
t.show();
console.log("search 9:", t.search(9));
console.log("delete 9:", t.delete(9));
t.show();
console.log("search 9:", t.search(9));
console.log("search 56:", t.search(56));
console.log("insert 56 again:", t.insert(56));
```

```text filename:Output
70 71 9 56 72 _ _
search 9: true
delete 9: true
70 71 x 56 72 _ _
search 9: false
search 56: true
insert 56 again: false
```

Time O(1) average, O(n) worst · Space O(m)

> [!WARNING] Pitfall
>
> Walk through `search 56` after `delete 9`: `h(56) = 0` → slot 0 holds 70, slot 1 holds 71, slot 2 is DELETED (skip!), slot 3 holds 56 → found. Had `delete` emptied slot 2 instead, the search would have stopped there and reported 56 as missing even though it is in the table.

# Chaining vs open addressing

|  | Chaining | Open addressing |
| --- | --- | --- |
| Table full? | Never — chains simply grow | Yes; resizing becomes mandatory |
| Sensitivity to hash function | Low — a poor function only lengthens chains | High — clustering needs extra care |
| Cache performance | Poor: chain nodes are scattered in memory | Good: everything is in one array |
| Extra space | One link pointer per key | Empty slots must be kept (`α` well below 1) to achieve the same performance |
| Deletion | Unlink from the chain | Needs the DELETED marker |
| Unsuccessful search cost | `1 + α` | `1 / (1 - α)` |

# Problem: frequencies of array elements

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 12, 10, 15, 10, 20, 12, 12]`<br><strong>Output:</strong> `10 3 / 12 3 / 15 1 / 20 1`

<strong>Naive approach</strong> — for every element, skip it if it appeared earlier (so each value is printed once), otherwise count its later occurrences. Two nested passes make it O(n²) with O(1) extra space.

```python filename:Python
def count_freq(arr):
    n = len(arr)
    for i in range(n):
        if any(arr[j] == arr[i] for j in range(i)):   # already counted
            continue
        count = 1
        for j in range(i + 1, n):
            if arr[j] == arr[i]:
                count += 1
        print(arr[i], count)

count_freq([10, 12, 10, 15, 10, 20, 12, 12])
```

```text filename:Output
10 3
12 3
15 1
20 1
```

Time O(n²) · Space O(1)

> [!NOTE] Idea
>
> <strong>Efficient solution</strong> — one pass with a hash map from value to count: `freq[x] += 1` is an O(1) average update, so the whole array is processed in O(n). Hash maps iterate in an unspecified order, so the keys are sorted before printing to make the output deterministic.

```python filename:Python
def count_freq(arr):
    freq = {}
    for x in arr:
        freq[x] = freq.get(x, 0) + 1      # O(1) average per element
    for x in sorted(freq):                # sort only for a deterministic printout
        print(x, freq[x])

count_freq([10, 12, 10, 15, 10, 20, 12, 12])
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <unordered_map>
#include <algorithm>
using namespace std;

void countFreq(const vector<int>& arr) {
    unordered_map<int, int> freq;
    for (int x : arr) freq[x]++;          // O(1) average per element
    vector<int> keys;
    for (auto& kv : freq) keys.push_back(kv.first);
    sort(keys.begin(), keys.end());       // sort only for a deterministic printout
    for (int k : keys) cout << k << " " << freq[k] << "\n";
}

int main() {
    countFreq({10, 12, 10, 15, 10, 20, 12, 12});
}
```

```java filename:Java
import java.util.HashMap;
import java.util.Map;
import java.util.TreeSet;

public class Main {
    static void countFreq(int[] arr) {
        Map<Integer, Integer> freq = new HashMap<>();
        for (int x : arr) freq.merge(x, 1, Integer::sum);   // O(1) average per element
        for (int k : new TreeSet<>(freq.keySet()))          // sort only for a deterministic printout
            System.out.println(k + " " + freq.get(k));
    }

    public static void main(String[] args) {
        countFreq(new int[]{10, 12, 10, 15, 10, 20, 12, 12});
    }
}
```

```javascript filename:JavaScript
function countFreq(arr) {
    const freq = new Map();
    for (const x of arr) freq.set(x, (freq.get(x) ?? 0) + 1);   // O(1) average per element
    const keys = [...freq.keys()].sort((a, b) => a - b);        // sort only for a deterministic printout
    for (const k of keys) console.log(k, freq.get(k));
}

countFreq([10, 12, 10, 15, 10, 20, 12, 12]);
```

```text filename:Output
10 3
12 3
15 1
20 1
```

Time O(n) average (O(n log n) with the final sort) · Space O(n)

> [!NOTE] Key point
>
> If the output must follow <strong>first appearance</strong> order instead, Python `dict` and JavaScript `Map` already preserve insertion order; use `LinkedHashMap` in Java and keep a separate `vector` of first-seen keys in C++.

# Interview Q&amp;A

```question
Why is a hash table O(1) only on average?

---

The hash function could map every key to the same slot; then every operation walks a chain (or probe sequence) of length `n`. With a uniform hash function and bounded load factor the <em>expected</em> chain length is `α`, a constant, giving O(1) expected time. Balanced BSTs guarantee O(log n) in the worst case, which is why they are preferred when adversarial inputs or hard latency bounds matter.
```

```question
What is the load factor and what happens when it gets too high?

---

`α = n / m`, keys per slot. Chaining cost grows linearly as `1 + α`; open addressing grows as `1 / (1 - α)` and explodes near 1. Libraries rehash into a table about twice as big when `α` crosses a threshold (0.75 in Java's `HashMap`), re-inserting all keys — O(n) once, amortised O(1) per insert.
```

```question
Why can't you just empty a slot when deleting from an open-addressing table?

---

Searches stop at the first empty slot. Keys that were inserted <em>past</em> the deleted slot (because it was occupied at the time) would no longer be reachable. A DELETED tombstone keeps searches going while letting inserts reuse the slot. Too many tombstones slow down searches, so tables rehash when live + deleted slots get numerous.
```

```question
Chaining or open addressing — which would you choose?

---

Chaining when deletions are frequent, the load is unpredictable or the hash function is mediocre: it never fills and degrades gracefully. Open addressing when memory locality matters and keys are small (ints): it avoids pointer chasing and allocation, which is why high-performance tables (Google's SwissTable, Python's `dict`) use open addressing with careful probing.
```

```question
Why should the table size be prime for modulo hashing?

---

`key % m` with `m = 2^k` keeps only the low `k` bits of the key, so keys differing only in higher bits collide. Keys that are multiples of a common factor of `m` land in a fraction of the slots. A prime `m` shares no factors with typical key patterns and spreads them over all slots.
```
