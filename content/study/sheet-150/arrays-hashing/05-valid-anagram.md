---
id: c618ce0e-6b1c-7e70-8e54-134ab0d53fc9
key: problem:sheet-150/lc-242
subject: sheet-150
topic: arrays-hashing
title: Valid Anagram
slug: valid-anagram
order: 5
---

Difficulty: <strong>Easy</strong> · [LeetCode 242](https://leetcode.com/problems/valid-anagram/)

# Problem

Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`. An anagram uses the exact same characters with identical frequencies.

# Examples

Input

`s, t: str` (lowercase English letters)<br>1 ≤ len ≤ 5×10<sup>4</sup>

Output

`boolean` — true if anagram

> [!NOTE]
>
> Example 1
>
> s="anagram", t="nagaram"
>
> Output: true

> [!NOTE]
>
> Example 2
>
> s="rat", t="car"
>
> Output: false

# Constraints

- `1 ≤ s.length, t.length ≤ 5×10`<sup>`4`</sup>
- s and t consist of lowercase English letters

# Understanding the problem

Anagrams share identical character frequency distributions. Quick check: if lengths differ, immediately false. Then compare frequency maps — a hashmap/counter approach is O(n).

# Intuition

Count character frequencies with a hashmap. Two strings are anagrams iff their frequency maps are identical. Single O(n) pass instead of O(n log n) sort.

# Approach

1. If `len(s) != len(t)` → return False.
2. Build frequency map for `s`.
3. For each char in `t`, decrement its count.
4. If any count goes negative → return False.
5. Return True.

# Naive Solution — Sorting

Sort both strings. If anagrams, sorted versions are equal.

> [!TIP] Expected Output
>
> "anagram","nagaram" → true | "rat","car" → false

```python filename:Python
class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        return sorted(s) == sorted(t)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isAnagram(string s, string t) {
        sort(s.begin(), s.end());
        sort(t.begin(), t.end());
        return s == t;
    }
};
```

```java filename:Java
class Solution {
    public boolean isAnagram(String s, String t) {
        char[] a = s.toCharArray(), b = t.toCharArray();
        Arrays.sort(a);
        Arrays.sort(b);
        return Arrays.equals(a, b);
    }
}
```

```javascript filename:JavaScript
var isAnagram = function(s, t) {
    return s.split('').sort().join('') === t.split('').sort().join('');
};
```

<strong>Time: O(n log n) · Space: O(1)</strong>

# Optimized Code — HashMap O(n)

> [!TIP] Expected Output
>
> "anagram","nagaram" → true | "rat","car" → false

```python filename:Python
from collections import Counter
class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        return Counter(s) == Counter(t)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isAnagram(string s, string t) {
        if (s.size() != t.size()) return false;
        int count[26] = {};
        for (char c : s) count[c-'a']++;
        for (char c : t) if (--count[c-'a'] < 0) return false;
        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (char c : s.toCharArray()) count[c-'a']++;
        for (char c : t.toCharArray()) if (--count[c-'a'] < 0) return false;
        return true;
    }
}
```

```javascript filename:JavaScript
var isAnagram = function(s, t) {
    if (s.length !== t.length) return false;
    const map = {};
    for (const c of s) map[c] = (map[c]||0) + 1;
    for (const c of t) { if (!map[c]) return false; map[c]--; }
    return true;
};
```

<strong>Time: O(n) · Space: O(1)\*</strong>

# Variants

> [!NOTE]
>
> Method 1 — Counter · O(n) / O(1) ✓
>
> `Counter(s) == Counter(t)` — cleanest Python one-liner.

> [!NOTE]
>
> Method 2 — Fixed Array\[26\] · O(n) / O(1)
>
> Integer array of size 26. Faster in practice due to cache locality.

> [!NOTE]
>
> Method 3 — Sorting · O(n log n) / O(1)
>
> Sort both strings and compare. Simple but suboptimal.

# Takeaway

<strong>Pattern: Character Frequency Map</strong> — "Same characters, different order" → compare frequency maps. Applies to anagram detection, permutation checking, group-by-signature problems.
