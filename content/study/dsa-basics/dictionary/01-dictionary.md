---
id: 8f223471-bbf0-70a7-9be4-e7af852b5e9f
key: topic:dsa-basics/dictionary
subject: dsa-basics
topic: dictionary
title: Dictionary
slug: dictionary
order: 1
---

A dictionary (hash map) stores <strong>key → value</strong> pairs and finds the value for any key in O(1) on average. It is the most used data structure in practice: counting, grouping, caching and indexing are all one hash lookup away.

> [!INFO]
>
> <strong>Dictionary / hash map</strong> — a collection of key–value pairs with <strong>distinct keys</strong>, backed by a hash table: the key is hashed to a slot and the value is stored alongside it. Python `dict`, C++ `unordered_map`, Java `HashMap`, JavaScript `Map`.

```text filename:A%20hash%20map%20is%20a%20hash%20table%20whose%20slots%20hold%20key%E2%80%93value%20pairs
d = {110: 'xyz', 101: 'abc', 105: 'pqr'}     with  h(key) = key % 4

slot 0 │            │
slot 1 │ 101 → abc  │──▶│ 105 → pqr │     101 % 4 = 1 and 105 % 4 = 1 collide → chained
slot 2 │ 110 → xyz  │
slot 3 │            │

lookup d[105]: h(105) = 1 → walk slot 1: 101? no, 105? yes → 'pqr'
```

# Properties of a dictionary

> [!NOTE] Key–value pairs
>
> Each entry maps a key to exactly one value: `d[110] = 'xyz'`.

> [!NOTE] Distinct keys
>
> Assigning to an existing key <strong>replaces</strong> its value; there are never two entries with the same key.

> [!NOTE] Values may repeat
>
> Many keys can map to the same value — only keys are unique.

> [!NOTE] Unordered (conceptually)
>
> Entries live in hash slots. Python 3.7+ and JavaScript additionally remember insertion order; C++ and Java do not.

> [!NOTE] Hashing internally
>
> Every lookup hashes the key — O(1) average, O(n) worst case.

> [!NOTE] Hashable keys
>
> Keys must be immutable with a stable hash (numbers, strings, tuples). Values can be anything.

| Operation | Python | Average | Why |
| --- | --- | --- | --- |
| insert / update | `d[k] = v` | O(1) | Hash `k`; store or overwrite in its slot |
| lookup | `d[k]` (KeyError if missing) / `d.get(k, default)` | O(1) | Hash `k`; compare keys in that one slot |
| membership | `k in d` | O(1) | Same lookup, returns a boolean |
| delete | `del d[k]` / `d.pop(k)` | O(1) | Hash `k`; unlink the entry |
| size | `len(d)` | O(1) | A stored counter |
| iterate | `for k, v in d.items()` | O(n) | Walk every slot |

# Map containers in the four languages

| Language | Hash map (unordered, O(1) avg) | Ordered map (sorted keys, O(log n)) |
| --- | --- | --- |
| Python | `dict` (insertion-ordered since 3.7); `collections.Counter`, `defaultdict` | — (use `sorted(d)`; `sortedcontainers` third-party) |
| C++ | `std::unordered_map` | `std::map` (red-black tree) |
| Java | `HashMap`; `LinkedHashMap` keeps insertion order | `TreeMap` (red-black tree) |
| JavaScript | `Map` (insertion-ordered); plain objects `{}` for string keys only | — (sort the keys) |

> [!NOTE] Key point
>
> JavaScript objects `{}` convert every key to a string (`obj[1]` and `obj["1"]` are the same key). Use `Map` when keys are numbers, objects or mixed types, and whenever you need `size` without `Object.keys(...).length`.

# Creating a dictionary, adding and reading entries

A dictionary is created from a literal or built up one assignment at a time. Reading `d[key]` returns the value; `keys()`, `values()` and `items()` give the three views. Below, the keys are <strong>sorted</strong> before printing because iteration order differs between languages.

```python filename:Python
d = {}                       # same as {110: 'xyz', 101: 'abc', 105: 'pqr'}
d[110] = 'xyz'
d[101] = 'abc'
d[105] = 'pqr'
print("size:", len(d))
print("d[101] =", d[101])                        # O(1) lookup
print("keys:", *sorted(d.keys()))
print("values:", *[d[k] for k in sorted(d)])
print("items:", *[f"{k}={d[k]}" for k in sorted(d)])
d[101] = 'ABC'                                   # existing key → value replaced
print("after d[101] = 'ABC':", *[f"{k}={d[k]}" for k in sorted(d)])
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_map>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

vector<int> sortedKeys(const unordered_map<int, string>& d) {
    vector<int> keys;
    for (auto& kv : d) keys.push_back(kv.first);
    sort(keys.begin(), keys.end());
    return keys;
}

int main() {
    unordered_map<int, string> d;    // same as {{110, "xyz"}, {101, "abc"}, {105, "pqr"}}
    d[110] = "xyz";
    d[101] = "abc";
    d[105] = "pqr";
    cout << "size: " << d.size() << "\n";
    cout << "d[101] = " << d[101] << "\n";                 // O(1) lookup
    cout << "keys:"; for (int k : sortedKeys(d)) cout << " " << k; cout << "\n";
    cout << "values:"; for (int k : sortedKeys(d)) cout << " " << d[k]; cout << "\n";
    cout << "items:"; for (int k : sortedKeys(d)) cout << " " << k << "=" << d[k]; cout << "\n";
    d[101] = "ABC";                                          // existing key → value replaced
    cout << "after d[101] = 'ABC':"; for (int k : sortedKeys(d)) cout << " " << k << "=" << d[k]; cout << "\n";
}
```

```java filename:Java
import java.util.*;

public class Main {
    static String items(Map<Integer, String> d) {
        StringBuilder sb = new StringBuilder();
        for (int k : new TreeSet<>(d.keySet())) sb.append(" ").append(k).append("=").append(d.get(k));
        return sb.toString();
    }

    public static void main(String[] args) {
        Map<Integer, String> d = new HashMap<>();   // same as Map.of(110, "xyz", 101, "abc", 105, "pqr")
        d.put(110, "xyz");
        d.put(101, "abc");
        d.put(105, "pqr");
        System.out.println("size: " + d.size());
        System.out.println("d[101] = " + d.get(101));          // O(1) lookup
        TreeSet<Integer> keys = new TreeSet<>(d.keySet());
        StringBuilder ks = new StringBuilder("keys:"), vs = new StringBuilder("values:");
        for (int k : keys) { ks.append(" ").append(k); vs.append(" ").append(d.get(k)); }
        System.out.println(ks);
        System.out.println(vs);
        System.out.println("items:" + items(d));
        d.put(101, "ABC");                                      // existing key → value replaced
        System.out.println("after d[101] = 'ABC':" + items(d));
    }
}
```

```javascript filename:JavaScript
const d = new Map();          // same as new Map([[110, 'xyz'], [101, 'abc'], [105, 'pqr']])
d.set(110, 'xyz');
d.set(101, 'abc');
d.set(105, 'pqr');
const sortedKeys = () => [...d.keys()].sort((a, b) => a - b);
const items = () => sortedKeys().map(k => `${k}=${d.get(k)}`).join(" ");

console.log("size:", d.size);
console.log("d[101] =", d.get(101));                 // O(1) lookup
console.log("keys:", sortedKeys().join(" "));
console.log("values:", sortedKeys().map(k => d.get(k)).join(" "));
console.log("items:", items());
d.set(101, 'ABC');                                    // existing key → value replaced
console.log("after d[101] = 'ABC':", items());
```

```text filename:Output
size: 3
d[101] = abc
keys: 101 105 110
values: abc pqr xyz
items: 101=abc 105=pqr 110=xyz
after d[101] = 'ABC': 101=ABC 105=pqr 110=xyz
```

Time O(1) average per insert / lookup · Space O(n)

> [!WARNING] Pitfall
>
> In C++ `d[key]` on a <strong>missing</strong> key silently <em>inserts</em> a default value (empty string, 0) and returns it. Use `d.find(key)`, `d.count(key)`, `d.contains(key)` (C++20) or `d.at(key)` (throws) when you only want to read.

# Missing keys and default values

What happens when the key is absent is where the languages differ most, and the source of most dictionary bugs:

| Language | Read of a missing key | Safe read with default | Membership |
| --- | --- | --- | --- |
| Python | `d[k]` raises `KeyError` | `d.get(k, default)`; `d.setdefault(k, default)` also inserts | `k in d` |
| C++ | `d[k]` <strong>inserts</strong> a default and returns it; `d.at(k)` throws | `auto it = d.find(k); it != d.end() ? it->second : default` | `d.count(k)` / `d.contains(k)` |
| Java | `d.get(k)` returns `null` | `d.getOrDefault(k, default)` | `d.containsKey(k)` |
| JavaScript | `d.get(k)` returns `undefined` | `d.get(k) ?? default` | `d.has(k)` |

```python filename:Python
d = {110: 'xyz', 101: 'abc', 105: 'pqr'}
print("get 101:", d.get(101))
print("get 999:", d.get(999, "none"))           # no KeyError
print("999 in d:", "true" if 999 in d else "false")

counts = {}
counts['abc'] = counts.get('abc', 0) + 1       # the counting idiom
print("count of 'abc' with default 0 →", counts['abc'])
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_map>
#include <string>
using namespace std;

string getOr(const unordered_map<int, string>& d, int k, const string& def) {
    auto it = d.find(k);                          // find does not insert
    return it != d.end() ? it->second : def;
}

int main() {
    unordered_map<int, string> d = {{110, "xyz"}, {101, "abc"}, {105, "pqr"}};
    cout << "get 101: " << getOr(d, 101, "none") << "\n";
    cout << "get 999: " << getOr(d, 999, "none") << "\n";
    cout << "999 in d: " << (d.contains(999) ? "true" : "false") << "\n";

    unordered_map<string, int> counts;
    counts["abc"]++;                              // operator[] inserts 0 then increments — the counting idiom
    cout << "count of 'abc' with default 0 → " << counts["abc"] << "\n";
}
```

```java filename:Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<Integer, String> d = new HashMap<>(Map.of(110, "xyz", 101, "abc", 105, "pqr"));
        System.out.println("get 101: " + d.get(101));
        System.out.println("get 999: " + d.getOrDefault(999, "none"));   // get(999) alone would be null
        System.out.println("999 in d: " + d.containsKey(999));

        Map<String, Integer> counts = new HashMap<>();
        counts.merge("abc", 1, Integer::sum);           // the counting idiom
        System.out.println("count of 'abc' with default 0 → " + counts.get("abc"));
    }
}
```

```javascript filename:JavaScript
const d = new Map([[110, 'xyz'], [101, 'abc'], [105, 'pqr']]);
console.log("get 101:", d.get(101));
console.log("get 999:", d.get(999) ?? "none");        // get(999) alone would be undefined
console.log("999 in d:", d.has(999));

const counts = new Map();
counts.set('abc', (counts.get('abc') ?? 0) + 1);     // the counting idiom
console.log("count of 'abc' with default 0 →", counts.get('abc'));
```

```text filename:Output
get 101: abc
get 999: none
999 in d: false
count of 'abc' with default 0 → 1
```

Time O(1) average · Space O(1)

> [!NOTE] Key point
>
> Python's `collections.defaultdict(int)` and `Counter` build the default-value idiom into the container: `counts[x] += 1` just works. `Counter(arr).most_common(k)` is the one-liner for top-k frequency questions.

# Removing entries

`pop(key)` removes an entry <strong>and returns its value</strong> (Python, and the same shape in Java's `remove`); `del d[key]` just removes it. Python's `popitem()` removes and returns the <strong>last inserted</strong> pair — handy as a stack of pairs — and has no equivalent in the other languages.

```python filename:Python
d = {110: 'xyz', 101: 'abc', 105: 'pqr'}
def show(): print("remaining:", *[f"{k}={d[k]}" for k in sorted(d)])

print("pop 101 →", d.pop(101))             # removes and returns the value
show()
print("delete 105:", "true" if d.pop(105, None) is not None else "false")
print("delete 999:", "true" if d.pop(999, None) is not None else "false")   # default avoids KeyError
show()
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_map>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

unordered_map<int, string> d = {{110, "xyz"}, {101, "abc"}, {105, "pqr"}};

void show() {
    vector<int> keys;
    for (auto& kv : d) keys.push_back(kv.first);
    sort(keys.begin(), keys.end());
    cout << "remaining:";
    for (int k : keys) cout << " " << k << "=" << d[k];
    cout << "\n";
}

int main() {
    string v = d.at(101); d.erase(101);        // read, then erase — erase itself returns a count
    cout << "pop 101 → " << v << "\n";
    show();
    cout << "delete 105: " << (d.erase(105) ? "true" : "false") << "\n";
    cout << "delete 999: " << (d.erase(999) ? "true" : "false") << "\n";
    show();
}
```

```java filename:Java
import java.util.*;

public class Main {
    static Map<Integer, String> d = new HashMap<>(Map.of(110, "xyz", 101, "abc", 105, "pqr"));

    static void show() {
        StringBuilder sb = new StringBuilder("remaining:");
        for (int k : new TreeSet<>(d.keySet())) sb.append(" ").append(k).append("=").append(d.get(k));
        System.out.println(sb);
    }

    public static void main(String[] args) {
        System.out.println("pop 101 → " + d.remove(101));      // removes and returns the value (null if absent)
        show();
        System.out.println("delete 105: " + (d.remove(105) != null));
        System.out.println("delete 999: " + (d.remove(999) != null));
        show();
    }
}
```

```javascript filename:JavaScript
const d = new Map([[110, 'xyz'], [101, 'abc'], [105, 'pqr']]);
const show = () => console.log("remaining:", [...d.keys()].sort((a, b) => a - b).map(k => `${k}=${d.get(k)}`).join(" "));

const v = d.get(101); d.delete(101);        // read, then delete — delete returns a boolean
console.log("pop 101 →", v);
show();
console.log("delete 105:", d.delete(105));
console.log("delete 999:", d.delete(999));
show();
```

```text filename:Output
pop 101 → abc
remaining: 105=pqr 110=xyz
delete 105: true
delete 999: false
remaining: 110=xyz
```

Time O(1) average per removal · Space O(1)

```python filename:Python
d = {110: 'xyz', 101: 'abc', 105: 'pqr'}
print(d.popitem())      # last inserted pair, LIFO (Python 3.7+)
print(d.popitem())
print(d)
```

```text filename:Output
(105, 'pqr')
(101, 'abc')
{110: 'xyz'}
```

# Iteration order

> [!WARNING] Watch out
>
> Conceptually a hash map has <strong>no order</strong>. Two of the four languages guarantee insertion order anyway, two do not — code that works in Python and breaks in Java or C++ is a classic porting bug.

| Container | Iteration order |
| --- | --- |
| Python `dict` | <strong>Insertion order</strong> (guaranteed since 3.7) |
| C++ `unordered_map` | Arbitrary; `std::map` = sorted by key |
| Java `HashMap` | Arbitrary; `LinkedHashMap` = insertion order; `TreeMap` = sorted by key |
| JavaScript `Map` | <strong>Insertion order</strong>; plain objects list integer-like keys first in ascending order, then string keys in insertion order |

> [!TIP] Do
>
> Need sorted output? Sort the keys explicitly (`for k in sorted(d)`) or use a tree map. Need first-seen order in C++/Java? Keep a separate vector/list of keys in insertion order or use `LinkedHashMap`.

# Typical uses

> [!NOTE] Frequency counting
>
> `count[x] += 1` over an array or text — then answer <em>most frequent</em>, <em>appears exactly once</em>, <em>anagram check</em>.

> [!NOTE] Lookup tables
>
> id → record, name → phone number, word → definition. A database index in miniature.

> [!NOTE] Memoisation / caching
>
> key = function arguments, value = result; dynamic programming top-down uses exactly this.

> [!NOTE] Grouping
>
> key = group label (first letter, sorted letters, remainder), value = list of members.

> [!NOTE] Pair problems
>
> Two-sum: for each `x`, has `target - x` been seen? Store value → index.

> [!NOTE] Graphs
>
> Adjacency lists for sparse graphs with arbitrary vertex labels: `adj[u] = [v, …]`.

# Problem: word frequencies

> [!TIP] Example
>
> <strong>Input:</strong> `text = "the cat and the hat and the bat"`<br><strong>Output:</strong> `and 2 / bat 1 / cat 1 / hat 1 / the 3`

> [!NOTE] Idea
>
> Split into words and do `freq[word] += 1` for each — a hash map update is O(1) on average, so the whole text costs O(n). Print the keys in sorted order so the result does not depend on the language's iteration order.

```python filename:Python
def word_freq(text):
    freq = {}
    for w in text.split():
        freq[w] = freq.get(w, 0) + 1      # O(1) average
    for w in sorted(freq):
        print(w, freq[w])

word_freq("the cat and the hat and the bat")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>
#include <algorithm>
using namespace std;

void wordFreq(const string& text) {
    unordered_map<string, int> freq;
    istringstream in(text);
    string w;
    while (in >> w) freq[w]++;            // O(1) average
    vector<string> words;
    for (auto& kv : freq) words.push_back(kv.first);
    sort(words.begin(), words.end());
    for (const string& x : words) cout << x << " " << freq[x] << "\n";
}

int main() {
    wordFreq("the cat and the hat and the bat");
}
```

```java filename:Java
import java.util.*;

public class Main {
    static void wordFreq(String text) {
        Map<String, Integer> freq = new HashMap<>();
        for (String w : text.split(" ")) freq.merge(w, 1, Integer::sum);   // O(1) average
        for (String w : new TreeSet<>(freq.keySet()))
            System.out.println(w + " " + freq.get(w));
    }

    public static void main(String[] args) {
        wordFreq("the cat and the hat and the bat");
    }
}
```

```javascript filename:JavaScript
function wordFreq(text) {
    const freq = new Map();
    for (const w of text.split(" ")) freq.set(w, (freq.get(w) ?? 0) + 1);   // O(1) average
    for (const w of [...freq.keys()].sort()) console.log(w, freq.get(w));
}

wordFreq("the cat and the hat and the bat");
```

```text filename:Output
and 2
bat 1
cat 1
hat 1
the 3
```

Time O(n) average (+ O(k log k) to sort k distinct words) · Space O(k)

# Problem: two sum with a hash map

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [8, 3, 5, 11, 2], target = 13`<br><strong>Output:</strong> `8 + 5 = 13`<br><strong>Input:</strong> `arr = [1, 2, 3], target = 10`<br><strong>Output:</strong> `no pair`

> [!NOTE] Idea
>
> Scan once. For each `x`, the partner we need is `target - x`; if it has already been <strong>seen</strong>, we are done, otherwise record `x`. One hash lookup per element replaces the inner loop of the O(n²) brute force.

1. <strong>Create an empty map</strong>

   `seen` maps a value to its index (a set suffices if indices are not needed).

2. <strong>For each element </strong><strong>`x`</strong>

   Compute `need = target - x`.

3. <strong>Check the map</strong>

   If `need` is in `seen`, report the pair `(need, x)`.

4. <strong>Record</strong>

   Otherwise store `seen[x] = index` and continue.

```python filename:Python
def two_sum(arr, target):
    seen = {}                               # value → index
    for i, x in enumerate(arr):
        need = target - x
        if need in seen:                    # O(1) instead of an inner loop
            return seen[need], i
        seen[x] = i
    return None

for arr, target in (([8, 3, 5, 11, 2], 13), ([1, 2, 3], 10)):
    res = two_sum(arr, target)
    label = f"[{' '.join(map(str, arr))}] target {target} →"
    if res is None:
        print(label, "no pair")
    else:
        i, j = res
        print(label, f"{arr[i]} + {arr[j]} = {target} (indices {i}, {j})")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
#include <unordered_map>
#include <string>
using namespace std;

bool twoSum(const vector<int>& arr, int target, int& i, int& j) {
    unordered_map<int, int> seen;           // value → index
    int n = arr.size();
    for (int k = 0; k < n; k++) {
        int need = target - arr[k];
        auto it = seen.find(need);          // O(1) instead of an inner loop
        if (it != seen.end()) { i = it->second; j = k; return true; }
        seen[arr[k]] = k;
    }
    return false;
}

int main() {
    vector<pair<vector<int>, int>> tests = {{{8, 3, 5, 11, 2}, 13}, {{1, 2, 3}, 10}};
    for (auto& [arr, target] : tests) {
        cout << "[";
        for (int k = 0; k < (int)arr.size(); k++) cout << (k ? " " : "") << arr[k];
        cout << "] target " << target << " → ";
        int i, j;
        if (twoSum(arr, target, i, j))
            cout << arr[i] << " + " << arr[j] << " = " << target << " (indices " << i << ", " << j << ")\n";
        else
            cout << "no pair\n";
    }
}
```

```java filename:Java
import java.util.*;

public class Main {
    static int[] twoSum(int[] arr, int target) {
        Map<Integer, Integer> seen = new HashMap<>();   // value → index
        for (int k = 0; k < arr.length; k++) {
            int need = target - arr[k];
            if (seen.containsKey(need))                 // O(1) instead of an inner loop
                return new int[]{seen.get(need), k};
            seen.put(arr[k], k);
        }
        return null;
    }

    public static void main(String[] args) {
        int[][] arrays = {{8, 3, 5, 11, 2}, {1, 2, 3}};
        int[] targets = {13, 10};
        for (int t = 0; t < arrays.length; t++) {
            int[] arr = arrays[t];
            StringBuilder sb = new StringBuilder("[");
            for (int k = 0; k < arr.length; k++) sb.append(k > 0 ? " " : "").append(arr[k]);
            sb.append("] target ").append(targets[t]).append(" → ");
            int[] res = twoSum(arr, targets[t]);
            if (res == null) sb.append("no pair");
            else sb.append(arr[res[0]]).append(" + ").append(arr[res[1]]).append(" = ").append(targets[t])
                   .append(" (indices ").append(res[0]).append(", ").append(res[1]).append(")");
            System.out.println(sb);
        }
    }
}
```

```javascript filename:JavaScript
function twoSum(arr, target) {
    const seen = new Map();                   // value → index
    for (let k = 0; k < arr.length; k++) {
        const need = target - arr[k];
        if (seen.has(need)) return [seen.get(need), k];   // O(1) instead of an inner loop
        seen.set(arr[k], k);
    }
    return null;
}

for (const [arr, target] of [[[8, 3, 5, 11, 2], 13], [[1, 2, 3], 10]]) {
    const label = `[${arr.join(" ")}] target ${target} →`;
    const res = twoSum(arr, target);
    if (res === null) console.log(label, "no pair");
    else console.log(label, `${arr[res[0]]} + ${arr[res[1]]} = ${target} (indices ${res[0]}, ${res[1]})`);
}
```

```text filename:Output
[8 3 5 11 2] target 13 → 8 + 5 = 13 (indices 0, 2)
[1 2 3] target 10 → no pair
```

Time O(n) average · Space O(n)

> [!WARNING] Pitfall
>
> Insert `x` into the map <strong>after</strong> checking for its partner, not before — otherwise `target = 2x` would match an element with itself (`[5]`, target 10 → "5 + 5").

# Interview Q&amp;A

```question
How does a dictionary achieve O(1) lookup?

---

The key is hashed to an array index; the value sits in that slot (or in a short chain / probe sequence starting there). No scanning, no comparisons with unrelated keys. The cost is O(1) <em>average</em>: a bad hash function or an overfull table lengthens chains, and rehashing keeps the load factor bounded.
```

```question
Dictionary vs set — when do you need which?

---

Both are hash tables with distinct keys. A set answers <em>is </em><em>`x`</em><em> present?</em>; a dictionary additionally attaches a value to each key — a count, an index, a list of members. If you catch yourself using a dictionary with all values `True`, you want a set.
```

```question
What can be a dictionary key?

---

Anything hashable and immutable in Python: numbers, strings, tuples of hashables, `frozenset` — not lists, dicts or sets. Java and C++ require a consistent `hashCode`/`equals` pair (or `std::hash` plus `==`) and the object must not change while it is a key. JavaScript `Map` accepts any value including objects (compared by identity), whereas plain objects stringify every key.
```

```question
What is the difference between HashMap, LinkedHashMap and TreeMap (or dict vs std::map)?

---

`HashMap`/`unordered_map`/`dict`: hash table, O(1) average, no ordering guarantee (Python `dict` and JS `Map` keep insertion order). `LinkedHashMap`: hash table plus a linked list through the entries — insertion order at the same O(1). `TreeMap`/`std::map`: red-black tree, keys sorted, O(log n) per operation, supports floor/ceiling/range queries. Pick by whether you need order.
```

```question
How would you find the first non-repeating character in a string?

---

Two passes with a dictionary: count every character (O(n)), then scan the string again and return the first character whose count is 1. The second pass uses the <em>string's</em> order, so the hash map's iteration order never matters.
```
