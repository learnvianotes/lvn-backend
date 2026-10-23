---
id: 67e3748e-ea47-7c76-ba74-4173c9888dd3
key: topic:dsa-basics/set
subject: dsa-basics
topic: set
title: Set
slug: set
order: 1
---

A set stores <strong>distinct</strong> elements with no order and no index, and answers <em>is </em><em>`x`</em><em> present?</em> in O(1) on average. It is a hash table that stores keys only — the right structure for de-duplication, membership tests and set algebra.

> [!INFO]
>
> <strong>Hash set</strong> — a collection of unique elements implemented with a hash table. Each element is hashed to a slot; adding an existing element does nothing, so duplicates can never appear. Python `set`, C++ `unordered_set`, Java `HashSet`, JavaScript `Set`.

```text filename:A%20hash%20set%20is%20a%20hash%20table%20whose%20slots%20hold%20just%20the%20keys
add(10), add(20), add(30), add(20)  with  h(x) = x % 4

slot 0 │ 20 │       ← the second add(20) finds 20 already here and does nothing
slot 1 │    │
slot 2 │ 10 │──▶│ 30 │
slot 3 │    │

size = 3, iteration order follows the slots, not the insertion order
```

# Properties of a set

> [!NOTE] Distinct elements
>
> Adding an element that is already present is a no-op. `{1, 1, 2}` has size 2.

> [!NOTE] Unordered
>
> Elements are stored by hash slot; iteration order is not insertion order and may change after a rehash.

> [!NOTE] No indexing
>
> There is no `s[0]` — use membership tests and iteration instead.

> [!NOTE] Fast set algebra
>
> Union, intersection and difference run in time linear in the sizes of the sets.

> [!NOTE] Hashing internally
>
> Every operation is a hash lookup — O(1) average, O(n) worst case.

> [!NOTE] Hashable elements only
>
> Elements must be immutable / have a stable hash: numbers, strings, tuples — not Python lists or dicts.

| Operation | Python | Average | Why |
| --- | --- | --- | --- |
| add | `s.add(x)` | O(1) | Hash `x`, place it in its slot if absent |
| remove | `s.remove(x)` (error if missing) / `s.discard(x)` (silent) | O(1) | Hash `x`, unlink it from its slot |
| membership | `x in s` | O(1) | Hash `x`, compare with the keys in that slot only |
| size | `len(s)` | O(1) | A counter maintained on add/remove |
| union / intersection / difference | `a &#124; b`, `a & b`, `a - b`, `a ^ b` | O(len(a) + len(b)) | Iterate one set, test membership in the other |
| subset / superset / disjoint | `a <= b`, `a >= b`, `a.isdisjoint(b)` | O(min(len(a), len(b))) | Test every element of the smaller set against the other |
| iterate | `for x in s` | O(n) | Walk every slot |

# Set containers in the four languages

| Language | Hash set (unordered, O(1) avg) | Ordered set (sorted, O(log n)) |
| --- | --- | --- |
| Python | `set`, immutable `frozenset` | — (use `sorted(s)` when needed, or `bisect` on a list) |
| C++ | `std::unordered_set` | `std::set` (red-black tree) |
| Java | `HashSet`; `LinkedHashSet` keeps insertion order | `TreeSet` (red-black tree) |
| JavaScript | `Set` (keeps insertion order by specification) | — (sort an array) |

> [!NOTE] Key point
>
> Choose the <strong>hash</strong> version by default. Switch to the <strong>ordered</strong> version only when you need sorted iteration, `min`/`max`, floor/ceiling or range queries — those cost O(log n) per operation instead of O(1).

# Creating a set and adding elements

A set is built from a literal or from any iterable (duplicates are dropped on the way in). Elements are added one at a time or in bulk. Because iteration order differs between languages, the programs below <strong>sort</strong> before printing.

```python filename:Python
def show(label, s):
    print(label + ":", *sorted(s))

s2 = set([1, 2, 3, 4, 1, 2, 3, 4])        # duplicates dropped
show("from list with duplicates", s2)
print("size:", len(s2))

s = {10, 20}                                # a set literal
s.add(30)                                   # one element
show("after add 30", s)
s.update([40, 50])                          # any iterable
s.update([60, 70], {80, 90})                # several at once
show("after bulk add", s)
print("size:", len(s))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;

void show(const string& label, const unordered_set<int>& s) {
    vector<int> v(s.begin(), s.end());
    sort(v.begin(), v.end());
    cout << label << ":";
    for (int x : v) cout << " " << x;
    cout << "\n";
}

int main() {
    vector<int> data = {1, 2, 3, 4, 1, 2, 3, 4};
    unordered_set<int> s2(data.begin(), data.end());   // duplicates dropped
    show("from list with duplicates", s2);
    cout << "size: " << s2.size() << "\n";

    unordered_set<int> s = {10, 20};
    s.insert(30);                                       // one element
    show("after add 30", s);
    s.insert({40, 50});                                 // several at once
    for (int x : {60, 70, 80, 90}) s.insert(x);
    show("after bulk add", s);
    cout << "size: " << s.size() << "\n";
}
```

```java filename:Java
import java.util.*;

public class Main {
    static void show(String label, Set<Integer> s) {
        StringBuilder sb = new StringBuilder(label + ":");
        for (int x : new TreeSet<>(s)) sb.append(" ").append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Set<Integer> s2 = new HashSet<>(List.of(1, 2, 3, 4, 1, 2, 3, 4));   // duplicates dropped
        show("from list with duplicates", s2);
        System.out.println("size: " + s2.size());

        Set<Integer> s = new HashSet<>(List.of(10, 20));
        s.add(30);                                   // one element
        show("after add 30", s);
        s.addAll(List.of(40, 50));                   // any collection
        s.addAll(List.of(60, 70, 80, 90));
        show("after bulk add", s);
        System.out.println("size: " + s.size());
    }
}
```

```javascript filename:JavaScript
const show = (label, s) => console.log(label + ":", [...s].sort((a, b) => a - b).join(" "));

const s2 = new Set([1, 2, 3, 4, 1, 2, 3, 4]);   // duplicates dropped
show("from list with duplicates", s2);
console.log("size:", s2.size);

const s = new Set([10, 20]);
s.add(30);                                      // one element
show("after add 30", s);
for (const x of [40, 50]) s.add(x);             // no bulk add — loop
for (const x of [60, 70, 80, 90]) s.add(x);
show("after bulk add", s);
console.log("size:", s.size);
```

```text filename:Output
from list with duplicates: 1 2 3 4
size: 4
after add 30: 10 20 30
after bulk add: 10 20 30 40 50 60 70 80 90
size: 9
```

Time O(1) average per add · Space O(n)

> [!WARNING] Pitfall
>
> In Python `s = {}` creates an empty <strong>dict</strong>, not a set — `type({})` is `dict`. The only way to write an empty set is `set()`. Set literals with elements (`{1, 2}`) are fine.

# Removing elements

Python offers two ways to remove: `discard(x)` silently ignores a missing element, `remove(x)` raises `KeyError`. C++ `erase`, Java `remove` and JavaScript `delete` behave like `discard` and report whether anything was removed. `clear()` empties the set in every language.

```python filename:Python
def show(label, s):
    print(label + ":", *sorted(s))

s = {10, 20, 30}
s.discard(30)                               # silent if missing
show("after discard 30", s)
removed = 20 in s
s.remove(20)                                # KeyError if missing
print("removed 20:", "true" if removed else "false")
show("after remove 20", s)
removed = 99 in s
s.discard(99)
print("removed 99:", "true" if removed else "false")
s.clear()
print("after clear, size:", len(s))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;

void show(const string& label, const unordered_set<int>& s) {
    vector<int> v(s.begin(), s.end());
    sort(v.begin(), v.end());
    cout << label << ":";
    for (int x : v) cout << " " << x;
    cout << "\n";
}

int main() {
    unordered_set<int> s = {10, 20, 30};
    s.erase(30);                                        // returns number erased (0 or 1)
    show("after discard 30", s);
    cout << "removed 20: " << (s.erase(20) ? "true" : "false") << "\n";
    show("after remove 20", s);
    cout << "removed 99: " << (s.erase(99) ? "true" : "false") << "\n";
    s.clear();
    cout << "after clear, size: " << s.size() << "\n";
}
```

```java filename:Java
import java.util.*;

public class Main {
    static void show(String label, Set<Integer> s) {
        StringBuilder sb = new StringBuilder(label + ":");
        for (int x : new TreeSet<>(s)) sb.append(" ").append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Set<Integer> s = new HashSet<>(List.of(10, 20, 30));
        s.remove(30);                                // returns boolean, no exception
        show("after discard 30", s);
        System.out.println("removed 20: " + s.remove(20));
        show("after remove 20", s);
        System.out.println("removed 99: " + s.remove(99));
        s.clear();
        System.out.println("after clear, size: " + s.size());
    }
}
```

```javascript filename:JavaScript
const show = (label, s) => console.log(label + ":", [...s].sort((a, b) => a - b).join(" "));

const s = new Set([10, 20, 30]);
s.delete(30);                                   // returns boolean, no exception
show("after discard 30", s);
console.log("removed 20:", s.delete(20));
show("after remove 20", s);
console.log("removed 99:", s.delete(99));
s.clear();
console.log("after clear, size:", s.size);
```

```text filename:Output
after discard 30: 10 20
removed 20: true
after remove 20: 10
removed 99: false
after clear, size: 0
```

Time O(1) average per removal · Space O(1)

# Membership and aggregates

`x in s` is the operation sets exist for: hash `x`, look in one slot. The aggregates `len`, `max`, `min`, `sum` are ordinary iterations — O(1) for `len` (a stored counter) and O(n) for the rest, because a hash set keeps no order.

```python filename:Python
s = {10, 20, 30, 40}
print("size:", len(s))                     # O(1)
print("max:", max(s))                      # O(n) — a hash set is not sorted
print("min:", min(s))
print("sum:", sum(s))
print("20 in s:", "true" if 20 in s else "false")   # O(1) average
print("50 in s:", "true" if 50 in s else "false")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
#include <algorithm>
#include <numeric>
using namespace std;

int main() {
    unordered_set<int> s = {10, 20, 30, 40};
    cout << "size: " << s.size() << "\n";                       // O(1)
    cout << "max: " << *max_element(s.begin(), s.end()) << "\n";   // O(n) — not sorted
    cout << "min: " << *min_element(s.begin(), s.end()) << "\n";
    cout << "sum: " << accumulate(s.begin(), s.end(), 0) << "\n";
    cout << "20 in s: " << (s.count(20) ? "true" : "false") << "\n";   // O(1) average
    cout << "50 in s: " << (s.contains(50) ? "true" : "false") << "\n"; // C++20
}
```

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Set<Integer> s = new HashSet<>(List.of(10, 20, 30, 40));
        System.out.println("size: " + s.size());                      // O(1)
        System.out.println("max: " + Collections.max(s));             // O(n) — not sorted
        System.out.println("min: " + Collections.min(s));
        int sum = 0;
        for (int x : s) sum += x;
        System.out.println("sum: " + sum);
        System.out.println("20 in s: " + s.contains(20));             // O(1) average
        System.out.println("50 in s: " + s.contains(50));
    }
}
```

```javascript filename:JavaScript
const s = new Set([10, 20, 30, 40]);
console.log("size:", s.size);                       // O(1)
console.log("max:", Math.max(...s));                // O(n) — not sorted
console.log("min:", Math.min(...s));
console.log("sum:", [...s].reduce((a, b) => a + b, 0));
console.log("20 in s:", s.has(20));                 // O(1) average
console.log("50 in s:", s.has(50));
```

```text filename:Output
size: 4
max: 40
min: 10
sum: 100
20 in s: true
50 in s: false
```

Time O(1) membership, O(n) aggregates · Space O(1)

> [!TIP] Do
>
> Replace `x in some_list` (O(n) scan) by `x in some_set` (O(1)) whenever the same collection is tested many times — the single most common hashing speed-up in interview solutions.

# Set algebra: union, intersection, difference

```text filename:The%20four%20set%20operations%20on%20two%20sets%20that%20share%20one%20element
s1 = {10, 20, 30}      s2 = {30, 40, 50}

union          s1 | s2   = {10, 20, 30, 40, 50}   everything in either
intersection   s1 & s2   = {30}                   only what is in both
difference     s1 - s2   = {10, 20}               in s1 but not in s2
symmetric diff s1 ^ s2   = {10, 20, 40, 50}       in exactly one of them
```

Each operation iterates one set and tests membership in the other, so it costs O(|s1| + |s2|). Python has operators and named methods (`s1.union(s2)`); C++ needs a loop (or `std::set_union` on <strong>sorted</strong> containers); Java uses the mutating `addAll` / `retainAll` / `removeAll` on a copy; JavaScript gained `union`, `intersection`, `difference` and `symmetricDifference` methods on `Set` in ES2025 (Node 22+).

```python filename:Python
def show(label, s):
    print(label + ":", *sorted(s))

s1 = {10, 20, 30}
s2 = {30, 40, 50}
show("union", s1 | s2)                      # also s1.union(s2)
show("intersection", s1 & s2)               # s1.intersection(s2)
show("difference", s1 - s2)                 # s1.difference(s2)
show("symmetric difference", s1 ^ s2)       # s1.symmetric_difference(s2)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;
using Set = unordered_set<int>;

void show(const string& label, const Set& s) {
    vector<int> v(s.begin(), s.end());
    sort(v.begin(), v.end());
    cout << label << ":";
    for (int x : v) cout << " " << x;
    cout << "\n";
}

Set unionOf(const Set& a, const Set& b) { Set r = a; r.insert(b.begin(), b.end()); return r; }
Set intersection(const Set& a, const Set& b) {
    Set r;
    for (int x : a) if (b.count(x)) r.insert(x);     // in both
    return r;
}
Set difference(const Set& a, const Set& b) {
    Set r;
    for (int x : a) if (!b.count(x)) r.insert(x);    // in a, not in b
    return r;
}
Set symmetricDifference(const Set& a, const Set& b) {
    return unionOf(difference(a, b), difference(b, a));
}

int main() {
    Set s1 = {10, 20, 30}, s2 = {30, 40, 50};
    show("union", unionOf(s1, s2));
    show("intersection", intersection(s1, s2));
    show("difference", difference(s1, s2));
    show("symmetric difference", symmetricDifference(s1, s2));
}
```

```java filename:Java
import java.util.*;

public class Main {
    static void show(String label, Set<Integer> s) {
        StringBuilder sb = new StringBuilder(label + ":");
        for (int x : new TreeSet<>(s)) sb.append(" ").append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        Set<Integer> s1 = Set.of(10, 20, 30), s2 = Set.of(30, 40, 50);

        Set<Integer> union = new HashSet<>(s1); union.addAll(s2);
        Set<Integer> inter = new HashSet<>(s1); inter.retainAll(s2);      // keep only what is in s2
        Set<Integer> diff = new HashSet<>(s1); diff.removeAll(s2);        // drop what is in s2
        Set<Integer> sym = new HashSet<>(union); sym.removeAll(inter);    // union minus intersection

        show("union", union);
        show("intersection", inter);
        show("difference", diff);
        show("symmetric difference", sym);
    }
}
```

```javascript filename:JavaScript
const show = (label, s) => console.log(label + ":", [...s].sort((a, b) => a - b).join(" "));

const s1 = new Set([10, 20, 30]);
const s2 = new Set([30, 40, 50]);
show("union", s1.union(s2));                            // ES2025 Set methods
show("intersection", s1.intersection(s2));
show("difference", s1.difference(s2));
show("symmetric difference", s1.symmetricDifference(s2));
```

```text filename:Output
union: 10 20 30 40 50
intersection: 30
difference: 10 20
symmetric difference: 10 20 40 50
```

Time O(|s1| + |s2|) · Space O(|s1| + |s2|)

> [!NOTE] Key point
>
> The mutating forms update a set in place: Python `s1 |= s2`, `s1 &= s2`, `s1 -= s2` (or `update`, `intersection_update`, `difference_update`); Java's `addAll` / `retainAll` / `removeAll` are <em>only</em> mutating, which is why the sample copies first.

# Subset, superset and disjoint tests

| Test | Meaning | Python | Cost |
| --- | --- | --- | --- |
| `a.isdisjoint(b)` | No common element | `a.isdisjoint(b)` | O(min(\|a\|, \|b\|)) |
| `a <= b` | Every element of `a` is in `b` (subset, possibly equal) | `a.issubset(b)` | O(\|a\|) |
| `a < b` | Subset <strong>and</strong> `a != b` (proper subset) | `a < b` | O(\|a\|) |
| `a >= b` | `a` contains every element of `b` (superset) | `a.issuperset(b)` | O(\|b\|) |
| `a > b` | Proper superset | `a > b` | O(\|b\|) |

```python filename:Python
def b(x): return "true" if x else "false"

s1 = {10, 20}
s2 = {40, 30, 50}
print("s1 disjoint s2:", b(s1.isdisjoint(s2)))   # no common element
print("s2 disjoint s1:", b(s2.isdisjoint(s1)))
print("s1 disjoint s1:", b(s1.isdisjoint(s1)))   # a non-empty set shares everything with itself
print("s1 <= s2:", b(s1 <= s2))                   # subset
print("s1 < s2:", b(s1 < s2))                     # proper subset
print("s1 >= s2:", b(s1 >= s2))                   # superset
print("s1 > s2:", b(s1 > s2))                     # proper superset
print("{10} <= s1:", b({10} <= s1))
print("{10} < s1:", b({10} < s1))
print("s1 <= s1:", b(s1 <= s1))                   # a set is a subset of itself …
print("s1 < s1:", b(s1 < s1))                     # … but not a proper one
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
using namespace std;
using Set = unordered_set<int>;

bool isDisjoint(const Set& a, const Set& b) {
    const Set& small = a.size() < b.size() ? a : b;
    const Set& big = a.size() < b.size() ? b : a;
    for (int x : small) if (big.count(x)) return false;
    return true;
}
bool isSubset(const Set& a, const Set& b) {          // a ⊆ b
    if (a.size() > b.size()) return false;
    for (int x : a) if (!b.count(x)) return false;
    return true;
}
bool isProperSubset(const Set& a, const Set& b) { return a.size() < b.size() && isSubset(a, b); }
const char* B(bool x) { return x ? "true" : "false"; }

int main() {
    Set s1 = {10, 20}, s2 = {40, 30, 50}, one = {10};
    cout << "s1 disjoint s2: " << B(isDisjoint(s1, s2)) << "\n";
    cout << "s2 disjoint s1: " << B(isDisjoint(s2, s1)) << "\n";
    cout << "s1 disjoint s1: " << B(isDisjoint(s1, s1)) << "\n";
    cout << "s1 <= s2: " << B(isSubset(s1, s2)) << "\n";
    cout << "s1 < s2: " << B(isProperSubset(s1, s2)) << "\n";
    cout << "s1 >= s2: " << B(isSubset(s2, s1)) << "\n";
    cout << "s1 > s2: " << B(isProperSubset(s2, s1)) << "\n";
    cout << "{10} <= s1: " << B(isSubset(one, s1)) << "\n";
    cout << "{10} < s1: " << B(isProperSubset(one, s1)) << "\n";
    cout << "s1 <= s1: " << B(isSubset(s1, s1)) << "\n";
    cout << "s1 < s1: " << B(isProperSubset(s1, s1)) << "\n";
}
```

```java filename:Java
import java.util.*;

public class Main {
    static boolean isDisjoint(Set<Integer> a, Set<Integer> b) { return Collections.disjoint(a, b); }
    static boolean isSubset(Set<Integer> a, Set<Integer> b) { return b.containsAll(a); }     // a ⊆ b
    static boolean isProperSubset(Set<Integer> a, Set<Integer> b) { return a.size() < b.size() && b.containsAll(a); }

    public static void main(String[] args) {
        Set<Integer> s1 = Set.of(10, 20), s2 = Set.of(40, 30, 50), one = Set.of(10);
        System.out.println("s1 disjoint s2: " + isDisjoint(s1, s2));
        System.out.println("s2 disjoint s1: " + isDisjoint(s2, s1));
        System.out.println("s1 disjoint s1: " + isDisjoint(s1, s1));
        System.out.println("s1 <= s2: " + isSubset(s1, s2));
        System.out.println("s1 < s2: " + isProperSubset(s1, s2));
        System.out.println("s1 >= s2: " + isSubset(s2, s1));
        System.out.println("s1 > s2: " + isProperSubset(s2, s1));
        System.out.println("{10} <= s1: " + isSubset(one, s1));
        System.out.println("{10} < s1: " + isProperSubset(one, s1));
        System.out.println("s1 <= s1: " + isSubset(s1, s1));
        System.out.println("s1 < s1: " + isProperSubset(s1, s1));
    }
}
```

```javascript filename:JavaScript
const s1 = new Set([10, 20]);
const s2 = new Set([40, 30, 50]);
const one = new Set([10]);
const properSubset = (a, b) => a.size < b.size && a.isSubsetOf(b);

console.log("s1 disjoint s2:", s1.isDisjointFrom(s2));     // ES2025 Set methods
console.log("s2 disjoint s1:", s2.isDisjointFrom(s1));
console.log("s1 disjoint s1:", s1.isDisjointFrom(s1));
console.log("s1 <= s2:", s1.isSubsetOf(s2));
console.log("s1 < s2:", properSubset(s1, s2));
console.log("s1 >= s2:", s1.isSupersetOf(s2));
console.log("s1 > s2:", properSubset(s2, s1));
console.log("{10} <= s1:", one.isSubsetOf(s1));
console.log("{10} < s1:", properSubset(one, s1));
console.log("s1 <= s1:", s1.isSubsetOf(s1));
console.log("s1 < s1:", properSubset(s1, s1));
```

```text filename:Output
s1 disjoint s2: true
s2 disjoint s1: true
s1 disjoint s1: false
s1 <= s2: false
s1 < s2: false
s1 >= s2: false
s1 > s2: false
{10} <= s1: true
{10} < s1: true
s1 <= s1: true
s1 < s1: false
```

Time O(min(|a|, |b|)) · Space O(1)

> [!WARNING] Pitfall
>
> `<` and `>` on sets are <strong>not</strong> a total order: for `s1 = {10, 20}` and `s2 = {30, 40, 50}` every one of `s1 < s2`, `s1 > s2` and `s1 == s2` is false. Never sort a list of sets with these operators.

# Iteration order

> [!WARNING] Watch out
>
> A hash set iterates in <strong>slot order</strong>, which depends on the hash values and the table size — it is not insertion order, not sorted order, and it can change after a rehash. Any program whose output depends on it is a bug waiting to happen.

| Container | Iteration order |
| --- | --- |
| Python `set` | Arbitrary (small ints often <em>look</em> sorted because `hash(i) == i` — do not rely on it); string hashes are randomised per process |
| C++ `unordered_set` | Arbitrary, implementation defined |
| Java `HashSet` | Arbitrary; `LinkedHashSet` = insertion order; `TreeSet` = sorted |
| JavaScript `Set` | <strong>Insertion order</strong>, guaranteed by the language specification |

> [!TIP] Do
>
> When the output must be reproducible, sort first (`sorted(s)`), or use an insertion-ordered container (`LinkedHashSet`, JS `Set`, Python `dict.fromkeys(items)`) when the original order is what you want.

# Typical uses

> [!NOTE] De-duplication
>
> `len(set(arr))` counts distinct values; `set(arr)` drops repeats in O(n) instead of O(n²).

> [!NOTE] Fast lookups
>
> Turn a list of allowed values / visited states / seen ids into a set and test membership in O(1).

> [!NOTE] Visited markers
>
> BFS/DFS on graphs store visited nodes in a set — see the Graph topics.

> [!NOTE] Pair problems
>
> Two-sum, pair with a given difference: scan once, test whether `target - x` has been <em>seen</em>.

> [!NOTE] Set algebra
>
> Common friends = intersection; who left = difference; symmetric difference = what changed.

> [!NOTE] Frequency counting
>
> Needs counts, not just presence — that is a dictionary (next topic).

# Problem: count distinct elements in an array

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 20, 10, 30]`<br><strong>Output:</strong> `3`<br><strong>Input:</strong> `arr = [5, 5, 5]`<br><strong>Output:</strong> `1`

> [!NOTE] Idea
>
> Insert every element into a set; duplicates vanish automatically, so the set's size is the number of distinct values. One pass, O(1) average per insert.

```python filename:Python
def count_distinct(arr):
    return len(set(arr))                  # duplicates collapse on insert

for arr in ([10, 20, 20, 10, 30], [5, 5, 5], [1, 2, 3, 4]):
    print(*arr, "→", count_distinct(arr), "distinct")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <unordered_set>
using namespace std;

int countDistinct(const vector<int>& arr) {
    unordered_set<int> seen(arr.begin(), arr.end());   // duplicates collapse on insert
    return (int)seen.size();
}

int main() {
    vector<vector<int>> tests = {{10, 20, 20, 10, 30}, {5, 5, 5}, {1, 2, 3, 4}};
    for (const auto& arr : tests) {
        for (int x : arr) cout << x << " ";
        cout << "→ " << countDistinct(arr) << " distinct\n";
    }
}
```

```java filename:Java
import java.util.*;

public class Main {
    static int countDistinct(int[] arr) {
        Set<Integer> seen = new HashSet<>();
        for (int x : arr) seen.add(x);              // duplicates collapse on insert
        return seen.size();
    }

    public static void main(String[] args) {
        int[][] tests = {{10, 20, 20, 10, 30}, {5, 5, 5}, {1, 2, 3, 4}};
        for (int[] arr : tests) {
            StringBuilder sb = new StringBuilder();
            for (int x : arr) sb.append(x).append(" ");
            System.out.println(sb + "→ " + countDistinct(arr) + " distinct");
        }
    }
}
```

```javascript filename:JavaScript
const countDistinct = (arr) => new Set(arr).size;   // duplicates collapse on insert

for (const arr of [[10, 20, 20, 10, 30], [5, 5, 5], [1, 2, 3, 4]])
    console.log(arr.join(" "), "→", countDistinct(arr), "distinct");
```

```text filename:Output
10 20 20 10 30 → 3 distinct
5 5 5 → 1 distinct
1 2 3 4 → 4 distinct
```

Time O(n) average · Space O(n)

# Problem: do two arrays have a common element?

> [!TIP] Example
>
> <strong>Input:</strong> `a = [3, 8, 12, 5], b = [7, 1, 12]`<br><strong>Output:</strong> `Yes (12)`<br><strong>Input:</strong> `a = [1, 2], b = [3, 4]`<br><strong>Output:</strong> `No`

> [!NOTE] Idea
>
> Put the smaller array in a set, then scan the other array testing membership — O(n + m) instead of the O(n · m) nested loop. This is the intersection operation stopped at the first hit.

```python filename:Python
def common_element(a, b):
    seen = set(a)                          # O(len(a))
    for x in b:                            # O(len(b)) membership tests
        if x in seen:
            return x
    return None

for a, b in (([3, 8, 12, 5], [7, 1, 12]), ([1, 2], [3, 4])):
    found = common_element(a, b)
    result = f"Yes ({found})" if found is not None else "No"
    print(f"[{' '.join(map(str, a))}] and [{' '.join(map(str, b))}] →", result)
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <unordered_set>
#include <string>
using namespace std;

bool commonElement(const vector<int>& a, const vector<int>& b, int& found) {
    unordered_set<int> seen(a.begin(), a.end());   // O(len(a))
    for (int x : b)                                // O(len(b)) membership tests
        if (seen.count(x)) { found = x; return true; }
    return false;
}

string join(const vector<int>& v) {
    string s = "[";
    for (int i = 0; i < (int)v.size(); i++) s += (i ? " " : "") + to_string(v[i]);
    return s + "]";
}

int main() {
    vector<pair<vector<int>, vector<int>>> tests = {{{3, 8, 12, 5}, {7, 1, 12}}, {{1, 2}, {3, 4}}};
    for (auto& [a, b] : tests) {
        int found;
        bool ok = commonElement(a, b, found);
        cout << join(a) << " and " << join(b) << " → " << (ok ? "Yes (" + to_string(found) + ")" : "No") << "\n";
    }
}
```

```java filename:Java
import java.util.*;

public class Main {
    static Integer commonElement(int[] a, int[] b) {
        Set<Integer> seen = new HashSet<>();
        for (int x : a) seen.add(x);                   // O(len(a))
        for (int x : b) if (seen.contains(x)) return x; // O(len(b)) membership tests
        return null;
    }

    static String join(int[] v) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) sb.append(i > 0 ? " " : "").append(v[i]);
        return sb + "]";
    }

    public static void main(String[] args) {
        int[][][] tests = {{{3, 8, 12, 5}, {7, 1, 12}}, {{1, 2}, {3, 4}}};
        for (int[][] t : tests) {
            Integer found = commonElement(t[0], t[1]);
            System.out.println(join(t[0]) + " and " + join(t[1]) + " → " + (found != null ? "Yes (" + found + ")" : "No"));
        }
    }
}
```

```javascript filename:JavaScript
function commonElement(a, b) {
    const seen = new Set(a);                 // O(len(a))
    for (const x of b)                       // O(len(b)) membership tests
        if (seen.has(x)) return x;
    return null;
}

const join = (v) => "[" + v.join(" ") + "]";
for (const [a, b] of [[[3, 8, 12, 5], [7, 1, 12]], [[1, 2], [3, 4]]]) {
    const found = commonElement(a, b);
    console.log(join(a), "and", join(b), "→", found !== null ? `Yes (${found})` : "No");
}
```

```text filename:Output
[3 8 12 5] and [7 1 12] → Yes (12)
[1 2] and [3 4] → No
```

Time O(n + m) average · Space O(min(n, m))

# Interview Q&amp;A

```question
How is a set different from a list / array?

---

A set holds each value at most once, has no positions (no `s[i]`, no order), and tests membership in O(1) average via hashing. A list keeps duplicates and order, supports O(1) indexing, but membership is an O(n) scan. Use a list when order or duplicates matter, a set when you ask <em>is it there?</em> repeatedly.
```

```question
Why must set elements be hashable / immutable?

---

The element's hash decides which slot it lives in. If the element could change after insertion, its hash would change and it would be in the wrong slot — lookups would miss it. Python therefore refuses `list` and `dict` elements (`TypeError: unhashable type`) and offers `tuple` and `frozenset`; Java and C++ let you insert mutable objects but <em>break</em> if you mutate them inside the set.
```

```question
What are the complexities of union, intersection and difference?

---

All three iterate one set and test membership in the other: O(|a| + |b|) for union and symmetric difference, O(min(|a|, |b|)) for intersection if you iterate the smaller one, O(|a|) for `a - b`. With sorted (tree) sets the same operations are O(|a| + |b|) by merging.
```

```question
When would you pick a TreeSet / std::set over a hash set?

---

When you need the elements sorted, the smallest/largest element, the nearest value above or below a given one (`ceiling`/`floor`, `lower_bound`), or a range of elements. A hash set cannot answer any of those without a full scan; a tree set does each in O(log n).
```

```question
How do you remove duplicates from a list while keeping the original order?

---

A set alone loses order. Keep a `seen` set and append to a result only when the element was not yet seen — O(n). In Python `list(dict.fromkeys(items))` does the same in one line because dicts preserve insertion order; in Java use `LinkedHashSet`; JavaScript's `[...new Set(items)]` works because `Set` keeps insertion order.
```
