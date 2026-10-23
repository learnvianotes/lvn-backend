---
id: 9e3cf977-52a7-7ba0-b0c0-9648b76255d6
key: problem:sheet-150/lc-763
subject: sheet-150
topic: greedy
title: Partition Labels
slug: partition-labels
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 763](https://leetcode.com/problems/partition-labels/)

# Problem

Given string `s`, partition it into as many parts as possible so that each letter appears in at most one part. Return the lengths of each partition.

# Understanding the problem

Once a character appears in a partition, every later occurrence of that character must be in the same partition. Knowing each character's last occurrence lets us greedily expand a partition's boundary until it becomes self-contained.

# Intuition

Pre-compute `last[char]` = last index of each character. Scan left-to-right. As we see each character, extend `end` to at least `last[char]`. When `i == end`, a self-contained partition is complete.

# Approach

1. Build `last = {char: index}` for last occurrence of each character.
2. Initialize `start = 0`, `end = 0`.
3. Iterate `i, char` in `s`.
4. Update `end = max(end, last[char])`.
5. When `i == end`: append `end - start + 1` to result, set `start = i + 1`.
6. Return result.

# Naive Solution — Brute Force

Scan partitions naively: expand each window until no character inside it has a last occurrence outside the window.

```python filename:Python
class Solution:
    def partitionLabels(self, s):
        result = []
        start = 0

        while start < len(s):
            chars = set()
            end = start

            while end < len(s):
                chars.add(s[end])

                last = max(
                    i
                    for i, c in enumerate(s)
                    if c in chars
                )

                if last == end:
                    break

                end += 1

            result.append(end - start + 1)
            start = end + 1

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> partitionLabels(string s) {
        vector<int> result;
        int n = s.size();
        int start = 0;

        while (start < n) {
            unordered_set<char> chars;
            int end = start;

            while (end < n) {
                chars.insert(s[end]);

                int last = 0;
                for (int i = 0; i < n; i++) {
                    if (chars.count(s[i])) {
                        last = i;
                    }
                }

                if (last == end) {
                    break;
                }

                end++;
            }

            result.push_back(end - start + 1);
            start = end + 1;
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public List<Integer> partitionLabels(String s) {
        List<Integer> result = new ArrayList<>();
        int n = s.length();
        int start = 0;

        while (start < n) {
            Set<Character> chars = new HashSet<>();
            int end = start;

            while (end < n) {
                chars.add(s.charAt(end));

                int last = 0;
                for (int i = 0; i < n; i++) {
                    if (chars.contains(s.charAt(i))) {
                        last = i;
                    }
                }

                if (last == end) {
                    break;
                }

                end++;
            }

            result.add(end - start + 1);
            start = end + 1;
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var partitionLabels = function(s) {
    const result = [];
    const n = s.length;
    let start = 0;

    while (start < n) {
        const chars = new Set();
        let end = start;

        while (end < n) {
            chars.add(s[end]);

            let last = 0;
            for (let i = 0; i < n; i++) {
                if (chars.has(s[i])) {
                    last = i;
                }
            }

            if (last === end) {
                break;
            }

            end++;
        }

        result.push(end - start + 1);
        start = end + 1;
    }

    return result;
};
```

<strong>Time: O(n²) · Space: O(k) — k = alphabet size</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def partitionLabels(self, s):
        last = {}

        for i, char in enumerate(s):
            last[char] = i

        result = []
        start = 0
        end = 0

        for i, char in enumerate(s):
            end = max(end, last[char])

            if i == end:
                result.append(end - start + 1)
                start = i + 1

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> partitionLabels(string s) {
        unordered_map<char, int> last;

        for (int i = 0; i < (int)s.size(); i++) {
            last[s[i]] = i;
        }

        vector<int> result;
        int start = 0;
        int end = 0;

        for (int i = 0; i < (int)s.size(); i++) {
            end = max(end, last[s[i]]);

            if (i == end) {
                result.push_back(end - start + 1);
                start = i + 1;
            }
        }

        return result;
    }
};
```

```java filename:Java
class Solution {
    public List<Integer> partitionLabels(String s) {
        Map<Character, Integer> last = new HashMap<>();

        for (int i = 0; i < s.length(); i++) {
            last.put(s.charAt(i), i);
        }

        List<Integer> result = new ArrayList<>();
        int start = 0;
        int end = 0;

        for (int i = 0; i < s.length(); i++) {
            end = Math.max(end, last.get(s.charAt(i)));

            if (i == end) {
                result.add(end - start + 1);
                start = i + 1;
            }
        }

        return result;
    }
}
```

```javascript filename:JavaScript
var partitionLabels = function(s) {
    const last = new Map();

    for (let i = 0; i < s.length; i++) {
        last.set(s[i], i);
    }

    const result = [];
    let start = 0;
    let end = 0;

    for (let i = 0; i < s.length; i++) {
        end = Math.max(end, last.get(s[i]));

        if (i === end) {
            result.push(end - start + 1);
            start = i + 1;
        }
    }

    return result;
};
```

<strong>Time: O(n) · Space: O(k) — k = alphabet size</strong>

# Takeaway

<strong>Pattern</strong> — Last Occurrence + Greedy Boundary Expansion — extend window until it is self-contained
