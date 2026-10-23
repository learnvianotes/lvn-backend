---
id: 55457dc6-ca62-771e-b8d4-263eea823056
key: problem:sheet-150/lc-136
subject: sheet-150
topic: bit-manipulation
title: Single Number
slug: single-number
order: 1
---

Difficulty: <strong>Easy</strong> · [LeetCode 136](https://leetcode.com/problems/single-number/)

# Problem

Every number in the array appears exactly twice except one. Find that single number. You must solve it in O(n) time and O(1) space.

# Understanding the problem

XOR has two golden properties: `x ^ x = 0` (pairs cancel) and `x ^ 0 = x` (identity). XOR-ing all elements causes every duplicate pair to vanish, leaving only the unique number.

# Intuition

XOR all elements together. Paired numbers cancel to 0. The single unpaired number XOR'd with 0 returns itself.

# Approach

1. Initialize `answer = 0`.
2. For each `num` in `nums`: `answer ^= num`.
3. Return `answer`.

# Naive Solution — Brute Force

Use a hash set: add unseen numbers, remove them when seen a second time. Whatever remains is the answer.

```python filename:Python
class Solution:
    def singleNumber(self, nums):
        seen = set()

        for num in nums:
            if num in seen:
                seen.remove(num)
            else:
                seen.add(num)

        return seen.pop()
```

```cpp filename:C%2B%2B
class Solution {
public:
    int singleNumber(vector<int>& nums) {
        unordered_set<int> seen;

        for (int num : nums) {
            if (seen.count(num)) {
                seen.erase(num);
            } else {
                seen.insert(num);
            }
        }

        return *seen.begin();
    }
};
```

```java filename:Java
class Solution {
    public int singleNumber(int[] nums) {
        Set<Integer> seen = new HashSet<>();

        for (int num : nums) {
            if (seen.contains(num)) {
                seen.remove(num);
            } else {
                seen.add(num);
            }
        }

        return seen.iterator().next();
    }
}
```

```javascript filename:JavaScript
var singleNumber = function(nums) {
    const seen = new Set();

    for (const num of nums) {
        if (seen.has(num)) {
            seen.delete(num);
        } else {
            seen.add(num);
        }
    }

    return seen.values().next().value;
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def singleNumber(self, nums):
        answer = 0

        for num in nums:
            answer ^= num

        return answer
```

```cpp filename:C%2B%2B
class Solution {
public:
    int singleNumber(vector<int>& nums) {
        int answer = 0;

        for (int num : nums) {
            answer ^= num;
        }

        return answer;
    }
};
```

```java filename:Java
class Solution {
    public int singleNumber(int[] nums) {
        int answer = 0;

        for (int num : nums) {
            answer ^= num;
        }

        return answer;
    }
}
```

```javascript filename:JavaScript
var singleNumber = function(nums) {
    let answer = 0;

    for (const num of nums) {
        answer ^= num;
    }

    return answer;
};
```

<strong>Time: O(n) · Space: O(1)</strong>

# Takeaway

<strong>Pattern</strong> — Pairs + one unique → XOR all elements (x ^ x = 0, x ^ 0 = x)
