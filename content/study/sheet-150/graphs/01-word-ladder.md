---
id: ca2d9d27-9600-7c75-98f0-ec0040a70ebd
key: problem:sheet-150/lc-127
subject: sheet-150
topic: graphs
title: Word Ladder
slug: word-ladder
order: 1
---

Difficulty: <strong>Hard</strong> · [LeetCode 127](https://leetcode.com/problems/word-ladder/)

# Problem

Return length of shortest transformation sequence from `beginWord` to `endWord` using `wordList`.

# Understanding the problem

Unweighted shortest path problem solved via BFS with pattern wildcard matching.

# Intuition

Group words into pattern dict `neighbors['*ot'] = ['hot', 'dot', 'lot']` to reduce edge lookup to O(L^2 × N).

# Approach

1. Build wildcard pattern map for wordList.
2. Queue with (beginWord, 1), visited set with beginWord.
3. BFS layer-by-layer: for current word, generate patterns, visit unvisited neighbor words, push to queue with dist+1.

# Naive Solution

Compare all pairs of words for 1-char difference to build graph.

```python filename:Python
from collections import deque

class Solution:
    def ladderLength(self, beginWord, endWord, wordList):
        if endWord not in wordList:
            return 0

        words = wordList + [beginWord]
        n = len(words)

        def one_apart(a, b):
            diff = 0

            for x, y in zip(a, b):
                if x != y:
                    diff += 1
                    if diff > 1:
                        return False

            return diff == 1

        # Compare every pair of words to build the graph
        graph = [[] for _ in range(n)]

        for i in range(n):
            for j in range(i + 1, n):
                if one_apart(words[i], words[j]):
                    graph[i].append(j)
                    graph[j].append(i)

        visited = [False] * n
        visited[n - 1] = True
        queue = deque([(n - 1, 1)])

        while queue:
            i, distance = queue.popleft()

            if words[i] == endWord:
                return distance

            for j in graph[i]:
                if not visited[j]:
                    visited[j] = True
                    queue.append((j, distance + 1))

        return 0
```

```cpp filename:C%2B%2B
class Solution {
public:
    int ladderLength(string beginWord, string endWord, vector<string>& wordList) {
        if (find(wordList.begin(), wordList.end(), endWord) == wordList.end())
            return 0;

        vector<string> words = wordList;
        words.push_back(beginWord);
        int n = words.size();

        auto oneApart = [](const string& a, const string& b) {
            int diff = 0;
            for (int i = 0; i < (int)a.size() && diff <= 1; i++)
                if (a[i] != b[i]) diff++;
            return diff == 1;
        };

        // Compare every pair of words to build the graph
        vector<vector<int>> graph(n);
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                if (oneApart(words[i], words[j])) {
                    graph[i].push_back(j);
                    graph[j].push_back(i);
                }
            }
        }

        vector<bool> visited(n, false);
        queue<pair<int, int>> q;
        q.push({n - 1, 1});
        visited[n - 1] = true;

        while (!q.empty()) {
            auto [i, distance] = q.front();
            q.pop();

            if (words[i] == endWord) return distance;

            for (int j : graph[i]) {
                if (!visited[j]) {
                    visited[j] = true;
                    q.push({j, distance + 1});
                }
            }
        }

        return 0;
    }
};
```

```java filename:Java
class Solution {
    public int ladderLength(String beginWord, String endWord, List<String> wordList) {
        if (!wordList.contains(endWord)) return 0;

        List<String> words = new ArrayList<>(wordList);
        words.add(beginWord);
        int n = words.size();

        // Compare every pair of words to build the graph
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < n; i++) graph.add(new ArrayList<>());

        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                if (oneApart(words.get(i), words.get(j))) {
                    graph.get(i).add(j);
                    graph.get(j).add(i);
                }
            }
        }

        boolean[] visited = new boolean[n];
        Deque<int[]> queue = new ArrayDeque<>();
        queue.offer(new int[]{n - 1, 1});
        visited[n - 1] = true;

        while (!queue.isEmpty()) {
            int[] cur = queue.poll();
            int i = cur[0], distance = cur[1];

            if (words.get(i).equals(endWord)) return distance;

            for (int j : graph.get(i)) {
                if (!visited[j]) {
                    visited[j] = true;
                    queue.offer(new int[]{j, distance + 1});
                }
            }
        }

        return 0;
    }

    private boolean oneApart(String a, String b) {
        int diff = 0;
        for (int i = 0; i < a.length() && diff <= 1; i++)
            if (a.charAt(i) != b.charAt(i)) diff++;
        return diff == 1;
    }
}
```

```javascript filename:JavaScript
var ladderLength = function(beginWord, endWord, wordList) {
    if (!wordList.includes(endWord)) return 0;

    const words = [...wordList, beginWord];
    const n = words.length;

    const oneApart = (a, b) => {
        let diff = 0;
        for (let i = 0; i < a.length && diff <= 1; i++)
            if (a[i] !== b[i]) diff++;
        return diff === 1;
    };

    // Compare every pair of words to build the graph
    const graph = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (oneApart(words[i], words[j])) {
                graph[i].push(j);
                graph[j].push(i);
            }
        }
    }

    const visited = new Array(n).fill(false);
    const queue = [[n - 1, 1]];
    visited[n - 1] = true;

    for (let head = 0; head < queue.length; head++) {
        const [i, distance] = queue[head];

        if (words[i] === endWord) return distance;

        for (const j of graph[i]) {
            if (!visited[j]) {
                visited[j] = true;
                queue.push([j, distance + 1]);
            }
        }
    }

    return 0;
};
```

<strong>Time: O(N^2 × L) · Aux Space: O(N^2)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import defaultdict, deque

class Solution:
    def ladderLength(self, beginWord, endWord, wordList):
        if endWord not in wordList:
            return 0

        patterns = defaultdict(list)

        for word in wordList:
            for i in range(len(word)):
                pattern = word[:i] + "*" + word[i + 1:]
                patterns[pattern].append(word)

        visited = {beginWord}
        queue = deque([(beginWord, 1)])

        while queue:
            word, distance = queue.popleft()

            if word == endWord:
                return distance

            for i in range(len(word)):
                pattern = word[:i] + "*" + word[i + 1:]

                for neighbor in patterns[pattern]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append((neighbor, distance + 1))

                patterns[pattern] = []

        return 0
```

```cpp filename:C%2B%2B
class Solution {
public:
    int ladderLength(string beginWord, string endWord, vector<string>& wordList) {
        if (find(wordList.begin(), wordList.end(), endWord) == wordList.end())
            return 0;

        unordered_map<string, vector<string>> patterns;

        for (const string& word : wordList) {
            for (int i = 0; i < (int)word.size(); i++) {
                string pattern = word.substr(0, i) + "*" + word.substr(i + 1);
                patterns[pattern].push_back(word);
            }
        }

        unordered_set<string> visited{beginWord};
        queue<pair<string, int>> q;
        q.push({beginWord, 1});

        while (!q.empty()) {
            auto [word, distance] = q.front();
            q.pop();

            if (word == endWord) return distance;

            for (int i = 0; i < (int)word.size(); i++) {
                string pattern = word.substr(0, i) + "*" + word.substr(i + 1);

                for (const string& neighbor : patterns[pattern]) {
                    if (!visited.count(neighbor)) {
                        visited.insert(neighbor);
                        q.push({neighbor, distance + 1});
                    }
                }

                patterns[pattern].clear();
            }
        }

        return 0;
    }
};
```

```java filename:Java
class Solution {
    public int ladderLength(String beginWord, String endWord, List<String> wordList) {
        if (!wordList.contains(endWord)) return 0;

        Map<String, List<String>> patterns = new HashMap<>();

        for (String word : wordList) {
            for (int i = 0; i < word.length(); i++) {
                String pattern = word.substring(0, i) + "*" + word.substring(i + 1);
                patterns.computeIfAbsent(pattern, key -> new ArrayList<>()).add(word);
            }
        }

        Set<String> visited = new HashSet<>();
        visited.add(beginWord);

        Deque<String> queue = new ArrayDeque<>();
        queue.offer(beginWord);
        int distance = 1;

        while (!queue.isEmpty()) {
            for (int size = queue.size(); size > 0; size--) {
                String word = queue.poll();

                if (word.equals(endWord)) return distance;

                for (int i = 0; i < word.length(); i++) {
                    String pattern = word.substring(0, i) + "*" + word.substring(i + 1);
                    List<String> neighbors = patterns.getOrDefault(pattern, Collections.emptyList());

                    for (String neighbor : neighbors) {
                        if (visited.add(neighbor)) queue.offer(neighbor);
                    }

                    patterns.remove(pattern);
                }
            }

            distance++;
        }

        return 0;
    }
}
```

```javascript filename:JavaScript
var ladderLength = function(beginWord, endWord, wordList) {
    if (!wordList.includes(endWord)) return 0;

    const patterns = new Map();

    for (const word of wordList) {
        for (let i = 0; i < word.length; i++) {
            const pattern = word.slice(0, i) + "*" + word.slice(i + 1);
            if (!patterns.has(pattern)) patterns.set(pattern, []);
            patterns.get(pattern).push(word);
        }
    }

    const visited = new Set([beginWord]);
    const queue = [[beginWord, 1]];

    for (let head = 0; head < queue.length; head++) {
        const [word, distance] = queue[head];

        if (word === endWord) return distance;

        for (let i = 0; i < word.length; i++) {
            const pattern = word.slice(0, i) + "*" + word.slice(i + 1);

            for (const neighbor of patterns.get(pattern) || []) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([neighbor, distance + 1]);
                }
            }

            patterns.delete(pattern);
        }
    }

    return 0;
};
```

<strong>Time: O(N × L^2) · Aux Space: O(N × L^2)</strong>
