---
id: 89b554eb-b1f7-70f7-bde5-c3cd2fbc4cc4
key: problem:sheet-150/lc-347
subject: sheet-150
topic: arrays-hashing
title: Top K Frequent Elements
slug: top-k-frequent-elements
order: 7
---

Difficulty: <strong>Medium</strong> · [LeetCode 347](https://leetcode.com/problems/top-k-frequent-elements/)

# Problem

Given an integer array `nums` and an integer `k`, return the `k` most frequent elements.

# Examples

> [!NOTE]
>
> Example 1
>
> nums=\[1,1,1,2,2,3\], k=2
>
> Output: \[1,2\]

# Constraints

- `1 ≤ nums.length ≤ 10`<sup>`5`</sup>
- k is in range \[1, number of unique elements\]
- The answer is guaranteed to be unique

# Intuition

<strong>Bucket Sort:</strong> Frequencies range 1 to n. Create n+1 frequency buckets. Put numbers into their bucket. Read from the end (highest freq) until we have k elements. O(n) — beats heap's O(n log k).

# Optimized Code — Bucket Sort

```python filename:Python
from collections import Counter
class Solution:
    def topKFrequent(self, nums: list[int], k: int) -> list[int]:
        count = Counter(nums)
        buckets = [[] for _ in range(len(nums) + 1)]
        for num, freq in count.items():
            buckets[freq].append(num)
        res = []
        for i in range(len(buckets)-1, 0, -1):
            for num in buckets[i]:
                res.append(num)
                if len(res) == k: return res
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> topKFrequent(vector<int>& nums, int k) {
        unordered_map<int, int> count;
        for (int n : nums) count[n]++;
        vector<vector<int>> buckets(nums.size() + 1);
        for (auto& [num, freq] : count) buckets[freq].push_back(num);
        vector<int> res;
        for (int i = buckets.size() - 1; i > 0; i--)
            for (int num : buckets[i]) {
                res.push_back(num);
                if (res.size() == k) return res;
            }
        return res;
    }
};
```

```java filename:Java
class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();
        for (int n : nums) count.put(n, count.getOrDefault(n, 0) + 1);
        List<List<Integer>> buckets = new ArrayList<>();
        for (int i = 0; i <= nums.length; i++) buckets.add(new ArrayList<>());
        for (Map.Entry<Integer, Integer> e : count.entrySet())
            buckets.get(e.getValue()).add(e.getKey());
        int[] res = new int[k];
        int idx = 0;
        for (int i = buckets.size() - 1; i > 0; i--)
            for (int num : buckets.get(i)) {
                res[idx++] = num;
                if (idx == k) return res;
            }
        return res;
    }
}
```

```javascript filename:JavaScript
var topKFrequent = function(nums, k) {
    const cnt = new Map();
    for (const n of nums) cnt.set(n,(cnt.get(n)||0)+1);
    const buckets = Array.from({length:nums.length+1},()=>[]);
    for (const [n,f] of cnt) buckets[f].push(n);
    const res = [];
    for (let i = buckets.length-1; i > 0 && res.length < k; i--)
        res.push(...buckets[i]);
    return res.slice(0,k);
};
```

<strong>Time: O(n) · Space: O(n)</strong>

# Takeaway

<strong>Pattern: Bucket Sort for Bounded Frequencies</strong> — When frequency values are bounded by n, bucket sort achieves O(n). "Top K" problems: use heap O(n log k) or bucket sort O(n).
