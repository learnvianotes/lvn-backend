---
id: c8ed4436-b1df-7274-9ca0-6cbec15b1df8
key: problem:sheet-150/lc-3
subject: sheet-150
topic: sliding-window
title: Longest Substring Without Repeating Characters
slug: longest-substring-without-repeating-characters
order: 3
---

Difficulty: <strong>Medium</strong> · [LeetCode 3](https://leetcode.com/problems/longest-substring-without-repeating-characters/)

# Problem

Given a string `s`, find the length of the longest substring without repeating characters.

# Understanding the problem

All characters in window must be distinct.

# Intuition

Variable-size sliding window with a set. Expand right pointer, shrink left pointer when duplicate encountered.

# Approach

1. Maintain hash set `seen` and `left = 0` pointer.
2. For `right` in range len(s):
3. While `s[right] in seen`, remove `s[left]` from set and increment `left`.
4. Add `s[right]` to set, update `answer = max(answer, right - left + 1)`.

# Naive Solution — Brute Force

Check every substring with a set to see if it has duplicates.

```python filename:Python
class Solution:
    def lengthOfLongestSubstring(self, s):
        answer = 0

        for i in range(len(s)):
            seen = set()

            for j in range(i, len(s)):
                if s[j] in seen:
                    break

                seen.add(s[j])
                answer = max(
                    answer,
                    j - i + 1
                )

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        int answer = 0;
        for (int i = 0; i < s.size(); i++) {
            unordered_set<char> seen;
            for (int j = i; j < s.size(); j++) {
                if (seen.count(s[j])) break;
                seen.insert(s[j]);
                answer = max(answer, j - i + 1);
            }
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int lengthOfLongestSubstring(String s) {
        int answer = 0;
        for (int i = 0; i < s.length(); i++) {
            Set<Character> seen = new HashSet<>();
            for (int j = i; j < s.length(); j++) {
                if (seen.contains(s.charAt(j))) break;
                seen.add(s.charAt(j));
                answer = Math.max(answer, j - i + 1);
            }
        }
        return answer;
    }
}
```

```javascript filename:JavaScript
var lengthOfLongestSubstring = function(s) {
    let answer = 0;
    for (let i = 0; i < s.length; i++) {
        const seen = new Set();
        for (let j = i; j < s.length; j++) {
            if (seen.has(s[j])) break;
            seen.add(s[j]);
            answer = Math.max(answer, j - i + 1);
        }
    }
    return answer;
};
```

<strong>Time: O(n²) · Space: O(k)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def lengthOfLongestSubstring(self, s):
        seen = set()

        left = 0
        answer = 0

        for right in range(len(s)):

            while s[right] in seen:
                seen.remove(s[left])
                left += 1

            seen.add(s[right])

            answer = max(
                answer,
                right - left + 1
            )

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_set<char> seen;
        int left = 0, answer = 0;
        for (int right = 0; right < s.size(); right++) {
            while (seen.count(s[right])) {
                seen.erase(s[left]);
                left++;
            }
            seen.insert(s[right]);
            answer = max(answer, right - left + 1);
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int lengthOfLongestSubstring(String s) {
        Set<Character> seen = new HashSet<>();
        int left = 0, answer = 0;
        for (int right = 0; right < s.length(); right++) {
            while (seen.contains(s.charAt(right))) {
                seen.remove(s.charAt(left));
                left++;
            }
            seen.add(s.charAt(right));
            answer = Math.max(answer, right - left + 1);
        }
        return answer;
    }
}
```

```javascript filename:JavaScript
var lengthOfLongestSubstring = function(s) {
    const seen = new Set();
    let left = 0, answer = 0;
    for (let right = 0; right < s.length; right++) {
        while (seen.has(s[right])) {
            seen.delete(s[left]);
            left++;
        }
        seen.add(s[right]);
        answer = Math.max(answer, right - left + 1);
    }
    return answer;
};
```

<strong>Time: O(n) · Space: O(k)</strong>

# Takeaway

<strong>Pattern</strong> — Variable-size Sliding Window + Hash Set
