---
id: 61a355a7-c41a-7805-9fe4-a0ff954c03e8
key: problem:sheet-150/lc-139
subject: sheet-150
topic: dp-1d
title: Word Break
slug: word-break
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 139](https://leetcode.com/problems/word-break/)

# Problem

Given string `s` and dictionary `wordDict`, return true if `s` can be segmented into words from dictionary.

# Understanding the problem

Prefix DP: `dp[i]` is True if prefix `s[:i]` can be segmented into dictionary words.

# Intuition

Use boolean array `dp` of size `n+1` with `dp[0] = True`. For each index `i`, check if `dp[j] == True` and `s[j:i]` is in `words`.

# Approach

1. Convert `wordDict` to a set `words`.
2. Initialize `dp = [False] * (n + 1)` and `dp[0] = True`.
3. Loop `i` from 1 to `n`, and `j` from 0 to `i-1`. If `dp[j] and s[j:i] in words`, set `dp[i] = True` and break.
4. Return `dp[n]`.

# Naive Solution — Recursion

Try every possible prefix of `s` recursively.

```python filename:Python
class Solution:
    def wordBreak(self, s, wordDict):

        words = set(wordDict)

        def dfs(start):
            if start == len(s):
                return True

            for end in range(start + 1, len(s) + 1):
                if s[start:end] in words:
                    if dfs(end):
                        return True

            return False

        return dfs(0)
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool wordBreak(string s, vector<string>& wordDict) {
        unordered_set<string> words(wordDict.begin(), wordDict.end());
        return dfs(s, words, 0);
    }

private:
    bool dfs(const string& s, unordered_set<string>& words, int start) {
        if (start == (int)s.size()) return true;

        for (int end = start + 1; end <= (int)s.size(); end++) {
            if (words.count(s.substr(start, end - start))) {
                if (dfs(s, words, end)) return true;
            }
        }

        return false;
    }
};
```

```java filename:Java
class Solution {
    public boolean wordBreak(String s, List<String> wordDict) {
        Set<String> words = new HashSet<>(wordDict);
        return dfs(s, words, 0);
    }

    private boolean dfs(String s, Set<String> words, int start) {
        if (start == s.length()) return true;

        for (int end = start + 1; end <= s.length(); end++) {
            if (words.contains(s.substring(start, end))) {
                if (dfs(s, words, end)) return true;
            }
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var wordBreak = function(s, wordDict) {
    const words = new Set(wordDict);

    const dfs = (start) => {
        if (start === s.length) return true;

        for (let end = start + 1; end <= s.length; end++) {
            if (words.has(s.slice(start, end))) {
                if (dfs(end)) return true;
            }
        }

        return false;
    };

    return dfs(0);
};
```

<strong>Time: Exponential (O(2^n)) · Aux Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def wordBreak(self, s, wordDict):

        words = set(wordDict)
        n = len(s)

        dp = [False] * (n + 1)
        dp[0] = True

        for i in range(1, n + 1):
            for j in range(i):

                if dp[j] and s[j:i] in words:
                    dp[i] = True
                    break

        return dp[n]
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool wordBreak(string s, vector<string>& wordDict) {
        unordered_set<string> words(wordDict.begin(), wordDict.end());
        int n = s.size();

        vector<bool> dp(n + 1, false);
        dp[0] = true;

        for (int i = 1; i <= n; i++) {
            for (int j = 0; j < i; j++) {
                if (dp[j] && words.count(s.substr(j, i - j))) {
                    dp[i] = true;
                    break;
                }
            }
        }

        return dp[n];
    }
};
```

```java filename:Java
class Solution {
    public boolean wordBreak(String s, List<String> wordDict) {
        Set<String> words = new HashSet<>(wordDict);
        int n = s.length();

        boolean[] dp = new boolean[n + 1];
        dp[0] = true;

        for (int i = 1; i <= n; i++) {
            for (int j = 0; j < i; j++) {
                if (dp[j] && words.contains(s.substring(j, i))) {
                    dp[i] = true;
                    break;
                }
            }
        }

        return dp[n];
    }
}
```

```javascript filename:JavaScript
var wordBreak = function(s, wordDict) {
    const words = new Set(wordDict);
    const n = s.length;

    const dp = new Array(n + 1).fill(false);
    dp[0] = true;

    for (let i = 1; i <= n; i++) {
        for (let j = 0; j < i; j++) {
            if (dp[j] && words.has(s.slice(j, i))) {
                dp[i] = true;
                break;
            }
        }
    }

    return dp[n];
};
```

<strong>Time: O(n² × L) · Space: O(n)</strong>
