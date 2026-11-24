---
id: ca052dec-a795-7109-9b0d-864d7de176d6
key: topic:dsa-advanced/hashing
subject: dsa-advanced
topic: hashing
title: Hashing
slug: hashing
order: 1
---

A hash set or hash map answers <strong>“have I seen this value?”</strong> in `O(1)` on average. Almost every problem in this topic is an `O(n²)` double loop that collapses to `O(n)` once the inner loop is replaced by one hash lookup — and half of them use the same trick: <strong>prefix sums stored in a hash map</strong>.

> [!INFO]
>
> <strong>Hashing (as a problem-solving tool)</strong> — replacing <em>search</em> with <em>lookup</em>. Instead of scanning for a value, you keep every value you have met in a hash table and ask the table. Average `O(1)` per insert / lookup / delete, `O(n)` extra space, and no ordering.

# The containers you will reach for

| Need | Python | C++ | Java | JavaScript |
| --- | --- | --- | --- | --- |
| membership only | `set` | `unordered_set` | `HashSet` | `Set` |
| key → value / count | `dict`, `Counter` | `unordered_map` | `HashMap` | `Map` |
| insert / lookup / erase | `O(1)` avg | `O(1)` avg | `O(1)` avg | `O(1)` avg |
| iteration order | insertion order | unspecified | unspecified | insertion order |

> [!WARNING] Watch out
>
> Iteration order over a hash container is <strong>not</strong> the same across languages (C++ and Java make no promise at all). When an answer is a <em>set of values</em>, sort it before printing — every solution below that prints several keys does exactly that.

Two questions decide the whole design of a hashing solution:

> [!NOTE] What is the key?
>
> The raw value (`pair with sum`), a running prefix sum (`subarray with sum`), or a derived value such as `prefix(a) − prefix(b)` (`common span`).

> [!NOTE] What do I store with it?
>
> Nothing (a set), a <strong>count</strong> (frequency problems), or the <strong>first index</strong> where the key appeared (longest-subarray problems).

# The prefix-sum + hash map pattern

Let `prefix[j] = arr[0] + … + arr[j]`. Then the sum of any subarray is a difference of two prefix sums:

`sum(arr[i..j]) = prefix[j] − prefix[i−1]`

So <em>“is there a subarray ending at </em><em>`j`</em><em> with sum </em><em>`S`</em><em>?”</em> becomes <em>“did the value </em><em>`prefix[j] − S`</em><em> appear as an earlier prefix sum?”</em> — a single hash lookup instead of an inner loop over every start `i`.

```text filename:Two%20equal%20prefix%20sums%20%E2%87%92%20the%20elements%20between%20them%20sum%20to%200
index   :   0    1    2    3    4    5    6
arr     : [ 5,   8,  -4,  -4,   9,  -2,   2 ]
prefix  : [ 5,  13,   9,   5,  14,  12,  14 ]
            ↑              ↑
       prefix[0] = 5  prefix[3] = 5   →  arr[1..3] = 8 − 4 − 4 = 0   (length 3 − 0 = 3)
```

1. <strong>Seed the map with </strong><strong>`prefix = 0`</strong><strong> at index </strong><strong>`−1`</strong>

   The empty prefix. It makes a subarray that starts at index 0 fall out of the same formula instead of needing a special case.

2. <strong>Walk left to right, updating </strong><strong>`prefix`</strong>

   One addition per element.

3. <strong>Look up </strong><strong>`prefix − S`</strong>

   Found at index `k` ⇒ `arr[k+1..j]` sums to `S`. For <em>existence</em> answer immediately; for <em>longest</em> take `j − k`; for <em>count</em> add the stored count.

4. <strong>Insert </strong><strong>`prefix`</strong><strong> only if it is new</strong>

   Keeping the <strong>first</strong> index gives the longest subarray; a later duplicate would only shorten it.

> [!NOTE] Key point
>
> Four problems below are this one template with a different `S` or a different array: subarray with 0 sum (`S = 0`), longest subarray with given sum, longest subarray with equal 0s and 1s (map `0 → −1`, then `S = 0`) and longest common span of two binary arrays (use `a[i] − b[i]`, then `S = 0`).

# Intersection of two unsorted arrays

> [!TIP] Example
>
> <strong>Input:</strong> `a = [10, 15, 20, 5, 20], b = [30, 5, 30, 80]`<br><strong>Output:</strong> `1`<br><strong>Input:</strong> `a = [1, 2, 3, 2, 4, 5], b = [3, 4, 5, 6]`<br><strong>Output:</strong> `3`

Count the <strong>distinct</strong> values that appear in both arrays. Duplicates inside one array (the two `20`s, the two `30`s) are counted once.

Naive: for each element of `a`, skip it if it already appeared earlier in `a`, otherwise scan `b` for it. Two nested scans per element.

```python filename:Python%20%E2%80%94%20naive
def intersection_count(a, b):
    res = 0
    for i in range(len(a)):
        seen_before = False
        for j in range(i):              # did a[i] already appear in a[0..i-1]?
            if a[j] == a[i]:
                seen_before = True
                break
        if seen_before:
            continue
        for y in b:                     # is a[i] present in b?
            if y == a[i]:
                res += 1
                break
    return res

print(intersection_count([10, 15, 20, 5, 20], [30, 5, 30, 80]))
print(intersection_count([1, 2, 3, 2, 4, 5], [3, 4, 5, 6]))
```

```text filename:Output
1
3
```

Time O(m · (m + n)) · Space O(1)

> [!NOTE] Idea
>
> Put the distinct elements of `a` into a set. Scan `b`: every element found in the set is a common value — count it and <strong>remove it from the set</strong>, so a repeated value in `b` cannot be counted twice. Each element is touched once.

```python filename:Python
def intersection_count(a, b):
    remaining = set(a)             # distinct elements of a
    count = 0
    for x in b:
        if x in remaining:         # common value — count it once …
            count += 1
            remaining.remove(x)    # … by removing it immediately
    return count

print(intersection_count([10, 15, 20, 5, 20], [30, 5, 30, 80]))
print(intersection_count([1, 2, 3, 2, 4, 5], [3, 4, 5, 6]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
#include <vector>
using namespace std;

int intersectionCount(const vector<int>& a, const vector<int>& b) {
    unordered_set<int> remaining(a.begin(), a.end());   // distinct elements of a
    int count = 0;
    for (int x : b) {
        if (remaining.count(x)) {      // common value — count it once …
            count++;
            remaining.erase(x);        // … by removing it immediately
        }
    }
    return count;
}

int main() {
    cout << intersectionCount({10, 15, 20, 5, 20}, {30, 5, 30, 80}) << "\n";
    cout << intersectionCount({1, 2, 3, 2, 4, 5}, {3, 4, 5, 6}) << "\n";
}
```

```java filename:Java
import java.util.HashSet;
import java.util.Set;

public class Main {
    static int intersectionCount(int[] a, int[] b) {
        Set<Integer> remaining = new HashSet<>();     // distinct elements of a
        for (int x : a) remaining.add(x);
        int count = 0;
        for (int x : b) {
            if (remaining.remove(x)) count++;        // remove() is true only if x was present
        }
        return count;
    }

    public static void main(String[] args) {
        System.out.println(intersectionCount(new int[]{10, 15, 20, 5, 20}, new int[]{30, 5, 30, 80}));
        System.out.println(intersectionCount(new int[]{1, 2, 3, 2, 4, 5}, new int[]{3, 4, 5, 6}));
    }
}
```

```javascript filename:JavaScript
function intersectionCount(a, b) {
    const remaining = new Set(a);          // distinct elements of a
    let count = 0;
    for (const x of b) {
        if (remaining.delete(x)) count++;  // delete() is true only if x was present
    }
    return count;
}

console.log(intersectionCount([10, 15, 20, 5, 20], [30, 5, 30, 80]));
console.log(intersectionCount([1, 2, 3, 2, 4, 5], [3, 4, 5, 6]));
```

```text filename:Output
1
3
```

Time O(m + n) · Space O(m)

> [!NOTE] Key point
>
> Building two sets and counting the elements of one that are in the other (`len(set(a) & set(b))` in Python) is the same `O(m + n)` idea; the remove-on-hit version needs only one set and no second pass.

# Union of two unsorted arrays

> [!TIP] Example
>
> <strong>Input:</strong> `a = [15, 20, 5, 15], b = [15, 15, 15, 20, 10]`<br><strong>Output:</strong> `4`<br><strong>Input:</strong> `a = [1, 2, 3, 2, 4, 5], b = [3, 4, 5, 6]`<br><strong>Output:</strong> `6`

Count the distinct values present in at least one of the arrays. The naive way copies both into one array of `m + n` elements and, for each element, scans everything before it to see whether it is a repeat.

```python filename:Python%20%E2%80%94%20naive
def union_count(a, b):
    c = a + b                        # all m + n elements
    res = 0
    for i in range(len(c)):
        repeat = False
        for j in range(i):           # did c[i] already appear?
            if c[j] == c[i]:
                repeat = True
                break
        if not repeat:
            res += 1
    return res

print(union_count([15, 20, 5, 15], [15, 15, 15, 20, 10]))
print(union_count([1, 2, 3, 2, 4, 5], [3, 4, 5, 6]))
```

```text filename:Output
4
6
```

Time O((m + n)²) · Space O(m + n)

> [!NOTE] Idea
>
> A set <em>is</em> a union with duplicates removed. Insert every element of both arrays and read off its size.

```python filename:Python
def union_count(a, b):
    s = set()
    for x in a:
        s.add(x)          # duplicates are silently ignored
    for x in b:
        s.add(x)
    return len(s)

print(union_count([15, 20, 5, 15], [15, 15, 15, 20, 10]))
print(union_count([1, 2, 3, 2, 4, 5], [3, 4, 5, 6]))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
#include <vector>
using namespace std;

int unionCount(const vector<int>& a, const vector<int>& b) {
    unordered_set<int> s;
    for (int x : a) s.insert(x);      // duplicates are silently ignored
    for (int x : b) s.insert(x);
    return (int)s.size();
}

int main() {
    cout << unionCount({15, 20, 5, 15}, {15, 15, 15, 20, 10}) << "\n";
    cout << unionCount({1, 2, 3, 2, 4, 5}, {3, 4, 5, 6}) << "\n";
}
```

```java filename:Java
import java.util.HashSet;
import java.util.Set;

public class Main {
    static int unionCount(int[] a, int[] b) {
        Set<Integer> s = new HashSet<>();
        for (int x : a) s.add(x);        // duplicates are silently ignored
        for (int x : b) s.add(x);
        return s.size();
    }

    public static void main(String[] args) {
        System.out.println(unionCount(new int[]{15, 20, 5, 15}, new int[]{15, 15, 15, 20, 10}));
        System.out.println(unionCount(new int[]{1, 2, 3, 2, 4, 5}, new int[]{3, 4, 5, 6}));
    }
}
```

```javascript filename:JavaScript
function unionCount(a, b) {
    const s = new Set();
    for (const x of a) s.add(x);         // duplicates are silently ignored
    for (const x of b) s.add(x);
    return s.size;
}

console.log(unionCount([15, 20, 5, 15], [15, 15, 15, 20, 10]));
console.log(unionCount([1, 2, 3, 2, 4, 5], [3, 4, 5, 6]));
```

```text filename:Output
4
6
```

Time O(m + n) · Space O(m + n)

> [!NOTE] Key point
>
> If the arrays were <strong>sorted</strong>, both union and intersection could be done with the two-pointer merge walk in `O(m + n)` time and `O(1)` space — the hash set is what buys you the same time on <em>unsorted</em> input.

# Pair with given sum

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [3, 2, 8, 15, -18], sum = 17`<br><strong>Output:</strong> `Yes (2 + 15)`<br><strong>Input:</strong> `arr = [2, 1, 6, 3], sum = 6`<br><strong>Output:</strong> `No`

Does the array contain two <em>different</em> elements whose sum is `x`? The naive check tries every pair.

```python filename:Python%20%E2%80%94%20naive
def has_pair(arr, x):
    n = len(arr)
    for i in range(n):
        for j in range(i + 1, n):
            if arr[i] + arr[j] == x:
                return True
    return False

print("Yes" if has_pair([3, 2, 8, 15, -18], 17) else "No")
print("Yes" if has_pair([2, 1, 6, 3], 6) else "No")
```

```text filename:Output
Yes
No
```

Time O(n²) · Space O(1)

> [!NOTE] Idea
>
> Walk the array once. Before inserting `arr[i]`, ask the set whether its <strong>complement</strong> `x − arr[i]` has already been seen. Checking <em>before</em> inserting guarantees the two elements are at different positions — `[3]` with `x = 6` correctly answers `No`.

```python filename:Python
def has_pair(arr, x):
    seen = set()
    for v in arr:
        if x - v in seen:       # complement met earlier → pair found
            return True
        seen.add(v)             # insert AFTER the check
    return False

for arr, x in [([3, 2, 8, 15, -18], 17), ([2, 1, 6, 3], 6), ([3], 6)]:
    print("sum =", x, "→", "Yes" if has_pair(arr, x) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
#include <vector>
using namespace std;

bool hasPair(const vector<int>& arr, int x) {
    unordered_set<int> seen;
    for (int v : arr) {
        if (seen.count(x - v)) return true;   // complement met earlier → pair found
        seen.insert(v);                       // insert AFTER the check
    }
    return false;
}

int main() {
    vector<pair<vector<int>, int>> tests = {{{3, 2, 8, 15, -18}, 17}, {{2, 1, 6, 3}, 6}, {{3}, 6}};
    for (auto& [arr, x] : tests)
        cout << "sum = " << x << " → " << (hasPair(arr, x) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
import java.util.HashSet;
import java.util.Set;

public class Main {
    static boolean hasPair(int[] arr, int x) {
        Set<Integer> seen = new HashSet<>();
        for (int v : arr) {
            if (seen.contains(x - v)) return true;   // complement met earlier → pair found
            seen.add(v);                             // insert AFTER the check
        }
        return false;
    }

    public static void main(String[] args) {
        int[][] arrays = {{3, 2, 8, 15, -18}, {2, 1, 6, 3}, {3}};
        int[] sums = {17, 6, 6};
        for (int t = 0; t < arrays.length; t++)
            System.out.println("sum = " + sums[t] + " → " + (hasPair(arrays[t], sums[t]) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function hasPair(arr, x) {
    const seen = new Set();
    for (const v of arr) {
        if (seen.has(x - v)) return true;   // complement met earlier → pair found
        seen.add(v);                        // insert AFTER the check
    }
    return false;
}

for (const [arr, x] of [[[3, 2, 8, 15, -18], 17], [[2, 1, 6, 3], 6], [[3], 6]])
    console.log("sum =", x, "→", hasPair(arr, x) ? "Yes" : "No");
```

```text filename:Output
sum = 17 → Yes
sum = 6 → No
sum = 6 → No
```

Time O(n) · Space O(n)

> [!WARNING] Pitfall
>
> Inserting all elements first and <em>then</em> asking `x − v in set` for each `v` accepts an element paired with itself (`[3]`, `x = 6` → wrong `Yes`). Insert after the lookup, or store counts and demand two copies when `x − v == v`.

# Subarray with 0 sum

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 2, 3, 2, 4, 5]`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `arr = [-1, 4, -3, 5, 1]`<br><strong>Output:</strong> `Yes (4 − 3 − 1 = 0 … [-1, 4, -3])`<br><strong>Input:</strong> `arr = [4, -3, -1, 2]`<br><strong>Output:</strong> `Yes`

Is there a contiguous subarray whose elements sum to zero? The naive solution computes the sum of every `(i, j)` range.

```python filename:Python%20%E2%80%94%20naive
def has_zero_sum(arr):
    n = len(arr)
    for i in range(n):
        s = 0
        for j in range(i, n):      # extend the subarray one element at a time
            s += arr[j]
            if s == 0:
                return True
    return False

print("Yes" if has_zero_sum([1, 2, 3, 2, 4, 5]) else "No")
print("Yes" if has_zero_sum([-1, 4, -3, 5, 1]) else "No")
```

```text filename:Output
No
Yes
```

Time O(n²) · Space O(1)

> [!NOTE] Idea
>
> First use of the prefix-sum pattern. A zero-sum subarray `arr[i..j]` exists exactly when two prefix sums are equal, `prefix[i−1] == prefix[j]` — or when some `prefix[j]` is itself `0` (the subarray starts at index 0). Keep every prefix sum in a set; the first repeat (or a `0`) is the answer.

```text filename:Prefix%20sums%20of%20the%20second%20example
arr    : [ -1,  4, -3,  5,  1 ]
prefix : [ -1,  3,  0,  5,  6 ]
                     ↑
               prefix[2] = 0  →  arr[0..2] sums to 0  →  Yes
```

```python filename:Python
def has_zero_sum(arr):
    seen = {0}            # the empty prefix: lets a subarray start at index 0
    prefix = 0
    for v in arr:
        prefix += v
        if prefix in seen:    # same prefix twice → the gap sums to 0
            return True
        seen.add(prefix)
    return False

for arr in [[1, 2, 3, 2, 4, 5], [-1, 4, -3, 5, 1], [4, -3, -1, 2]]:
    print("Yes" if has_zero_sum(arr) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_set>
#include <vector>
using namespace std;

bool hasZeroSum(const vector<int>& arr) {
    unordered_set<int> seen = {0};     // the empty prefix: lets a subarray start at index 0
    int prefix = 0;
    for (int v : arr) {
        prefix += v;
        if (seen.count(prefix)) return true;   // same prefix twice → the gap sums to 0
        seen.insert(prefix);
    }
    return false;
}

int main() {
    vector<vector<int>> tests = {{1, 2, 3, 2, 4, 5}, {-1, 4, -3, 5, 1}, {4, -3, -1, 2}};
    for (auto& arr : tests) cout << (hasZeroSum(arr) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
import java.util.HashSet;
import java.util.Set;

public class Main {
    static boolean hasZeroSum(int[] arr) {
        Set<Integer> seen = new HashSet<>();
        seen.add(0);                       // the empty prefix: lets a subarray start at index 0
        int prefix = 0;
        for (int v : arr) {
            prefix += v;
            if (!seen.add(prefix)) return true;   // add() is false when prefix was already there
        }
        return false;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 2, 3, 2, 4, 5}, {-1, 4, -3, 5, 1}, {4, -3, -1, 2}};
        for (int[] arr : tests) System.out.println(hasZeroSum(arr) ? "Yes" : "No");
    }
}
```

```javascript filename:JavaScript
function hasZeroSum(arr) {
    const seen = new Set([0]);      // the empty prefix: lets a subarray start at index 0
    let prefix = 0;
    for (const v of arr) {
        prefix += v;
        if (seen.has(prefix)) return true;   // same prefix twice → the gap sums to 0
        seen.add(prefix);
    }
    return false;
}

for (const arr of [[1, 2, 3, 2, 4, 5], [-1, 4, -3, 5, 1], [4, -3, -1, 2]])
    console.log(hasZeroSum(arr) ? "Yes" : "No");
```

```text filename:Output
No
Yes
Yes
```

Time O(n) · Space O(n)

> [!NOTE] Key point
>
> <strong>Subarray with a given sum </strong><strong>`S`</strong> is the same code with `prefix − S` looked up instead of `prefix`. Seeding the set with `0` is what replaces the separate `if prefix == 0` test of the original notes.

# Check for palindrome permutation

> [!TIP] Example
>
> <strong>Input:</strong> `s = "geek"`<br><strong>Output:</strong> `No`<br><strong>Input:</strong> `s = "geegg"`<br><strong>Output:</strong> `Yes (gegeg, eggge, …)`<br><strong>Input:</strong> `s = "aab"`<br><strong>Output:</strong> `Yes (aba)`

Can the characters of `s` be rearranged into a palindrome? Generating every permutation and testing each one is hopeless beyond a handful of characters — `n!` candidates.

```python filename:Python%20%E2%80%94%20naive
from itertools import permutations

def can_be_palindrome(s):
    for perm in permutations(s):           # n! permutations
        t = ''.join(perm)
        if t == t[::-1]:
            return True
    return False

print("Yes" if can_be_palindrome("geek") else "No")
print("Yes" if can_be_palindrome("geegg") else "No")
```

```text filename:Output
No
Yes
```

Time O(n! · n) · Space O(n)

> [!NOTE] Idea
>
> A palindrome pairs every character with its mirror, so each character must occur an <strong>even</strong> number of times — except the single middle character of an odd-length string. Count frequencies in a hash map; the answer is `Yes` iff <strong>at most one</strong> count is odd. (Even length ⇒ zero odd counts; odd length ⇒ exactly one — “at most one” covers both.)

```python filename:Python
def can_be_palindrome(s):
    freq = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    odd = 0
    for count in freq.values():
        if count % 2 == 1:
            odd += 1
            if odd > 1:          # two characters without a partner
                return False
    return True

for s in ["geek", "geegg", "aab", "abc"]:
    print(s, "→", "Yes" if can_be_palindrome(s) else "No")
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <unordered_map>
using namespace std;

bool canBePalindrome(const string& s) {
    unordered_map<char, int> freq;
    for (char ch : s) freq[ch]++;
    int odd = 0;
    for (auto& [ch, count] : freq) {
        if (count % 2 == 1 && ++odd > 1) return false;   // two characters without a partner
    }
    return true;
}

int main() {
    for (string s : {"geek", "geegg", "aab", "abc"})
        cout << s << " → " << (canBePalindrome(s) ? "Yes" : "No") << "\n";
}
```

```java filename:Java
import java.util.HashMap;
import java.util.Map;

public class Main {
    static boolean canBePalindrome(String s) {
        Map<Character, Integer> freq = new HashMap<>();
        for (char ch : s.toCharArray()) freq.merge(ch, 1, Integer::sum);
        int odd = 0;
        for (int count : freq.values()) {
            if (count % 2 == 1 && ++odd > 1) return false;   // two characters without a partner
        }
        return true;
    }

    public static void main(String[] args) {
        for (String s : new String[]{"geek", "geegg", "aab", "abc"})
            System.out.println(s + " → " + (canBePalindrome(s) ? "Yes" : "No"));
    }
}
```

```javascript filename:JavaScript
function canBePalindrome(s) {
    const freq = new Map();
    for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    let odd = 0;
    for (const count of freq.values()) {
        if (count % 2 === 1 && ++odd > 1) return false;   // two characters without a partner
    }
    return true;
}

for (const s of ["geek", "geegg", "aab", "abc"])
    console.log(s, "→", canBePalindrome(s) ? "Yes" : "No");
```

```text filename:Output
geek → No
geegg → Yes
aab → Yes
abc → No
```

Time O(n) · Space O(k) for k distinct characters

> [!NOTE] Key point
>
> For a fixed alphabet a 26- or 256-slot array beats the hash map; for an unbounded alphabet (Unicode) the map is the right tool. A bit-twiddling variant toggles bit `c` in an integer mask and checks `mask & (mask − 1) == 0` at the end.

# Longest subarray with given sum

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [5, 8, -4, -4, 9, -2, 2], sum = 0`<br><strong>Output:</strong> `3 ([8, -4, -4])`<br><strong>Input:</strong> `arr = [3, 1, 0, 1, 8, 2, 3, 6], sum = 5`<br><strong>Output:</strong> `4 ([3, 1, 0, 1])`<br><strong>Input:</strong> `arr = [8, 3, 7], sum = 15`<br><strong>Output:</strong> `0`

Return the length of the longest contiguous subarray whose sum is exactly `S` (`0` if none). Naive: start at every `i`, extend to every `j`, keep the longest hit.

```python filename:Python%20%E2%80%94%20naive
def longest_with_sum(arr, S):
    n, res = len(arr), 0
    for i in range(n):
        s = 0
        for j in range(i, n):
            s += arr[j]
            if s == S:
                res = max(res, j - i + 1)
    return res

print(longest_with_sum([5, 8, -4, -4, 9, -2, 2], 0))
print(longest_with_sum([3, 1, 0, 1, 8, 2, 3, 6], 5))
```

```text filename:Output
3
4
```

Time O(n²) · Space O(1)

> [!NOTE] Idea
>
> Prefix-sum pattern, <em>longest</em> flavour. At index `j`, if `prefix[j] − S` was first seen at index `k`, then `arr[k+1..j]` sums to `S` and has length `j − k`. Store each prefix sum with the <strong>first</strong> index it appeared at and never overwrite it — the earliest start gives the longest subarray. Seeding the map with `0 → −1` handles subarrays that start at index 0 (`prefix[j] == S` gives length `j + 1`).

```python filename:Python
def longest_with_sum(arr, S):
    first = {0: -1}            # prefix sum → first index where it occurred
    prefix = 0
    best = 0
    for j, v in enumerate(arr):
        prefix += v
        if prefix - S in first:                 # subarray (first[prefix-S], j] sums to S
            best = max(best, j - first[prefix - S])
        if prefix not in first:                 # keep the FIRST occurrence only
            first[prefix] = j
    return best

print(longest_with_sum([5, 8, -4, -4, 9, -2, 2], 0))
print(longest_with_sum([3, 1, 0, 1, 8, 2, 3, 6], 5))
print(longest_with_sum([8, 3, 7], 15))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <unordered_map>
#include <vector>
using namespace std;

int longestWithSum(const vector<int>& arr, int S) {
    unordered_map<int, int> first = {{0, -1}};   // prefix sum → first index where it occurred
    int prefix = 0, best = 0;
    int n = arr.size();
    for (int j = 0; j < n; j++) {
        prefix += arr[j];
        auto it = first.find(prefix - S);
        if (it != first.end()) best = max(best, j - it->second);   // subarray (it->second, j] sums to S
        first.try_emplace(prefix, j);            // inserts only if absent → keeps the FIRST occurrence
    }
    return best;
}

int main() {
    cout << longestWithSum({5, 8, -4, -4, 9, -2, 2}, 0) << "\n";
    cout << longestWithSum({3, 1, 0, 1, 8, 2, 3, 6}, 5) << "\n";
    cout << longestWithSum({8, 3, 7}, 15) << "\n";
}
```

```java filename:Java
import java.util.HashMap;
import java.util.Map;

public class Main {
    static int longestWithSum(int[] arr, int S) {
        Map<Integer, Integer> first = new HashMap<>();   // prefix sum → first index where it occurred
        first.put(0, -1);
        int prefix = 0, best = 0;
        for (int j = 0; j < arr.length; j++) {
            prefix += arr[j];
            Integer k = first.get(prefix - S);
            if (k != null) best = Math.max(best, j - k);   // subarray (k, j] sums to S
            first.putIfAbsent(prefix, j);                  // keeps the FIRST occurrence
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println(longestWithSum(new int[]{5, 8, -4, -4, 9, -2, 2}, 0));
        System.out.println(longestWithSum(new int[]{3, 1, 0, 1, 8, 2, 3, 6}, 5));
        System.out.println(longestWithSum(new int[]{8, 3, 7}, 15));
    }
}
```

```javascript filename:JavaScript
function longestWithSum(arr, S) {
    const first = new Map([[0, -1]]);     // prefix sum → first index where it occurred
    let prefix = 0, best = 0;
    for (let j = 0; j < arr.length; j++) {
        prefix += arr[j];
        if (first.has(prefix - S)) best = Math.max(best, j - first.get(prefix - S));  // (k, j] sums to S
        if (!first.has(prefix)) first.set(prefix, j);   // keeps the FIRST occurrence
    }
    return best;
}

console.log(longestWithSum([5, 8, -4, -4, 9, -2, 2], 0));
console.log(longestWithSum([3, 1, 0, 1, 8, 2, 3, 6], 5));
console.log(longestWithSum([8, 3, 7], 15));
```

```text filename:Output
3
4
0
```

Time O(n) · Space O(n)

> [!WARNING] Pitfall
>
> Overwriting `first[prefix]` on every occurrence (or using `first[prefix] = j` unconditionally) gives the <strong>shortest</strong> subarray, not the longest. Also, the two-pointer sliding window only works for arrays without negative numbers — this array has them, so the hash map is required.

# Longest subarray with equal 0s and 1s

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 0, 0, 1, 0, 1, 1]`<br><strong>Output:</strong> `6 ([1, 0, 0, 1, 0, 1] or [0, 0, 1, 0, 1, 1])`<br><strong>Input:</strong> `arr = [1, 1, 1, 0]`<br><strong>Output:</strong> `2`<br><strong>Input:</strong> `arr = [0, 0, 1, 1, 0]`<br><strong>Output:</strong> `4`

In a binary array, find the longest contiguous subarray with as many `0`s as `1`s. The naive version tracks a running `+1 / −1` score from each start.

```python filename:Python%20%E2%80%94%20naive
def longest_equal(arr):
    n, best, start = len(arr), 0, -1
    for i in range(n):
        score = 0
        for j in range(i, n):
            score += 1 if arr[j] == 1 else -1
            if score == 0 and j - i + 1 > best:
                best, start = j - i + 1, i
    if best:
        print("indices", start, "to", start + best - 1)
    return best

print(longest_equal([1, 0, 0, 1, 0, 1, 1]))
```

```text filename:Output
indices 0 to 5
6
```

Time O(n²) · Space O(1)

> [!NOTE] Idea
>
> Treat every `0` as `−1`. A subarray with equal 0s and 1s is then exactly a subarray with <strong>sum 0</strong> — the previous problem with `S = 0`. Only the first index of each prefix sum is kept.

```python filename:Python
def longest_equal(arr):
    first = {0: -1}
    prefix = 0
    best = 0
    for j, bit in enumerate(arr):
        prefix += 1 if bit == 1 else -1      # 0 counts as -1 (the input is not modified)
        if prefix in first:
            best = max(best, j - first[prefix])
        else:
            first[prefix] = j
    return best

for arr in [[1, 0, 0, 1, 0, 1, 1], [1, 1, 1, 0], [0, 0, 1, 1, 0]]:
    print(longest_equal(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <unordered_map>
#include <vector>
using namespace std;

int longestEqual(const vector<int>& arr) {
    unordered_map<int, int> first = {{0, -1}};
    int prefix = 0, best = 0;
    int n = arr.size();
    for (int j = 0; j < n; j++) {
        prefix += arr[j] == 1 ? 1 : -1;        // 0 counts as -1 (the input is not modified)
        auto it = first.find(prefix);
        if (it != first.end()) best = max(best, j - it->second);
        else first[prefix] = j;
    }
    return best;
}

int main() {
    vector<vector<int>> tests = {{1, 0, 0, 1, 0, 1, 1}, {1, 1, 1, 0}, {0, 0, 1, 1, 0}};
    for (auto& arr : tests) cout << longestEqual(arr) << "\n";
}
```

```java filename:Java
import java.util.HashMap;
import java.util.Map;

public class Main {
    static int longestEqual(int[] arr) {
        Map<Integer, Integer> first = new HashMap<>();
        first.put(0, -1);
        int prefix = 0, best = 0;
        for (int j = 0; j < arr.length; j++) {
            prefix += arr[j] == 1 ? 1 : -1;    // 0 counts as -1 (the input is not modified)
            Integer k = first.get(prefix);
            if (k != null) best = Math.max(best, j - k);
            else first.put(prefix, j);
        }
        return best;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 0, 0, 1, 0, 1, 1}, {1, 1, 1, 0}, {0, 0, 1, 1, 0}};
        for (int[] arr : tests) System.out.println(longestEqual(arr));
    }
}
```

```javascript filename:JavaScript
function longestEqual(arr) {
    const first = new Map([[0, -1]]);
    let prefix = 0, best = 0;
    for (let j = 0; j < arr.length; j++) {
        prefix += arr[j] === 1 ? 1 : -1;       // 0 counts as -1 (the input is not modified)
        if (first.has(prefix)) best = Math.max(best, j - first.get(prefix));
        else first.set(prefix, j);
    }
    return best;
}

for (const arr of [[1, 0, 0, 1, 0, 1, 1], [1, 1, 1, 0], [0, 0, 1, 1, 0]])
    console.log(longestEqual(arr));
```

```text filename:Output
6
2
4
```

Time O(n) · Space O(n)

> [!WARNING] Pitfall
>
> The original notes overwrote the input (`arr[i] = -1`) before scanning. Compute the `±1` on the fly instead — callers rarely expect their array to come back changed, and the test harness that prints the input afterwards will expose it.

# Longest common span with same sum in two binary arrays

> [!TIP] Example
>
> <strong>Input:</strong> `a = [0, 1, 0, 0, 0, 0], b = [1, 0, 1, 0, 0, 1]`<br><strong>Output:</strong> `4 (a[1..4] and b[1..4] both sum to 1)`<br><strong>Input:</strong> `a = [0, 0, 0], b = [1, 1, 1]`<br><strong>Output:</strong> `0`<br><strong>Input:</strong> `a = [0, 0, 1, 0], b = [1, 1, 1, 1]`<br><strong>Output:</strong> `1`

Two binary arrays of the same length. Find the longest index range `[i..j]` such that `a[i..j]` and `b[i..j]` have the same sum. Naive: for every start, extend both running sums together.

```python filename:Python%20%E2%80%94%20naive
def longest_common_span(a, b):
    n, res = len(a), 0
    for i in range(n):
        sum_a = sum_b = 0
        for j in range(i, n):
            sum_a += a[j]
            sum_b += b[j]
            if sum_a == sum_b:
                res = max(res, j - i + 1)
    return res

print(longest_common_span([0, 1, 0, 0, 0, 0], [1, 0, 1, 0, 0, 1]))
print(longest_common_span([0, 0, 0], [1, 1, 1]))
```

```text filename:Output
4
0
```

Time O(n²) · Space O(1)

> [!NOTE] Idea
>
> `sum(a[i..j]) == sum(b[i..j])` ⟺ `sum((a − b)[i..j]) == 0`. So build the difference `d[i] = a[i] − b[i]` (values `−1`, `0`, `1`) and find the <strong>longest subarray with sum 0</strong> in it — the same prefix-sum code again.

```text filename:Equal%20prefix%20sums%20of%20a%20%E2%88%92%20b%20at%20indices%200%20and%204%20%E2%87%92%20a%5B1..4%5D%20and%20b%5B1..4%5D%20have%20equal%20sums
a      : [ 0,  1,  0,  0,  0,  0 ]
b      : [ 1,  0,  1,  0,  0,  1 ]
a − b  : [-1,  1, -1,  0,  0, -1 ]
prefix : [-1,  0, -1, -1, -1, -2 ]
           ↑               ↑
     first(-1) = 0      j = 4   →  length 4 − 0 = 4
```

```python filename:Python
def longest_common_span(a, b):
    first = {0: -1}
    prefix = 0
    best = 0
    for j in range(len(a)):
        prefix += a[j] - b[j]         # prefix sum of the difference array
        if prefix in first:
            best = max(best, j - first[prefix])
        else:
            first[prefix] = j
    return best

print(longest_common_span([0, 1, 0, 0, 0, 0], [1, 0, 1, 0, 0, 1]))
print(longest_common_span([0, 0, 0], [1, 1, 1]))
print(longest_common_span([0, 0, 1, 0], [1, 1, 1, 1]))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <unordered_map>
#include <vector>
using namespace std;

int longestCommonSpan(const vector<int>& a, const vector<int>& b) {
    unordered_map<int, int> first = {{0, -1}};
    int prefix = 0, best = 0;
    int n = a.size();
    for (int j = 0; j < n; j++) {
        prefix += a[j] - b[j];               // prefix sum of the difference array
        auto it = first.find(prefix);
        if (it != first.end()) best = max(best, j - it->second);
        else first[prefix] = j;
    }
    return best;
}

int main() {
    cout << longestCommonSpan({0, 1, 0, 0, 0, 0}, {1, 0, 1, 0, 0, 1}) << "\n";
    cout << longestCommonSpan({0, 0, 0}, {1, 1, 1}) << "\n";
    cout << longestCommonSpan({0, 0, 1, 0}, {1, 1, 1, 1}) << "\n";
}
```

```java filename:Java
import java.util.HashMap;
import java.util.Map;

public class Main {
    static int longestCommonSpan(int[] a, int[] b) {
        Map<Integer, Integer> first = new HashMap<>();
        first.put(0, -1);
        int prefix = 0, best = 0;
        for (int j = 0; j < a.length; j++) {
            prefix += a[j] - b[j];           // prefix sum of the difference array
            Integer k = first.get(prefix);
            if (k != null) best = Math.max(best, j - k);
            else first.put(prefix, j);
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println(longestCommonSpan(new int[]{0, 1, 0, 0, 0, 0}, new int[]{1, 0, 1, 0, 0, 1}));
        System.out.println(longestCommonSpan(new int[]{0, 0, 0}, new int[]{1, 1, 1}));
        System.out.println(longestCommonSpan(new int[]{0, 0, 1, 0}, new int[]{1, 1, 1, 1}));
    }
}
```

```javascript filename:JavaScript
function longestCommonSpan(a, b) {
    const first = new Map([[0, -1]]);
    let prefix = 0, best = 0;
    for (let j = 0; j < a.length; j++) {
        prefix += a[j] - b[j];               // prefix sum of the difference array
        if (first.has(prefix)) best = Math.max(best, j - first.get(prefix));
        else first.set(prefix, j);
    }
    return best;
}

console.log(longestCommonSpan([0, 1, 0, 0, 0, 0], [1, 0, 1, 0, 0, 1]));
console.log(longestCommonSpan([0, 0, 0], [1, 1, 1]));
console.log(longestCommonSpan([0, 0, 1, 0], [1, 1, 1, 1]));
```

```text filename:Output
4
0
1
```

Time O(n) · Space O(n)

> [!NOTE] Key point
>
> The difference array has only `2n + 1` possible prefix values (`−n … n`), so an array indexed by `prefix + n` can replace the hash map here — same `O(n)` but no hashing at all. Nothing in the method needs the arrays to be binary; it works for any two integer arrays.

# Longest consecutive subsequence

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [1, 9, 3, 4, 2, 20]`<br><strong>Output:</strong> `4 (1, 2, 3, 4)`<br><strong>Input:</strong> `arr = [8, 20, 7, 30]`<br><strong>Output:</strong> `2 (7, 8)`<br><strong>Input:</strong> `arr = [20, 30, 40]`<br><strong>Output:</strong> `1`

Find the length of the longest run of consecutive integers `x, x+1, x+2, …` whose members all appear in the array — in any order and possibly with duplicates. Sorting makes runs adjacent, which gives an `O(n log n)` solution.

```python filename:Python%20%E2%80%94%20sorting
def longest_consecutive(arr):
    arr = sorted(arr)
    best = run = 1
    for i in range(1, len(arr)):
        if arr[i] == arr[i - 1]:          # duplicate: neither extends nor breaks the run
            continue
        if arr[i] == arr[i - 1] + 1:
            run += 1
        else:
            best = max(best, run)
            run = 1
    return max(best, run)

print(longest_consecutive([1, 9, 3, 4, 2, 20]))
print(longest_consecutive([1, 2, 2, 3]))      # the original notes' version returned 2 here
```

```text filename:Output
4
3
```

Time O(n log n) · Space O(n) for the sorted copy

> [!NOTE] Idea
>
> Put everything in a set. A run `x, x+1, …` can only be <em>counted from its start</em>, and `x` is a start exactly when `x − 1` is <strong>not</strong> in the set. For each start, walk upward while `x + k` is present. Every element is reached by at most one such walk, so the total work is `O(n)` even though there is a nested `while`.

```python filename:Python
def longest_consecutive(arr):
    s = set(arr)
    best = 0
    for x in s:                      # iterate the set: duplicates handled for free
        if x - 1 in s:
            continue                 # not the start of a run
        run = 1
        while x + run in s:          # walk the run upward
            run += 1
        best = max(best, run)
    return best

for arr in [[1, 9, 3, 4, 2, 20], [8, 20, 7, 30], [20, 30, 40]]:
    print(longest_consecutive(arr))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <unordered_set>
#include <vector>
using namespace std;

int longestConsecutive(const vector<int>& arr) {
    unordered_set<int> s(arr.begin(), arr.end());
    int best = 0;
    for (int x : s) {                       // iterate the set: duplicates handled for free
        if (s.count(x - 1)) continue;       // not the start of a run
        int run = 1;
        while (s.count(x + run)) run++;     // walk the run upward
        best = max(best, run);
    }
    return best;
}

int main() {
    vector<vector<int>> tests = {{1, 9, 3, 4, 2, 20}, {8, 20, 7, 30}, {20, 30, 40}};
    for (auto& arr : tests) cout << longestConsecutive(arr) << "\n";
}
```

```java filename:Java
import java.util.HashSet;
import java.util.Set;

public class Main {
    static int longestConsecutive(int[] arr) {
        Set<Integer> s = new HashSet<>();
        for (int x : arr) s.add(x);
        int best = 0;
        for (int x : s) {                            // iterate the set: duplicates handled for free
            if (s.contains(x - 1)) continue;         // not the start of a run
            int run = 1;
            while (s.contains(x + run)) run++;       // walk the run upward
            best = Math.max(best, run);
        }
        return best;
    }

    public static void main(String[] args) {
        int[][] tests = {{1, 9, 3, 4, 2, 20}, {8, 20, 7, 30}, {20, 30, 40}};
        for (int[] arr : tests) System.out.println(longestConsecutive(arr));
    }
}
```

```javascript filename:JavaScript
function longestConsecutive(arr) {
    const s = new Set(arr);
    let best = 0;
    for (const x of s) {                     // iterate the set: duplicates handled for free
        if (s.has(x - 1)) continue;          // not the start of a run
        let run = 1;
        while (s.has(x + run)) run++;        // walk the run upward
        best = Math.max(best, run);
    }
    return best;
}

for (const arr of [[1, 9, 3, 4, 2, 20], [8, 20, 7, 30], [20, 30, 40]])
    console.log(longestConsecutive(arr));
```

```text filename:Output
4
2
1
```

Time O(n) · Space O(n)

> [!WARNING] Pitfall
>
> Without the `x − 1 not in set` test the inner `while` restarts from every element of a run and the algorithm degrades to `O(n²)` on `[1, 2, 3, …, n]`. The check is what makes each run be walked exactly once.

# Count distinct elements in every window

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [10, 20, 20, 10, 30, 40, 10], k = 4`<br><strong>Output:</strong> `2 3 4 3`<br><strong>Input:</strong> `arr = [10, 20, 30, 40], k = 3`<br><strong>Output:</strong> `3 3`

For each of the `n − k + 1` windows of size `k`, print the number of distinct values in it. The naive solution rebuilds a set for every window.

```python filename:Python%20%E2%80%94%20naive
def distinct_in_windows(arr, k):
    n = len(arr)
    return [len(set(arr[i:i + k])) for i in range(n - k + 1)]   # n-k+1 windows, O(k) each

print(*distinct_in_windows([10, 20, 20, 10, 30, 40, 10], 4))
print(*distinct_in_windows([10, 20, 30, 40], 3))
```

```text filename:Output
2 3 4 3
3 3
```

Time O(n · k) · Space O(k)

> [!NOTE] Idea
>
> Consecutive windows differ by one element on each side. Keep a <strong>count map</strong> of the current window: when the window slides, decrement the outgoing element (delete the key when its count hits 0) and increment the incoming one. The number of keys in the map is the answer for that window — maintained in `O(1)` per slide.

```text filename:Each%20slide%20changes%20two%20counts%3B%20the%20map%20size%20is%20the%20answer
arr = [10, 20, 20, 10, 30, 40, 10],  k = 4

window [10 20 20 10]   counts {10:2, 20:2}            → 2
slide:  −10  +30       counts {10:1, 20:2, 30:1}      → 3
slide:  −20  +40       counts {10:1, 20:1, 30:1, 40:1}→ 4
slide:  −20  +10       counts {10:2, 30:1, 40:1}      → 3   (20 dropped to 0 → key removed)
```

```python filename:Python
def distinct_in_windows(arr, k):
    count = {}
    for x in arr[:k]:                      # first window
        count[x] = count.get(x, 0) + 1
    res = [len(count)]
    for i in range(k, len(arr)):
        out, inc = arr[i - k], arr[i]
        count[out] -= 1
        if count[out] == 0:
            del count[out]                 # a key with count 0 must not stay in the map
        count[inc] = count.get(inc, 0) + 1
        res.append(len(count))
    return res

print(" ".join(map(str, distinct_in_windows([10, 20, 20, 10, 30, 40, 10], 4))))
print(" ".join(map(str, distinct_in_windows([10, 20, 30, 40], 3))))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <unordered_map>
#include <vector>
using namespace std;

vector<int> distinctInWindows(const vector<int>& arr, int k) {
    unordered_map<int, int> count;
    int n = arr.size();
    for (int i = 0; i < k; i++) count[arr[i]]++;        // first window
    vector<int> res = {(int)count.size()};
    for (int i = k; i < n; i++) {
        int out = arr[i - k];
        if (--count[out] == 0) count.erase(out);        // a key with count 0 must not stay in the map
        count[arr[i]]++;
        res.push_back((int)count.size());
    }
    return res;
}

void print(const vector<int>& v) {
    for (size_t i = 0; i < v.size(); i++) cout << (i ? " " : "") << v[i];
    cout << "\n";
}

int main() {
    print(distinctInWindows({10, 20, 20, 10, 30, 40, 10}, 4));
    print(distinctInWindows({10, 20, 30, 40}, 3));
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Main {
    static List<Integer> distinctInWindows(int[] arr, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int i = 0; i < k; i++) count.merge(arr[i], 1, Integer::sum);   // first window
        List<Integer> res = new ArrayList<>();
        res.add(count.size());
        for (int i = k; i < arr.length; i++) {
            int out = arr[i - k];
            if (count.merge(out, -1, Integer::sum) == 0) count.remove(out);  // count 0 → remove the key
            count.merge(arr[i], 1, Integer::sum);
            res.add(count.size());
        }
        return res;
    }

    static void print(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        print(distinctInWindows(new int[]{10, 20, 20, 10, 30, 40, 10}, 4));
        print(distinctInWindows(new int[]{10, 20, 30, 40}, 3));
    }
}
```

```javascript filename:JavaScript
function distinctInWindows(arr, k) {
    const count = new Map();
    for (let i = 0; i < k; i++) count.set(arr[i], (count.get(arr[i]) ?? 0) + 1);   // first window
    const res = [count.size];
    for (let i = k; i < arr.length; i++) {
        const out = arr[i - k];
        if (count.get(out) === 1) count.delete(out);        // a key with count 0 must not stay in the map
        else count.set(out, count.get(out) - 1);
        count.set(arr[i], (count.get(arr[i]) ?? 0) + 1);
        res.push(count.size);
    }
    return res;
}

console.log(distinctInWindows([10, 20, 20, 10, 30, 40, 10], 4).join(" "));
console.log(distinctInWindows([10, 20, 30, 40], 3).join(" "));
```

```text filename:Output
2 3 4 3
3 3
```

Time O(n) · Space O(k)

> [!WARNING] Pitfall
>
> Forgetting to <strong>delete</strong> a key whose count reached 0 makes `len(count)` too large — the map still “remembers” a value that left the window. Python's `Counter` has the same trap: `c[x] -= 1` leaves a zero entry behind.

# Elements appearing more than n/k times

> [!TIP] Example
>
> <strong>Input:</strong> `arr = [30, 10, 20, 20, 10, 20, 30, 30], k = 4`<br><strong>Output:</strong> `20 30 (n/k = 2; 20 and 30 appear 3 times)`<br><strong>Input:</strong> `arr = [2, 2, 1, 2, 3, 2], k = 2`<br><strong>Output:</strong> `2 (the majority element)`

Print every value that occurs <strong>strictly more</strong> than `n / k` times (`n / k` with integer division). `k = 2` is the classic <em>majority element</em>. Sorting groups equal values together, so a single pass can count runs:

```python filename:Python%20%E2%80%94%20sorting
def more_than_n_by_k(arr, k):
    arr = sorted(arr)
    n = len(arr)
    res = []
    i = 0
    while i < n:
        j = i
        while j < n and arr[j] == arr[i]:   # end of this run of equal values
            j += 1
        if j - i > n // k:
            res.append(arr[i])
        i = j
    return res

print(*more_than_n_by_k([30, 10, 20, 20, 10, 20, 30, 30], 4))
print(*more_than_n_by_k([2, 2, 1, 2, 3, 2], 2))
```

```text filename:Output
20 30
2
```

Time O(n log n) · Space O(1) extra (in-place sort)

> [!NOTE] Idea
>
> <strong>Hash map of counts.</strong> One pass to count, one pass over the map to report keys with `count > n / k`. The result is sorted before printing because map order is not portable.

```python filename:Python
def more_than_n_by_k(arr, k):
    n = len(arr)
    count = {}
    for x in arr:
        count[x] = count.get(x, 0) + 1
    return sorted(x for x, c in count.items() if c > n // k)   # sort: map order is not portable

print(" ".join(map(str, more_than_n_by_k([30, 10, 20, 20, 10, 20, 30, 30], 4))))
print(" ".join(map(str, more_than_n_by_k([2, 2, 1, 2, 3, 2], 2))))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <unordered_map>
#include <vector>
using namespace std;

vector<int> moreThanNByK(const vector<int>& arr, int k) {
    int n = arr.size();
    unordered_map<int, int> count;
    for (int x : arr) count[x]++;
    vector<int> res;
    for (auto& [x, c] : count)
        if (c > n / k) res.push_back(x);
    sort(res.begin(), res.end());          // sort: map order is not portable
    return res;
}

void print(const vector<int>& v) {
    for (size_t i = 0; i < v.size(); i++) cout << (i ? " " : "") << v[i];
    cout << "\n";
}

int main() {
    print(moreThanNByK({30, 10, 20, 20, 10, 20, 30, 30}, 4));
    print(moreThanNByK({2, 2, 1, 2, 3, 2}, 2));
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Main {
    static List<Integer> moreThanNByK(int[] arr, int k) {
        int n = arr.length;
        Map<Integer, Integer> count = new HashMap<>();
        for (int x : arr) count.merge(x, 1, Integer::sum);
        List<Integer> res = new ArrayList<>();
        for (Map.Entry<Integer, Integer> e : count.entrySet())
            if (e.getValue() > n / k) res.add(e.getKey());
        Collections.sort(res);                 // sort: map order is not portable
        return res;
    }

    static void print(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        print(moreThanNByK(new int[]{30, 10, 20, 20, 10, 20, 30, 30}, 4));
        print(moreThanNByK(new int[]{2, 2, 1, 2, 3, 2}, 2));
    }
}
```

```javascript filename:JavaScript
function moreThanNByK(arr, k) {
    const n = arr.length;
    const count = new Map();
    for (const x of arr) count.set(x, (count.get(x) ?? 0) + 1);
    const res = [];
    for (const [x, c] of count)
        if (c > Math.floor(n / k)) res.push(x);
    return res.sort((a, b) => a - b);          // sort: map order is not portable
}

console.log(moreThanNByK([30, 10, 20, 20, 10, 20, 30, 30], 4).join(" "));
console.log(moreThanNByK([2, 2, 1, 2, 3, 2], 2).join(" "));
```

```text filename:Output
20 30
2
```

Time O(n) · Space O(n)

<strong>Space-efficient method — </strong><strong>`O(nk)`</strong><strong> time, </strong><strong>`O(k)`</strong><strong> space.</strong> At most `k − 1` values can appear more than `n / k` times (if `k` of them did, they would add up to more than `n` elements). So it is enough to track <strong>`k − 1`</strong><strong> candidates</strong>, in the style of the Boyer–Moore majority vote:

1. <strong>Candidate seen again</strong>

   If `arr[i]` is already a candidate, increment its count.

2. <strong>Room for a new candidate</strong>

   If fewer than `k − 1` candidates are stored, add `arr[i]` with count 1.

3. <strong>Table full</strong>

   Otherwise decrement <strong>every</strong> candidate's count and drop the ones that reach 0. This “cancels” `k` distinct values at once — the `k − 1` candidates and `arr[i]`.

4. <strong>Verify</strong>

   A value with more than `n / k` occurrences cannot be cancelled away (each cancellation round consumes `k` distinct elements, so there are fewer than `n / k` rounds), but a survivor is not guaranteed to be frequent. Recount the real occurrences of each survivor in a second pass and keep those above `n / k`.

```python filename:Python
def more_than_n_by_k(arr, k):
    n = len(arr)
    cand = {}                                  # at most k-1 candidates
    for x in arr:
        if x in cand:
            cand[x] += 1
        elif len(cand) < k - 1:
            cand[x] = 1
        else:                                  # table full: cancel k distinct values
            for key in list(cand):
                cand[key] -= 1
                if cand[key] == 0:
                    del cand[key]
    for key in cand:                           # second pass: real counts of the survivors
        cand[key] = 0
    for x in arr:
        if x in cand:
            cand[x] += 1
    return sorted(x for x, c in cand.items() if c > n // k)

print(" ".join(map(str, more_than_n_by_k([30, 10, 20, 20, 10, 20, 30, 30], 4))))
print(" ".join(map(str, more_than_n_by_k([2, 2, 1, 2, 3, 2], 2))))
```

```cpp filename:C%2B%2B
#include <algorithm>
#include <iostream>
#include <unordered_map>
#include <vector>
using namespace std;

vector<int> moreThanNByK(const vector<int>& arr, int k) {
    int n = arr.size();
    unordered_map<int, int> cand;                        // at most k-1 candidates
    for (int x : arr) {
        auto it = cand.find(x);
        if (it != cand.end()) it->second++;
        else if ((int)cand.size() < k - 1) cand[x] = 1;
        else {                                           // table full: cancel k distinct values
            for (auto c = cand.begin(); c != cand.end();) {
                if (--c->second == 0) c = cand.erase(c);
                else ++c;
            }
        }
    }
    for (auto& [key, c] : cand) c = 0;                   // second pass: real counts of the survivors
    for (int x : arr) {
        auto it = cand.find(x);
        if (it != cand.end()) it->second++;
    }
    vector<int> res;
    for (auto& [x, c] : cand) if (c > n / k) res.push_back(x);
    sort(res.begin(), res.end());
    return res;
}

void print(const vector<int>& v) {
    for (size_t i = 0; i < v.size(); i++) cout << (i ? " " : "") << v[i];
    cout << "\n";
}

int main() {
    print(moreThanNByK({30, 10, 20, 20, 10, 20, 30, 30}, 4));
    print(moreThanNByK({2, 2, 1, 2, 3, 2}, 2));
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class Main {
    static List<Integer> moreThanNByK(int[] arr, int k) {
        int n = arr.length;
        Map<Integer, Integer> cand = new HashMap<>();            // at most k-1 candidates
        for (int x : arr) {
            if (cand.containsKey(x)) cand.merge(x, 1, Integer::sum);
            else if (cand.size() < k - 1) cand.put(x, 1);
            else {                                               // table full: cancel k distinct values
                Iterator<Map.Entry<Integer, Integer>> it = cand.entrySet().iterator();
                while (it.hasNext()) {
                    Map.Entry<Integer, Integer> e = it.next();
                    if (e.getValue() == 1) it.remove();
                    else e.setValue(e.getValue() - 1);
                }
            }
        }
        for (Map.Entry<Integer, Integer> e : cand.entrySet()) e.setValue(0);   // second pass
        for (int x : arr) if (cand.containsKey(x)) cand.merge(x, 1, Integer::sum);
        List<Integer> res = new ArrayList<>();
        for (Map.Entry<Integer, Integer> e : cand.entrySet())
            if (e.getValue() > n / k) res.add(e.getKey());
        Collections.sort(res);
        return res;
    }

    static void print(List<Integer> v) {
        StringBuilder sb = new StringBuilder();
        for (int x : v) sb.append(sb.length() == 0 ? "" : " ").append(x);
        System.out.println(sb);
    }

    public static void main(String[] args) {
        print(moreThanNByK(new int[]{30, 10, 20, 20, 10, 20, 30, 30}, 4));
        print(moreThanNByK(new int[]{2, 2, 1, 2, 3, 2}, 2));
    }
}
```

```javascript filename:JavaScript
function moreThanNByK(arr, k) {
    const n = arr.length;
    const cand = new Map();                                // at most k-1 candidates
    for (const x of arr) {
        if (cand.has(x)) cand.set(x, cand.get(x) + 1);
        else if (cand.size < k - 1) cand.set(x, 1);
        else {                                             // table full: cancel k distinct values
            for (const [key, c] of [...cand]) {
                if (c === 1) cand.delete(key);
                else cand.set(key, c - 1);
            }
        }
    }
    for (const key of cand.keys()) cand.set(key, 0);       // second pass: real counts of the survivors
    for (const x of arr) if (cand.has(x)) cand.set(x, cand.get(x) + 1);
    const res = [];
    for (const [x, c] of cand) if (c > Math.floor(n / k)) res.push(x);
    return res.sort((a, b) => a - b);
}

console.log(moreThanNByK([30, 10, 20, 20, 10, 20, 30, 30], 4).join(" "));
console.log(moreThanNByK([2, 2, 1, 2, 3, 2], 2).join(" "));
```

```text filename:Output
20 30
2
```

Time O(n · k) · Space O(k)

> [!WARNING] Pitfall
>
> Skipping the <strong>second pass</strong> is the classic error: the candidate table can hold values that are <em>not</em> frequent (every element of `[1, 2, 3, 4]` with `k = 4` survives the first pass, yet none appears more than once). Candidates are only <em>possible</em> answers.

# Interview Q&amp;A

```question
Why do the “longest subarray” problems store the first index of each prefix sum, while “subarray exists” only needs a set?

---

Existence needs one bit of information: <em>has this prefix sum appeared?</em> Longest needs <em>where did it first appear?</em> — the earliest index gives the longest span ending at the current position, so the map must never overwrite an existing key. A third variant, <em>count the subarrays with sum S</em>, stores <strong>how many times</strong> each prefix sum appeared and adds that count at every step.
```

```question
What is the worst-case time of these solutions, and does it matter?

---

Hash table operations are `O(1)` on average but `O(n)` in the worst case (all keys collide), so every “`O(n)`” above is really expected time. With the built-in hash functions and random-looking data this never bites; in adversarial settings (competitive programming hacks, untrusted input) use a randomised hash or fall back to sorting (`O(n log n)` guaranteed).
```

```question
When would you choose sorting over hashing for these problems?

---

When memory is tight (sorting can be in place, a hash table costs `O(n)` extra), when you need the output in order anyway, or when the keys are hard to hash (floating point, large composite objects). Union/intersection of arrays that are <em>already sorted</em> are `O(m + n)` with two pointers and need no hash table at all.
```

```question
The 0/1 subarray problem and the common-span problem look different from “subarray with sum 0” — how do you spot the reduction?

---

Ask what <em>equal counts</em> means arithmetically: equal 0s and 1s ⇔ `Σ(+1 for 1, −1 for 0) = 0`; equal sums in `a` and `b` ⇔ `Σ(a[i] − b[i]) = 0`. Whenever a condition can be written as <em>some derived array sums to 0 (or to S) over a range</em>, the prefix-sum + hash map template applies unchanged.
```

```question
Explain why the n/k candidate method needs only k − 1 slots.

---

If `k` different values each appeared more than `n / k` times, together they would account for more than `n` elements, which is impossible. Hence at most `k − 1` values can qualify, and a table of `k − 1` counters suffices to track every possible answer — the same argument that gives the single counter of Boyer–Moore majority voting for `k = 2`.
```
