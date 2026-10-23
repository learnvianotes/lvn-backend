---
id: 557eede5-e37e-7281-ad7d-ca5ba92f9353
key: problem:sheet-150/lc-128
subject: sheet-150
topic: arrays-hashing
title: Longest Consecutive Sequence
slug: longest-consecutive-sequence
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 128](https://leetcode.com/problems/longest-consecutive-sequence/)

# Problem

Given an unsorted integer array `nums`, return the length of the longest consecutive sequence. Must run in O(n) time.

# Examples

> [!NOTE]
>
> Example 1
>
> nums = \[100,4,200,1,3,2\]
>
> Output: 4
>
> // Sequence: 1,2,3,4

> [!NOTE]
>
> Example 2
>
> nums = \[0,3,7,2,5,8,4,6,0,1\]
>
> Output: 9

# Constraints

- `0 ≤ nums.length ≤ 10`<sup>`5`</sup>
- `-10`<sup>`9`</sup>` ≤ nums[i] ≤ 10`<sup>`9`</sup>

# Understanding the problem

A number is a sequence start only if `n-1` is NOT in the set. Only count from starts to avoid O(n²). Total while-loop iterations across all starts = n (amortized O(n)).

# Intuition

Convert to set for O(1) lookup. For each number, only start counting if it has no predecessor (n-1 not in set). Then count upward. Each element processed at most twice total.

# Approach

1. Put all numbers in a hash set.
2. For each n: if `n-1 not in set` (sequence start):
3. Count up: while `n+len in set`, increment length.
4. Update best = max(best, length).
5. Return best.

# Optimized Code — Hash Set O(n)

<strong>Pattern: Hash Set for Sequence Detection</strong> — Convert to set for O(1) lookup. Start counting only from "sequence beginners" (n-1 not in set). Amortized O(n) because total iterations across all sequences = n.

```python filename:Python
class Solution:
    def longestConsecutive(self, nums: list[int]) -> int:
        num_set = set(nums)
        best = 0
        for n in num_set:
            if n - 1 not in num_set:
                cur, length = n, 1
                while cur + 1 in num_set:
                    cur += 1; length += 1
                best = max(best, length)
        return best
```

```cpp filename:C%2B%2B
class Solution {
public:
    int longestConsecutive(vector<int>& nums) {
        unordered_set<int> s(nums.begin(),nums.end());
        int best = 0;
        for (int n : s)
            if (!s.count(n-1)) {
                int cur=n, len=1;
                while (s.count(cur+1)) { cur++; len++; }
                best = max(best, len);
            }
        return best;
    }
};
```

```java filename:Java
class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> s = new HashSet<>();
        for (int n : nums) s.add(n);
        int best = 0;
        for (int n : s)
            if (!s.contains(n-1)) {
                int cur=n, len=1;
                while (s.contains(cur+1)) { cur++; len++; }
                best = Math.max(best, len);
            }
        return best;
    }
}
```

```javascript filename:JavaScript
var longestConsecutive = function(nums) {
    const s = new Set(nums);
    let best = 0;
    for (const n of s) {
        if (!s.has(n-1)) {
            let cur = n, len = 1;
            while (s.has(cur + 1)) { cur++; len++; }
            best = Math.max(best, len);
        }
    }
    return best;
};
```
