---
id: 8d58e96c-30ee-7ea1-91b5-c7457c5a6129
key: problem:sheet-150/lc-424
subject: sheet-150
topic: sliding-window
title: Longest Repeating Character Replacement
slug: longest-repeating-character-replacement
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 424](https://leetcode.com/problems/longest-repeating-character-replacement/)

# Problem

Given a string `s` and integer `k`, choose any character and change it up to `k` times to get the longest substring containing identical letters.

# Understanding the problem

Window is valid if `(window_length - max_character_frequency) <= k`.

# Intuition

Maintain sliding window tracking frequency of most frequent character in current window. Shrink left pointer when invalid.

# Approach

1. Use frequency map `count` and track `max_frequency`.
2. Expand `right` pointer and update count and max\_frequency.
3. While `(right - left + 1) - max_frequency > k`, decrement count of `s[left]` and advance `left += 1`.
4. Update `answer = max(answer, right - left + 1)`.

# Naive Solution — Brute Force

Check all substrings, count character frequencies, check if replacements &lt;= k.

```python filename:Python
class Solution:
    def characterReplacement(self, s, k):
        answer = 0

        for left in range(len(s)):
            count = {}

            for right in range(left, len(s)):
                count[s[right]] = (
                    count.get(s[right], 0) + 1
                )

                length = right - left + 1
                most_frequent = max(count.values())

                if length - most_frequent <= k:
                    answer = max(answer, length)

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int characterReplacement(string s, int k) {
        int answer = 0;
        for (int left = 0; left < s.size(); left++) {
            unordered_map<char, int> count;
            for (int right = left; right < s.size(); right++) {
                count[s[right]]++;
                int length = right - left + 1;
                int mostFrequent = 0;
                for (auto& [ch, c] : count) mostFrequent = max(mostFrequent, c);
                if (length - mostFrequent <= k) answer = max(answer, length);
            }
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int characterReplacement(String s, int k) {
        int answer = 0;
        for (int left = 0; left < s.length(); left++) {
            Map<Character, Integer> count = new HashMap<>();
            for (int right = left; right < s.length(); right++) {
                count.put(s.charAt(right), count.getOrDefault(s.charAt(right), 0) + 1);
                int length = right - left + 1;
                int mostFrequent = Collections.max(count.values());
                if (length - mostFrequent <= k) answer = Math.max(answer, length);
            }
        }
        return answer;
    }
}
```

```javascript filename:JavaScript
var characterReplacement = function(s, k) {
    let answer = 0;
    for (let left = 0; left < s.length; left++) {
        const count = new Map();
        for (let right = left; right < s.length; right++) {
            count.set(s[right], (count.get(s[right]) || 0) + 1);
            const length = right - left + 1;
            const mostFrequent = Math.max(...count.values());
            if (length - mostFrequent <= k) answer = Math.max(answer, length);
        }
    }
    return answer;
};
```

<strong>Time: O(n²) · Space: O(k)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def characterReplacement(self, s, k):
        count = {}

        left = 0
        max_frequency = 0
        answer = 0

        for right in range(len(s)):
            count[s[right]] = (
                count.get(s[right], 0) + 1
            )

            max_frequency = max(
                max_frequency,
                count[s[right]]
            )

            while (
                right - left + 1
                - max_frequency
                > k
            ):
                count[s[left]] -= 1
                left += 1

            answer = max(
                answer,
                right - left + 1
            )

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int characterReplacement(string s, int k) {
        unordered_map<char, int> count;
        int left = 0, maxFrequency = 0, answer = 0;
        for (int right = 0; right < s.size(); right++) {
            count[s[right]]++;
            maxFrequency = max(maxFrequency, count[s[right]]);
            while (right - left + 1 - maxFrequency > k) {
                count[s[left]]--;
                left++;
            }
            answer = max(answer, right - left + 1);
        }
        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int characterReplacement(String s, int k) {
        Map<Character, Integer> count = new HashMap<>();
        int left = 0, maxFrequency = 0, answer = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            count.put(c, count.getOrDefault(c, 0) + 1);
            maxFrequency = Math.max(maxFrequency, count.get(c));
            while (right - left + 1 - maxFrequency > k) {
                count.put(s.charAt(left), count.get(s.charAt(left)) - 1);
                left++;
            }
            answer = Math.max(answer, right - left + 1);
        }
        return answer;
    }
}
```

```javascript filename:JavaScript
var characterReplacement = function(s, k) {
    const count = new Map();
    let left = 0, maxFrequency = 0, answer = 0;
    for (let right = 0; right < s.length; right++) {
        count.set(s[right], (count.get(s[right]) || 0) + 1);
        maxFrequency = Math.max(maxFrequency, count.get(s[right]));
        while (right - left + 1 - maxFrequency > k) {
            count.set(s[left], count.get(s[left]) - 1);
            left++;
        }
        answer = Math.max(answer, right - left + 1);
    }
    return answer;
};
```

<strong>Time: O(n) · Space: O(k)</strong>

# Takeaway

<strong>Pattern</strong> — Valid Window Condition: window\_length - max\_frequency &lt;= k
