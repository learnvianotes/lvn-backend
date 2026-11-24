---
id: fec8c2fd-6d9c-76eb-9bdf-d3bae7c103f8
key: problem:sheet-150/lc-49
subject: sheet-150
topic: arrays-hashing
title: Group Anagrams
slug: group-anagrams
order: 9
---

Difficulty: <strong>Medium</strong> · [LeetCode 49](https://leetcode.com/problems/group-anagrams/)

# Problem

Given an array of strings `strs`, group the anagrams together. Return in any order.

# Examples

> [!NOTE]
>
> Example 1
>
> strs = \["eat","tea","tan","ate","nat","bat"\]
>
> Output: \[\["bat"\],\["nat","tan"\],\["ate","eat","tea"\]\]

# Constraints

- `1 ≤ strs.length ≤ 10`<sup>`4`</sup>
- `0 ≤ strs[i].length ≤ 100`, lowercase English only

# Understanding the problem

Anagrams share the same character frequency signature. Use sorted string as the hashmap key to group all anagrams together.

# Intuition

"eat" sorted = "aet", "tea" sorted = "aet", "ate" sorted = "aet". Use this canonical form as a dict key to group them in one pass.

# Approach

1. Init `groups = defaultdict(list)`.
2. For each string s, compute `key = tuple(sorted(s))`.
3. Append s to `groups[key]`.
4. Return `list(groups.values())`.

# Optimized Code

```python filename:Python
from collections import defaultdict
class Solution:
    def groupAnagrams(self, strs: list[str]) -> list[list[str]]:
        groups = defaultdict(list)
        for s in strs:
            groups[tuple(sorted(s))].append(s)
        return list(groups.values())
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        unordered_map<string, vector<string>> groups;
        for (const string& s : strs) {
            string key = s;
            sort(key.begin(), key.end());
            groups[key].push_back(s);
        }
        vector<vector<string>> res;
        for (auto& [key, group] : groups) res.push_back(group);
        return res;
    }
};
```

```java filename:Java
class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new HashMap<>();
        for (String s : strs) {
            char[] chars = s.toCharArray();
            Arrays.sort(chars);
            String key = new String(chars);
            groups.computeIfAbsent(key, x -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(groups.values());
    }
}
```

```javascript filename:JavaScript
var groupAnagrams = function(strs) {
    const map = new Map();
    for (const s of strs) {
        const key = s.split('').sort().join('');
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
    }
    return [...map.values()];
};
```

<strong>Time: O(n·k log k) · Space: O(n·k)</strong>

# Takeaway

<strong>Pattern: Group by Canonical Form</strong> — When grouping equivalent items, normalize to a canonical signature and use it as a hashmap key.
