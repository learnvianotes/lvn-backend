---
id: 0292ea78-c667-7708-9fed-53eaea4c5210
key: problem:sheet-150/lc-269
subject: sheet-150
topic: advanced-graphs
title: Alien Dictionary
slug: alien-dictionary
order: 2
---

Difficulty: <strong>Hard</strong> · [LeetCode 269](https://leetcode.com/problems/alien-dictionary/)

# Problem

Given sorted dictionary of alien language words, return valid ordering of letters in alien alphabet. If invalid return `""`.

# Understanding the problem

Topological Sort on DAG formed by directed edges comparing adjacent words in dictionary.

# Intuition

Compare adjacent words to extract directed character edges. Post-order DFS topological sort with cycle detection.

# Approach

1. Compare adjacent words w1, w2. If w1 starts with w2 and len(w1) &gt; len(w2) return "".
2. Find first differing char and add edge w1\[j\] -&gt; w2\[j\].
3. Post-order DFS with cycle detection. Return reversed post-order list.

# Naive Solution

Character permutation brute force.

```python filename:Python
from itertools import permutations

class Solution:
    def alienOrder(self, words):
        chars = sorted(set("".join(words)))

        # Are the words sorted under this alphabet order?
        def is_sorted(order):
            rank = {char: i for i, char in enumerate(order)}

            for w1, w2 in zip(words, words[1:]):
                j = 0

                while j < len(w1) and j < len(w2) and w1[j] == w2[j]:
                    j += 1

                if j == len(w1) or j == len(w2):
                    if len(w1) > len(w2):
                        return False  # longer word before its prefix
                elif rank[w1[j]] > rank[w2[j]]:
                    return False

            return True

        # Try every ordering of the letters
        for order in permutations(chars):
            if is_sorted(order):
                return "".join(order)

        return ""
```

```cpp filename:C%2B%2B
class Solution {
public:
    string alienOrder(vector<string>& words) {
        string chars;
        for (auto& word : words)
            for (char c : word)
                if (chars.find(c) == string::npos) chars += c;

        sort(chars.begin(), chars.end());

        // Try every ordering of the letters
        do {
            if (isSorted(words, chars)) return chars;
        } while (next_permutation(chars.begin(), chars.end()));

        return "";
    }

private:
    // Are the words sorted under this alphabet order?
    bool isSorted(const vector<string>& words, const string& order) {
        int rank[26] = {};
        for (int i = 0; i < (int)order.size(); i++) rank[order[i] - 'a'] = i;

        for (int i = 0; i + 1 < (int)words.size(); i++) {
            const string& w1 = words[i];
            const string& w2 = words[i + 1];
            int j = 0;

            while (j < (int)w1.size() && j < (int)w2.size() && w1[j] == w2[j]) j++;

            if (j == (int)w1.size() || j == (int)w2.size()) {
                if (w1.size() > w2.size()) return false;  // longer word before its prefix
            } else if (rank[w1[j] - 'a'] > rank[w2[j] - 'a']) {
                return false;
            }
        }

        return true;
    }
};
```

```java filename:Java
class Solution {
    private String[] words;
    private String chars;
    private int[] rank = new int[26];

    public String alienOrder(String[] words) {
        this.words = words;

        StringBuilder sb = new StringBuilder();
        for (String word : words)
            for (char c : word.toCharArray())
                if (sb.indexOf(String.valueOf(c)) == -1) sb.append(c);
        chars = sb.toString();

        // Try every ordering of the letters
        String result = permute(new StringBuilder(), new boolean[chars.length()]);
        return result == null ? "" : result;
    }

    private String permute(StringBuilder order, boolean[] used) {
        if (order.length() == chars.length())
            return isSorted(order) ? order.toString() : null;

        for (int i = 0; i < chars.length(); i++) {
            if (used[i]) continue;

            used[i] = true;
            order.append(chars.charAt(i));

            String result = permute(order, used);
            if (result != null) return result;

            order.deleteCharAt(order.length() - 1);
            used[i] = false;
        }

        return null;
    }

    // Are the words sorted under this alphabet order?
    private boolean isSorted(StringBuilder order) {
        for (int i = 0; i < order.length(); i++) rank[order.charAt(i) - 'a'] = i;

        for (int i = 0; i + 1 < words.length; i++) {
            String w1 = words[i], w2 = words[i + 1];
            int j = 0;

            while (j < w1.length() && j < w2.length() && w1.charAt(j) == w2.charAt(j)) j++;

            if (j == w1.length() || j == w2.length()) {
                if (w1.length() > w2.length()) return false;  // longer word before its prefix
            } else if (rank[w1.charAt(j) - 'a'] > rank[w2.charAt(j) - 'a']) {
                return false;
            }
        }

        return true;
    }
}
```

```javascript filename:JavaScript
var alienOrder = function(words) {
    const chars = [...new Set(words.join(""))];

    // Are the words sorted under this alphabet order?
    const isSorted = (order) => {
        const rank = {};
        order.forEach((c, i) => rank[c] = i);

        for (let i = 0; i + 1 < words.length; i++) {
            const w1 = words[i], w2 = words[i + 1];
            let j = 0;

            while (j < w1.length && j < w2.length && w1[j] === w2[j]) j++;

            if (j === w1.length || j === w2.length) {
                if (w1.length > w2.length) return false;  // longer word before its prefix
            } else if (rank[w1[j]] > rank[w2[j]]) {
                return false;
            }
        }

        return true;
    };

    // Try every ordering of the letters
    const used = new Array(chars.length).fill(false);
    const order = [];

    const permute = () => {
        if (order.length === chars.length) return isSorted(order);

        for (let i = 0; i < chars.length; i++) {
            if (used[i]) continue;

            used[i] = true;
            order.push(chars[i]);

            if (permute()) return true;

            order.pop();
            used[i] = false;
        }

        return false;
    };

    return permute() ? order.join("") : "";
};
```

<strong>Time: O(26!) · Aux Space: O(1)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def alienOrder(self, words):
        graph = {
            char: set()
            for word in words
            for char in word
        }

        for i in range(len(words) - 1):
            w1, w2 = words[i], words[i + 1]
            min_length = min(len(w1), len(w2))

            if len(w1) > len(w2) and w1[:min_length] == w2[:min_length]:
                return ""

            for j in range(min_length):
                if w1[j] != w2[j]:
                    graph[w1[j]].add(w2[j])
                    break

        visited = {}
        result = []

        def dfs(char):
            if char in visited:
                return visited[char]

            visited[char] = True

            for neighbor in graph[char]:
                if dfs(neighbor):
                    return True

            visited[char] = False
            result.append(char)

            return False

        for char in graph:
            if dfs(char):
                return ""

        return "".join(result[::-1])
```

```cpp filename:C%2B%2B
class Solution {
public:
    string alienOrder(vector<string>& words) {
        unordered_map<char, unordered_set<char>> graph;
        for (auto& word : words)
            for (char c : word) graph[c];

        for (int i = 0; i + 1 < (int)words.size(); i++) {
            const string& w1 = words[i];
            const string& w2 = words[i + 1];
            int minLength = min(w1.size(), w2.size());

            if (w1.size() > w2.size() && w1.compare(0, minLength, w2, 0, minLength) == 0)
                return "";

            for (int j = 0; j < minLength; j++) {
                if (w1[j] != w2[j]) {
                    graph[w1[j]].insert(w2[j]);
                    break;
                }
            }
        }

        // true = on the current path (cycle), false = finished
        unordered_map<char, bool> visited;
        string result;

        function<bool(char)> dfs = [&](char c) -> bool {
            if (visited.count(c)) return visited[c];

            visited[c] = true;

            for (char neighbor : graph[c])
                if (dfs(neighbor)) return true;

            visited[c] = false;
            result += c;

            return false;
        };

        for (auto& [c, _] : graph)
            if (dfs(c)) return "";

        reverse(result.begin(), result.end());
        return result;
    }
};
```

```java filename:Java
class Solution {
    private Map<Character, Set<Character>> graph = new LinkedHashMap<>();
    // true = on the current path (cycle), false = finished
    private Map<Character, Boolean> visited = new HashMap<>();
    private StringBuilder result = new StringBuilder();

    public String alienOrder(String[] words) {
        for (String word : words)
            for (char c : word.toCharArray())
                graph.putIfAbsent(c, new HashSet<>());

        for (int i = 0; i + 1 < words.length; i++) {
            String w1 = words[i], w2 = words[i + 1];
            int minLength = Math.min(w1.length(), w2.length());

            if (w1.length() > w2.length() && w1.startsWith(w2))
                return "";

            for (int j = 0; j < minLength; j++) {
                if (w1.charAt(j) != w2.charAt(j)) {
                    graph.get(w1.charAt(j)).add(w2.charAt(j));
                    break;
                }
            }
        }

        for (char c : graph.keySet())
            if (dfs(c)) return "";

        return result.reverse().toString();
    }

    private boolean dfs(char c) {
        if (visited.containsKey(c)) return visited.get(c);

        visited.put(c, true);

        for (char neighbor : graph.get(c))
            if (dfs(neighbor)) return true;

        visited.put(c, false);
        result.append(c);

        return false;
    }
}
```

```javascript filename:JavaScript
var alienOrder = function(words) {
    const graph = new Map();
    for (const word of words)
        for (const c of word)
            if (!graph.has(c)) graph.set(c, new Set());

    for (let i = 0; i + 1 < words.length; i++) {
        const w1 = words[i], w2 = words[i + 1];
        const minLength = Math.min(w1.length, w2.length);

        if (w1.length > w2.length && w1.startsWith(w2)) return "";

        for (let j = 0; j < minLength; j++) {
            if (w1[j] !== w2[j]) {
                graph.get(w1[j]).add(w2[j]);
                break;
            }
        }
    }

    // true = on the current path (cycle), false = finished
    const visited = new Map();
    const result = [];

    const dfs = (c) => {
        if (visited.has(c)) return visited.get(c);

        visited.set(c, true);

        for (const neighbor of graph.get(c))
            if (dfs(neighbor)) return true;

        visited.set(c, false);
        result.push(c);

        return false;
    };

    for (const c of graph.keys())
        if (dfs(c)) return "";

    return result.reverse().join("");
};
```

<strong>Time: O(C) total characters · Aux Space: O(1) bounded by 26 letters</strong>
