---
id: e7743dac-7b0a-743f-a20f-6403f037ed1e
key: problem:sheet-150/lc-5
subject: sheet-150
topic: dp-1d
title: Longest Palindromic Substring
slug: longest-palindromic-substring
order: 8
---

Difficulty: <strong>Medium</strong> · [LeetCode 5](https://leetcode.com/problems/longest-palindromic-substring/)

# Problem

Given a string `s`, return the longest palindromic substring in `s`.

# Understanding the problem

A palindrome expands outward from its center. There are odd-length centers (single char) and even-length centers (between two chars).

# Intuition

Expand outwards from each center index `i` (odd) and pair `(i, i+1)` (even) as long as characters match.

# Approach

1. Helper `expand(left, right)` expands outward while `s[left] == s[right]`.
2. For each index `i`, compute odd palindrome bounds `expand(i, i)` and even palindrome bounds `expand(i, i+1)`.
3. Keep track of maximum length slice bounds `start, end` and return `s[start:end+1]`.

# Naive Solution — Brute Force

Check every substring `s[i:j+1]` to see if it is a palindrome.

```python filename:Python
class Solution:
    def longestPalindrome(self, s):

        def is_palindrome(left, right):
            while left < right:
                if s[left] != s[right]:
                    return False

                left += 1
                right -= 1

            return True

        longest = ""

        for i in range(len(s)):
            for j in range(i, len(s)):
                if is_palindrome(i, j):
                    if j - i + 1 > len(longest):
                        longest = s[i:j + 1]

        return longest
```

```cpp filename:C%2B%2B
class Solution {
public:
    string longestPalindrome(string s) {
        string longest = "";

        for (int i = 0; i < (int)s.size(); i++) {
            for (int j = i; j < (int)s.size(); j++) {
                if (isPalindrome(s, i, j) && j - i + 1 > (int)longest.size()) {
                    longest = s.substr(i, j - i + 1);
                }
            }
        }

        return longest;
    }

private:
    bool isPalindrome(const string& s, int left, int right) {
        while (left < right) {
            if (s[left] != s[right]) return false;
            left++;
            right--;
        }
        return true;
    }
};
```

```java filename:Java
class Solution {
    public String longestPalindrome(String s) {
        String longest = "";

        for (int i = 0; i < s.length(); i++) {
            for (int j = i; j < s.length(); j++) {
                if (isPalindrome(s, i, j) && j - i + 1 > longest.length()) {
                    longest = s.substring(i, j + 1);
                }
            }
        }

        return longest;
    }

    private boolean isPalindrome(String s, int left, int right) {
        while (left < right) {
            if (s.charAt(left) != s.charAt(right)) return false;
            left++;
            right--;
        }
        return true;
    }
}
```

```javascript filename:JavaScript
var longestPalindrome = function(s) {
    const isPalindrome = (left, right) => {
        while (left < right) {
            if (s[left] !== s[right]) return false;
            left++;
            right--;
        }
        return true;
    };

    let longest = "";

    for (let i = 0; i < s.length; i++) {
        for (let j = i; j < s.length; j++) {
            if (isPalindrome(i, j) && j - i + 1 > longest.length) {
                longest = s.slice(i, j + 1);
            }
        }
    }

    return longest;
};
```

<strong>Time: O(n³) · Aux Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def longestPalindrome(self, s):

        start = 0
        end = 0

        def expand(left, right):
            while (
                left >= 0
                and right < len(s)
                and s[left] == s[right]
            ):
                left -= 1
                right += 1

            return left + 1, right - 1

        for i in range(len(s)):
            left1, right1 = expand(i, i)
            left2, right2 = expand(i, i + 1)

            if right1 - left1 > end - start:
                start, end = left1, right1

            if right2 - left2 > end - start:
                start, end = left2, right2

        return s[start:end + 1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    string longestPalindrome(string s) {
        int start = 0, end = 0;

        for (int i = 0; i < (int)s.size(); i++) {
            auto [left1, right1] = expand(s, i, i);
            auto [left2, right2] = expand(s, i, i + 1);

            if (right1 - left1 > end - start) {
                start = left1;
                end = right1;
            }

            if (right2 - left2 > end - start) {
                start = left2;
                end = right2;
            }
        }

        return s.substr(start, end - start + 1);
    }

private:
    pair<int, int> expand(const string& s, int left, int right) {
        while (left >= 0 && right < (int)s.size() && s[left] == s[right]) {
            left--;
            right++;
        }
        return {left + 1, right - 1};
    }
};
```

```java filename:Java
class Solution {
    public String longestPalindrome(String s) {
        int start = 0, end = 0;

        for (int i = 0; i < s.length(); i++) {
            int[] odd = expand(s, i, i);
            int[] even = expand(s, i, i + 1);

            if (odd[1] - odd[0] > end - start) {
                start = odd[0];
                end = odd[1];
            }

            if (even[1] - even[0] > end - start) {
                start = even[0];
                end = even[1];
            }
        }

        return s.substring(start, end + 1);
    }

    private int[] expand(String s, int left, int right) {
        while (left >= 0 && right < s.length() && s.charAt(left) == s.charAt(right)) {
            left--;
            right++;
        }
        return new int[] { left + 1, right - 1 };
    }
}
```

```javascript filename:JavaScript
var longestPalindrome = function(s) {
    let start = 0, end = 0;

    const expand = (left, right) => {
        while (left >= 0 && right < s.length && s[left] === s[right]) {
            left--;
            right++;
        }
        return [left + 1, right - 1];
    };

    for (let i = 0; i < s.length; i++) {
        const [left1, right1] = expand(i, i);
        const [left2, right2] = expand(i, i + 1);

        if (right1 - left1 > end - start) {
            [start, end] = [left1, right1];
        }

        if (right2 - left2 > end - start) {
            [start, end] = [left2, right2];
        }
    }

    return s.slice(start, end + 1);
};
```

<strong>Time: O(n²) · Space: O(1)</strong>

# Takeaway

<strong>Expand Around Center</strong> — Palindrome expansion technique beats standard O(n²) 2D DP in auxiliary space.
