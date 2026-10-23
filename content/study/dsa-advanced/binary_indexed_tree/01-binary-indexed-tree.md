---
id: 5ce2b61d-cfb6-78a5-af97-c1ee4bb9d50d
key: topic:dsa-advanced/binary_indexed_tree
subject: dsa-advanced
topic: binary_indexed_tree
title: Binary Indexed Tree
slug: binary-indexed-tree
order: 1
---

A binary indexed tree (Fenwick tree) supports <strong>prefix queries</strong> and <strong>point updates</strong> over a fixed-size array in `O(log n)` each, using a single array of `n + 1` integers and a handful of lines of code. It is the lightweight alternative to a segment tree for sums, counts and XORs.

> [!INFO]
>
> <strong>Binary indexed tree (BIT, Fenwick tree)</strong> — an array `BIT[1..n]` in which `BIT[i]` stores the sum of the `i & −i` elements of the input ending at position `i` (1-based). Prefix sums and updates both walk `O(log n)` entries by repeatedly clearing or adding the lowest set bit of the index.

It is used for a fixed input array with many operations of two kinds: a <strong>prefix operation</strong> — sum, product, XOR, OR, count — and <strong>updating a value</strong>. It is stored as a plain array, but the idea behind the indices is a tree. It needs `O(n log n)` preprocessing (`O(n)` with a trick) and `Θ(n)` auxiliary space.

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 30, 40, 50, 60]; getSum(2); getSum(4)`<br><strong>Output:</strong> `60 150`<br><strong>Input:</strong> `update(2, 35); getSum(2); getSum(4)`<br><strong>Output:</strong> `65 155`

`rangeSum(i, j) = prefixSum(j) − prefixSum(i − 1)`

# Three approaches to prefix sum + update

`getSum(i)` returns `arr[0] + … + arr[i]`; `update(i, x)` sets `arr[i] = x`. Both operations are frequent and interleaved.

| Method | `getSum(i)` | `update(i, x)` | Space | Code |
| --- | --- | --- | --- | --- |
| <strong>1 — simple</strong>: loop from `0` to `i` | O(n) | O(1) — `arr[i] = x` | O(1) | trivial |
| <strong>2 — prefix-sum array</strong>: `pre[i]` | O(1) | O(n) — add `diff` to `pre[i..n−1]` | O(n) | trivial |
| <strong>3 — segment tree</strong> | O(log n) | O(log n) | ≈ 4n | three recursive functions |
| <strong>Binary indexed tree</strong> | O(log n) | O(log n) | n + 1 | <strong>two short loops</strong> |

Methods 1 and 2 each make one operation linear; with a mixed workload the average cost is `O(n)` per operation. The segment tree fixes that but is a comparatively heavy piece of code. The BIT gets the same `O(log n)` for both operations with less memory and about ten lines.

> [!NOTE] Limitation
>
> Unlike a segment tree, a BIT works only for operations that have an <strong>inverse</strong>: `rangeSum(i, j) = getSum(j) − getSum(i−1)` needs subtraction. Prefix <em>min</em> or <em>max</em> cannot be undone, so range-min queries need a segment tree.

# The idea: every prefix is a sum of powers of two

Any positive integer is a sum of distinct powers of two: `14 = 8 + 4 + 2`. So a prefix of length `14` can be split into three blocks of lengths `8`, `4` and `2`, and if the sum of each block is pre-computed, `getSum` needs three additions instead of fourteen. The BIT stores exactly these blocks: entry `i` (1-based) is responsible for the <strong>last </strong><strong>`i & −i`</strong><strong> elements ending at </strong><strong>`i`</strong>.

```text filename:Each%20BIT%20entry%20covers%20a%20block%20whose%20length%20is%20the%20lowest%20set%20bit%20of%20its%20index%3B%20a%20query%20adds%20up%20the%20blocks%20on%20the%20path%20to%20the%20root
arr (0-based):  10   20   30   40   50   60
BIT index i  :   1    2    3    4    5    6
i & -i       :   1    2    1    4    1    2
covers       :  [1] [1,2] [3] [1..4] [5] [5,6]
BIT[i]       :  10   30   30   100   50  110

              0 (virtual root)
        ┌─────┼──────────┐
        1     2          4           parent of i for queries = i − (i & −i)
              │        ┌─┴─┐
              3        5   6

getSum(4) → arr[0..4] → i = 5:  BIT[5] + BIT[4] = 50 + 100 = 150
```

# The i &amp; -i trick: isolating the lowest set bit

`−i` in two's complement is `~i + 1`: flip every bit, then add one. Flipping turns the trailing zeros of `i` into ones and the lowest `1` into `0`; adding one carries through those ones and stops exactly at that position. The result shares only that one bit with `i`, so `i & −i` is the lowest set bit as a power of two.

```text filename:i%20%26%20%E2%88%92i%20for%20i%20%3D%206%20and%20i%20%3D%2012
 i = 6  :  0 1 1 0
~i      :  1 0 0 1
-i = ~i+1: 1 0 1 0
 i & -i :  0 0 1 0   = 2        6 → block of length 2 ([5, 6]);  6 − 2 = 4 is the next block

 i = 12 :  1 1 0 0
-i      :  0 1 0 0
 i & -i :  0 1 0 0   = 4        12 → block of length 4 ([9..12]); 12 − 4 = 8 is the next block
```

```python filename:Python
for i in range(1, 9):
    print(f"{i}  {i:04b}  lowest set bit = {i & -i}")
```

```text filename:Output
1  0001  lowest set bit = 1
2  0010  lowest set bit = 2
3  0011  lowest set bit = 1
4  0100  lowest set bit = 4
5  0101  lowest set bit = 1
6  0110  lowest set bit = 2
7  0111  lowest set bit = 1
8  1000  lowest set bit = 8
```

| Expression | Effect | Used by |
| --- | --- | --- |
| `i -= i & -i` | clear the lowest set bit → jump to the parent block | `getSum` (walk towards 0) |
| `i += i & -i` | add the lowest set bit → jump to the next entry whose block contains `i` | `update` (walk towards n) |

# getSum: prefix sum

To get the sum of `arr[0..i]`, convert to the 1-based BIT index `i + 1` and keep adding `BIT[i]` while clearing the lowest set bit. Every step removes one `1` bit, so there are at most `log₂ n` steps.

```text filename:Prefix%20sum%20walks%20from%20i%20towards%200
getSum(i):
    i = i + 1                     # BIT is 1-based
    result = 0
    while i > 0:
        result += BIT[i]
        i -= i & -i               # parent(i): drop the lowest set bit
    return result

result = BIT[i] + BIT[parent(i)] + BIT[parent(parent(i))] + …
```

> [!TIP] Example
>
> `getSum(4)`: `i = 5 (101)` → add `BIT[5] = 50`, `i = 4 (100)` → add `BIT[4] = 100`, `i = 0` → stop. Result `150`.

# update: change one value

The first parameter is an index of `arr`. Compute `diff = x − arr[i]`, store the new value, convert to the 1-based index and add `diff` to every BIT entry whose block contains `i` — these are reached by <strong>adding</strong> the lowest set bit each time until the index exceeds `n`.

```text filename:Update%20walks%20from%20i%20towards%20n
update(i, x):
    diff = x - arr[i]
    arr[i] = x
    i = i + 1
    while i <= n:
        BIT[i] += diff
        i += i & -i               # next entry whose block includes position i

update(2, 35) with n = 6: diff = +5
    i = 3 (011) → BIT[3] += 5        covers [3]
    i = 4 (100) → BIT[4] += 5        covers [1..4]
    i = 8        > 6 → stop          (BIT[5], BIT[6] cover [5], [5,6] — unaffected)
```

# Construction and the complete program

> [!NOTE] Idea
>
> Build the BIT by starting from all zeros and calling `update(i, arr[i])` for every element — `n` updates of `O(log n)` each. The program below builds the tree for `[10, 20, 30, 40, 50, 60]`, answers prefix and range sums, performs an update and queries again.

```python filename:Python
class FenwickTree:
    def __init__(self, arr):
        self.n = len(arr)
        self.arr = [0] * self.n                  # current values, needed to compute diff
        self.bit = [0] * (self.n + 1)            # 1-based
        for i, v in enumerate(arr):
            self.update(i, v)                    # construction = n updates

    def get_sum(self, i):                        # sum of arr[0..i]
        i += 1
        res = 0
        while i > 0:
            res += self.bit[i]
            i -= i & -i                          # drop the lowest set bit → parent block
        return res

    def range_sum(self, l, r):
        return self.get_sum(r) - (self.get_sum(l - 1) if l > 0 else 0)

    def update(self, i, x):                      # set arr[i] = x
        diff = x - self.arr[i]
        self.arr[i] = x
        i += 1
        while i <= self.n:
            self.bit[i] += diff
            i += i & -i                          # next block that contains position i

ft = FenwickTree([10, 20, 30, 40, 50, 60])
print("BIT:", " ".join(map(str, ft.bit[1:])))
print("getSum(2):", ft.get_sum(2))
print("getSum(4):", ft.get_sum(4))
print("rangeSum(1, 4):", ft.range_sum(1, 4))
print("update(2, 35)")
ft.update(2, 35)
print("BIT:", " ".join(map(str, ft.bit[1:])))
print("getSum(2):", ft.get_sum(2))
print("getSum(4):", ft.get_sum(4))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

class FenwickTree {
    int n;
    vector<int> arr, bit;                        // arr = current values, bit = 1-based tree
public:
    FenwickTree(const vector<int>& a) : n(a.size()), arr(n, 0), bit(n + 1, 0) {
        for (int i = 0; i < n; i++) update(i, a[i]);   // construction = n updates
    }
    int getSum(int i) const {                    // sum of arr[0..i]
        int res = 0;
        for (i = i + 1; i > 0; i -= i & -i)      // drop the lowest set bit → parent block
            res += bit[i];
        return res;
    }
    int rangeSum(int l, int r) const { return getSum(r) - (l > 0 ? getSum(l - 1) : 0); }
    void update(int i, int x) {                  // set arr[i] = x
        int diff = x - arr[i];
        arr[i] = x;
        for (i = i + 1; i <= n; i += i & -i)     // next block that contains position i
            bit[i] += diff;
    }
    void print() const { cout << "BIT:"; for (int i = 1; i <= n; i++) cout << " " << bit[i]; cout << "\n"; }
};

int main() {
    FenwickTree ft({10, 20, 30, 40, 50, 60});
    ft.print();
    cout << "getSum(2): " << ft.getSum(2) << "\n";
    cout << "getSum(4): " << ft.getSum(4) << "\n";
    cout << "rangeSum(1, 4): " << ft.rangeSum(1, 4) << "\n";
    cout << "update(2, 35)\n";
    ft.update(2, 35);
    ft.print();
    cout << "getSum(2): " << ft.getSum(2) << "\n";
    cout << "getSum(4): " << ft.getSum(4) << "\n";
}
```

```java filename:Java
public class Main {
    static class FenwickTree {
        int n;
        int[] arr, bit;                          // arr = current values, bit = 1-based tree
        FenwickTree(int[] a) {
            n = a.length; arr = new int[n]; bit = new int[n + 1];
            for (int i = 0; i < n; i++) update(i, a[i]);   // construction = n updates
        }
        int getSum(int i) {                      // sum of arr[0..i]
            int res = 0;
            for (i = i + 1; i > 0; i -= i & -i)  // drop the lowest set bit → parent block
                res += bit[i];
            return res;
        }
        int rangeSum(int l, int r) { return getSum(r) - (l > 0 ? getSum(l - 1) : 0); }
        void update(int i, int x) {              // set arr[i] = x
            int diff = x - arr[i];
            arr[i] = x;
            for (i = i + 1; i <= n; i += i & -i) // next block that contains position i
                bit[i] += diff;
        }
        String dump() { StringBuilder sb = new StringBuilder("BIT:"); for (int i = 1; i <= n; i++) sb.append(' ').append(bit[i]); return sb.toString(); }
    }

    public static void main(String[] args) {
        FenwickTree ft = new FenwickTree(new int[]{10, 20, 30, 40, 50, 60});
        System.out.println(ft.dump());
        System.out.println("getSum(2): " + ft.getSum(2));
        System.out.println("getSum(4): " + ft.getSum(4));
        System.out.println("rangeSum(1, 4): " + ft.rangeSum(1, 4));
        System.out.println("update(2, 35)");
        ft.update(2, 35);
        System.out.println(ft.dump());
        System.out.println("getSum(2): " + ft.getSum(2));
        System.out.println("getSum(4): " + ft.getSum(4));
    }
}
```

```javascript filename:JavaScript
class FenwickTree {
    constructor(a) {
        this.n = a.length;
        this.arr = new Array(this.n).fill(0);        // current values, needed to compute diff
        this.bit = new Array(this.n + 1).fill(0);    // 1-based
        a.forEach((v, i) => this.update(i, v));      // construction = n updates
    }
    getSum(i) {                                      // sum of arr[0..i]
        let res = 0;
        for (i = i + 1; i > 0; i -= i & -i) res += this.bit[i];   // drop the lowest set bit → parent block
        return res;
    }
    rangeSum(l, r) { return this.getSum(r) - (l > 0 ? this.getSum(l - 1) : 0); }
    update(i, x) {                                   // set arr[i] = x
        const diff = x - this.arr[i];
        this.arr[i] = x;
        for (i = i + 1; i <= this.n; i += i & -i) this.bit[i] += diff;   // next block that contains position i
    }
}

const ft = new FenwickTree([10, 20, 30, 40, 50, 60]);
console.log("BIT:", ft.bit.slice(1).join(" "));
console.log("getSum(2):", ft.getSum(2));
console.log("getSum(4):", ft.getSum(4));
console.log("rangeSum(1, 4):", ft.rangeSum(1, 4));
console.log("update(2, 35)");
ft.update(2, 35);
console.log("BIT:", ft.bit.slice(1).join(" "));
console.log("getSum(2):", ft.getSum(2));
console.log("getSum(4):", ft.getSum(4));
```

```text filename:Output
BIT: 10 30 30 100 50 110
getSum(2): 60
getSum(4): 150
rangeSum(1, 4): 140
update(2, 35)
BIT: 10 30 35 105 50 110
getSum(2): 65
getSum(4): 155
```

Time O(log n) per getSum / update; O(n log n) construction · Space O(n)

> [!NOTE] Linear construction
>
> Construction can be `O(n)`: copy `arr` into `BIT[1..n]`, then for `i = 1..n` add `BIT[i]` into `BIT[i + (i & −i)]` if that index is `≤ n`. Every entry pushes its total to the one parent block that contains it — one pass, no logarithm.

> [!WARNING] Pitfall
>
> Two off-by-one traps: the BIT is <strong>1-based</strong> (so `arr[i]` lives at `i + 1`, and `BIT[0]` is never used), and `update` must use the <strong>difference</strong> against the stored `arr[i]`, not the new value — unless you are <em>adding</em> to an element rather than <em>setting</em> it, in which case the diff is the amount added and no `arr` copy is needed.

# Interview Q&amp;A

```question
Explain i &amp; -i.

---

In two's complement `−i = ~i + 1`. Negating flips all bits, and the `+1` carries through the trailing ones, stopping at the position of `i`'s lowest set bit. That bit is the only one set in both `i` and `−i`, so `i & −i` is exactly the lowest set bit (a power of two). In a BIT it is the length of the block entry `i` is responsible for.
```

```question
Why is getSum O(log n)?

---

Every iteration clears one set bit of the index (`i -= i & -i`). A number below `n` has at most `⌊log₂ n⌋ + 1` set bits, so the loop runs that many times at most. `update` is symmetric: `i += i & -i` increases the position of the lowest set bit each time, so it also takes `O(log n)` steps to exceed `n`.
```

```question
BIT vs segment tree?

---

Same `O(log n)` for point update and prefix/range query. BIT: `n + 1` memory, \~10 lines, faster constants; but only for <strong>invertible</strong> operations (sum, XOR, count) and point updates. Segment tree: any associative operation (min, max, gcd), range updates via lazy propagation, ≈ `4n` memory, more code.
```

```question
How do you do a range update + point query with a BIT?

---

Store the <strong>differences</strong>: to add `v` to `[l, r]` do `add(l, v)` and `add(r + 1, −v)`; a point query at `i` is then `prefixSum(i)`. Range update + range query needs two BITs. Both tricks rely on the sum being invertible.
```

```question
Name two classic BIT applications beyond prefix sums.

---

<strong>Counting inversions</strong> in `O(n log n)`: scan left to right and query how many previously seen values are greater. <strong>Order statistics / k-th smallest</strong> among the inserted values with a binary search over the BIT (`O(log² n)` or `O(log n)` with bit-walking). Both treat the BIT as a dynamic frequency table.
```
