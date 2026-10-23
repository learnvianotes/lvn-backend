---
id: f2ff7ea0-7d62-7abe-a1ff-8f3d0021c1bd
key: problem:sheet-150/lc-76
subject: sheet-150
topic: sliding-window
title: Minimum Window Substring
slug: minimum-window-substring
order: 6
---

Difficulty: <strong>Hard</strong> · [LeetCode 76](https://leetcode.com/problems/minimum-window-substring/)

# Problem

Given two strings `s` and `t`, return minimum window substring in `s` containing all characters of `t`.

# Understanding the problem

Find shortest substring of `s` covering all character counts required by `t`.

# Intuition

Expand right pointer until window is valid (tracking `formed == required`). Then shrink left pointer while valid to find minimum length.

# Approach

1. Build `need` frequency map for `t`, tracking `required = len(need)`.
2. Expand `right` pointer and update `have` map.
3. Increment `formed` when `have[char] == need[char]`.
4. While `formed == required`: record best window, remove `s[left]`, decrement `formed` if needed, and advance `left += 1`.

# Naive Solution — Brute Force

Try every substring, verify if character counts meet requirements of t.

```python filename:Python
class Solution:
    def minWindow(self, s, t):
        if not t:
            return ""

        answer = ""

        for left in range(len(s)):
            count = {}

            for right in range(left, len(s)):
                count[s[right]] = (
                    count.get(s[right], 0) + 1
                )

                valid = True

                for char in t:
                    if count.get(char, 0) < t.count(char):
                        valid = False
                        break

                if valid:
                    current = s[left:right + 1]

                    if (
                        not answer
                        or len(current) < len(answer)
                    ):
                        answer = current

                    break

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    string minWindow(string s, string t) {
        if (t.empty()) return "";
        string answer = "";
        for (int left = 0; left < s.size(); left++) {
            unordered_map<char, int> count;
            for (int right = left; right < s.size(); right++) {
                count[s[right]]++;
                bool valid = true;
                for (char c : t)
                    if (count[c] < std::count(t.begin(), t.end(), c)) {
                        valid = false;
                        break;
                    }
                if (valid) {
                    string current = s.substr(left, right - left + 1);
                    if (answer.empty() || current.size() < answer.size()) answer = current;
                    break;
                }
            }
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public String minWindow(String s, String t) {
        if (t.isEmpty()) return "";
        String answer = "";
        for (int left = 0; left < s.length(); left++) {
            Map<Character, Integer> count = new HashMap<>();
            for (int right = left; right < s.length(); right++) {
                count.put(s.charAt(right), count.getOrDefault(s.charAt(right), 0) + 1);
                boolean valid = true;
                for (char c : t.toCharArray())
                    if (count.getOrDefault(c, 0) < countOf(t, c)) {
                        valid = false;
                        break;
                    }
                if (valid) {
                    String current = s.substring(left, right + 1);
                    if (answer.isEmpty() || current.length() < answer.length()) answer = current;
                    break;
                }
            }
        }
        return answer;
    }

    private int countOf(String t, char c) {
        int n = 0;
        for (char x : t.toCharArray()) if (x == c) n++;
        return n;
    }
}
```

```javascript filename:JavaScript
var minWindow = function(s, t) {
    if (!t) return "";
    const countOf = c => t.split(c).length - 1;
    let answer = "";
    for (let left = 0; left < s.length; left++) {
        const count = new Map();
        for (let right = left; right < s.length; right++) {
            count.set(s[right], (count.get(s[right]) || 0) + 1);
            let valid = true;
            for (const c of t)
                if ((count.get(c) || 0) < countOf(c)) {
                    valid = false;
                    break;
                }
            if (valid) {
                const current = s.slice(left, right + 1);
                if (!answer || current.length < answer.length) answer = current;
                break;
            }
        }
    }
    return answer;
};
```

<strong>Time: O(n² × k) · Space: O(k)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def minWindow(self, s, t):
        if not t:
            return ""

        need = {}

        for char in t:
            need[char] = need.get(char, 0) + 1

        have = {}
        required = len(need)
        formed = 0

        left = 0

        best_length = float("inf")
        best_start = 0

        for right in range(len(s)):
            char = s[right]

            have[char] = have.get(char, 0) + 1

            if (
                char in need
                and have[char] == need[char]
            ):
                formed += 1

            while formed == required:
                if (
                    right - left + 1
                    < best_length
                ):
                    best_length = right - left + 1
                    best_start = left

                left_char = s[left]
                have[left_char] -= 1

                if (
                    left_char in need
                    and have[left_char] < need[left_char]
                ):
                    formed -= 1

                left += 1

        if best_length == float("inf"):
            return ""

        return s[
            best_start:
            best_start + best_length
        ]
```

```cpp filename:C%2B%2B
class Solution {
public:
    string minWindow(string s, string t) {
        if (t.empty()) return "";
        unordered_map<char, int> need, have;
        for (char c : t) need[c]++;
        int required = need.size(), formed = 0;
        int left = 0, bestLength = INT_MAX, bestStart = 0;
        for (int right = 0; right < s.size(); right++) {
            char c = s[right];
            have[c]++;
            if (need.count(c) && have[c] == need[c]) formed++;
            while (formed == required) {
                if (right - left + 1 < bestLength) {
                    bestLength = right - left + 1;
                    bestStart = left;
                }
                char leftChar = s[left];
                have[leftChar]--;
                if (need.count(leftChar) && have[leftChar] < need[leftChar]) formed--;
                left++;
            }
        }
        if (bestLength == INT_MAX) return "";
        return s.substr(bestStart, bestLength);
    }
};
```

```java filename:Java
class Solution {
    public String minWindow(String s, String t) {
        if (t.isEmpty()) return "";
        Map<Character, Integer> need = new HashMap<>(), have = new HashMap<>();
        for (char c : t.toCharArray()) need.put(c, need.getOrDefault(c, 0) + 1);
        int required = need.size(), formed = 0;
        int left = 0, bestLength = Integer.MAX_VALUE, bestStart = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            have.put(c, have.getOrDefault(c, 0) + 1);
            if (need.containsKey(c) && have.get(c).equals(need.get(c))) formed++;
            while (formed == required) {
                if (right - left + 1 < bestLength) {
                    bestLength = right - left + 1;
                    bestStart = left;
                }
                char leftChar = s.charAt(left);
                have.put(leftChar, have.get(leftChar) - 1);
                if (need.containsKey(leftChar) && have.get(leftChar) < need.get(leftChar)) formed--;
                left++;
            }
        }
        if (bestLength == Integer.MAX_VALUE) return "";
        return s.substring(bestStart, bestStart + bestLength);
    }
}
```

```javascript filename:JavaScript
var minWindow = function(s, t) {
    if (!t) return "";
    const need = new Map(), have = new Map();
    for (const c of t) need.set(c, (need.get(c) || 0) + 1);
    const required = need.size;
    let formed = 0, left = 0, bestLength = Infinity, bestStart = 0;
    for (let right = 0; right < s.length; right++) {
        const c = s[right];
        have.set(c, (have.get(c) || 0) + 1);
        if (need.has(c) && have.get(c) === need.get(c)) formed++;
        while (formed === required) {
            if (right - left + 1 < bestLength) {
                bestLength = right - left + 1;
                bestStart = left;
            }
            const leftChar = s[left];
            have.set(leftChar, have.get(leftChar) - 1);
            if (need.has(leftChar) && have.get(leftChar) < need.get(leftChar)) formed--;
            left++;
        }
    }
    if (bestLength === Infinity) return "";
    return s.slice(bestStart, bestStart + bestLength);
};
```

<strong>Time: O(n) · Space: O(k)</strong>

# Takeaway

<strong>Pattern</strong> — Expand until valid → Shrink while valid
