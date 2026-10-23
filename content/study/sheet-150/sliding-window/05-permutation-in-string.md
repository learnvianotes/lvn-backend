---
id: 5e3cf664-6367-7f27-9cdc-01c4f5fab404
key: problem:sheet-150/lc-567
subject: sheet-150
topic: sliding-window
title: Permutation in String
slug: permutation-in-string
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 567](https://leetcode.com/problems/permutation-in-string/)

# Problem

Given two strings `s1` and `s2`, return `true` if `s2` contains a permutation of `s1`.

# Understanding the problem

Check if any window in `s2` of size `len(s1)` has identical character frequencies to `s1`.

# Intuition

Fixed-size sliding window of length `len(s1)` using character frequency array comparison.

# Approach

1. Build target 26-element array for `s1`.
2. Slide window of size `len(s1)` over `s2`.
3. Add incoming character, remove outgoing character when index &gt;= len(s1).
4. If window array equals target array, return `True`.

# Naive Solution — Brute Force

Generate all permutations of s1 and search for each in s2.

```python filename:Python
from itertools import permutations

class Solution:
    def checkInclusion(self, s1, s2):
        target = set(
            "".join(p)
            for p in permutations(s1)
        )

        length = len(s1)

        for i in range(
            len(s2) - length + 1
        ):
            if s2[i:i + length] in target:
                return True

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool checkInclusion(string s1, string s2) {
        unordered_set<string> target;
        sort(s1.begin(), s1.end());
        do target.insert(s1); while (next_permutation(s1.begin(), s1.end()));
        int length = s1.size();
        for (int i = 0; i + length <= (int)s2.size(); i++)
            if (target.count(s2.substr(i, length))) return true;
        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean checkInclusion(String s1, String s2) {
        Set<String> target = new HashSet<>();
        permute(s1.toCharArray(), 0, target);
        int length = s1.length();
        for (int i = 0; i + length <= s2.length(); i++)
            if (target.contains(s2.substring(i, i + length))) return true;
        return false;
    }

    private void permute(char[] chars, int start, Set<String> target) {
        if (start == chars.length) { target.add(new String(chars)); return; }
        for (int i = start; i < chars.length; i++) {
            char t = chars[start]; chars[start] = chars[i]; chars[i] = t;
            permute(chars, start + 1, target);
            t = chars[start]; chars[start] = chars[i]; chars[i] = t;
        }
    }
}
```

```javascript filename:JavaScript
var checkInclusion = function(s1, s2) {
    const target = new Set();
    const permute = (prefix, rest) => {
        if (!rest) { target.add(prefix); return; }
        for (let i = 0; i < rest.length; i++)
            permute(prefix + rest[i], rest.slice(0, i) + rest.slice(i + 1));
    };
    permute("", s1);
    const length = s1.length;
    for (let i = 0; i + length <= s2.length; i++)
        if (target.has(s2.slice(i, i + length))) return true;
    return false;
};
```

<strong>Time: O(n! × n) · Space: O(n! × n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def checkInclusion(self, s1, s2):
        if len(s1) > len(s2):
            return False

        target = [0] * 26
        window = [0] * 26

        for char in s1:
            target[
                ord(char) - ord('a')
            ] += 1

        for i in range(len(s2)):
            window[
                ord(s2[i]) - ord('a')
            ] += 1

            if i >= len(s1):
                window[
                    ord(s2[i - len(s1)]) - ord('a')
                ] -= 1

            if window == target:
                return True

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool checkInclusion(string s1, string s2) {
        if (s1.size() > s2.size()) return false;
        vector<int> target(26, 0), window(26, 0);
        for (char c : s1) target[c - 'a']++;
        for (int i = 0; i < s2.size(); i++) {
            window[s2[i] - 'a']++;
            if (i >= s1.size()) window[s2[i - s1.size()] - 'a']--;
            if (window == target) return true;
        }
        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean checkInclusion(String s1, String s2) {
        if (s1.length() > s2.length()) return false;
        int[] target = new int[26], window = new int[26];
        for (char c : s1.toCharArray()) target[c - 'a']++;
        for (int i = 0; i < s2.length(); i++) {
            window[s2.charAt(i) - 'a']++;
            if (i >= s1.length()) window[s2.charAt(i - s1.length()) - 'a']--;
            if (Arrays.equals(window, target)) return true;
        }
        return false;
    }
}
```

```javascript filename:JavaScript
var checkInclusion = function(s1, s2) {
    if (s1.length > s2.length) return false;
    const target = new Array(26).fill(0), window = new Array(26).fill(0);
    const idx = c => c.charCodeAt(0) - 97;
    for (const c of s1) target[idx(c)]++;
    for (let i = 0; i < s2.length; i++) {
        window[idx(s2[i])]++;
        if (i >= s1.length) window[idx(s2[i - s1.length])]--;
        if (window.every((v, j) => v === target[j])) return true;
    }
    return false;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Fixed-size Window + Character Frequency Array Comparison
