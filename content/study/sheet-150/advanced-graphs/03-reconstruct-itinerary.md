---
id: 5b29d797-4d36-704a-aa6f-a5478715b01e
key: problem:sheet-150/lc-332
subject: sheet-150
topic: advanced-graphs
title: Reconstruct Itinerary
slug: reconstruct-itinerary
order: 3
---

Difficulty: <strong>Hard</strong> · [LeetCode 332](https://leetcode.com/problems/reconstruct-itinerary/)

# Problem

Reconstruct airline itinerary starting from `JFK` using all tickets exactly once. Return lexicographically smallest itinerary.

# Understanding the problem

Eulerian Path problem on directed graph. Hierholzer's Algorithm builds post-order itinerary traversing sorted neighbors.

# Intuition

Hierholzer's algorithm: sort destination lists reverse-alphabetically, pop destinations during DFS, append node post-order, then reverse result.

# Approach

1. Sort tickets reverse alphabetically so pop() gives smallest destination.
2. DFS starting from JFK: while neighbors exist, dfs(neighbors.pop()).
3. Append airport to result post-order. Return reverse of result.

# Naive Solution

Standard DFS backtracking exploring all paths.

```python filename:Python
from collections import defaultdict

class Solution:
    def findItinerary(self, tickets):
        n = len(tickets)
        tickets = sorted(tickets)

        # airport -> indices of its tickets, in lexical order of destination
        graph = defaultdict(list)

        for i, (src, dst) in enumerate(tickets):
            graph[src].append(i)

        used = [False] * n
        path = ["JFK"]

        def dfs(airport):
            if len(path) == n + 1:
                return True

            for i in graph[airport]:
                if used[i]:
                    continue

                used[i] = True
                path.append(tickets[i][1])

                if dfs(tickets[i][1]):
                    return True

                used[i] = False  # backtrack
                path.pop()

            return False

        dfs("JFK")
        return path
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<string> findItinerary(vector<vector<string>>& tickets) {
        int n = tickets.size();
        sort(tickets.begin(), tickets.end());

        // airport -> indices of its tickets, in lexical order of destination
        unordered_map<string, vector<int>> graph;
        for (int i = 0; i < n; i++)
            graph[tickets[i][0]].push_back(i);

        vector<bool> used(n, false);
        vector<string> path{"JFK"};

        function<bool(const string&)> dfs = [&](const string& airport) -> bool {
            if ((int)path.size() == n + 1) return true;

            for (int i : graph[airport]) {
                if (used[i]) continue;

                used[i] = true;
                path.push_back(tickets[i][1]);

                if (dfs(tickets[i][1])) return true;

                used[i] = false;  // backtrack
                path.pop_back();
            }

            return false;
        };

        dfs("JFK");
        return path;
    }
};
```

```java filename:Java
class Solution {
    private List<List<String>> tickets;
    private Map<String, List<Integer>> graph = new HashMap<>();
    private boolean[] used;
    private List<String> path = new ArrayList<>();

    public List<String> findItinerary(List<List<String>> tickets) {
        this.tickets = new ArrayList<>(tickets);
        this.tickets.sort((a, b) -> a.get(0).equals(b.get(0))
                ? a.get(1).compareTo(b.get(1))
                : a.get(0).compareTo(b.get(0)));

        // airport -> indices of its tickets, in lexical order of destination
        for (int i = 0; i < this.tickets.size(); i++)
            graph.computeIfAbsent(this.tickets.get(i).get(0), k -> new ArrayList<>()).add(i);

        used = new boolean[this.tickets.size()];
        path.add("JFK");
        dfs("JFK");

        return path;
    }

    private boolean dfs(String airport) {
        if (path.size() == tickets.size() + 1) return true;

        for (int i : graph.getOrDefault(airport, Collections.emptyList())) {
            if (used[i]) continue;

            String next = tickets.get(i).get(1);
            used[i] = true;
            path.add(next);

            if (dfs(next)) return true;

            used[i] = false;  // backtrack
            path.remove(path.size() - 1);
        }

        return false;
    }
}
```

```javascript filename:JavaScript
var findItinerary = function(tickets) {
    const n = tickets.length;
    const sorted = [...tickets].sort((a, b) =>
        a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)
                      : (a[0] < b[0] ? -1 : 1));

    // airport -> indices of its tickets, in lexical order of destination
    const graph = new Map();
    sorted.forEach(([src], i) => {
        if (!graph.has(src)) graph.set(src, []);
        graph.get(src).push(i);
    });

    const used = new Array(n).fill(false);
    const path = ["JFK"];

    const dfs = (airport) => {
        if (path.length === n + 1) return true;

        for (const i of graph.get(airport) || []) {
            if (used[i]) continue;

            used[i] = true;
            path.push(sorted[i][1]);

            if (dfs(sorted[i][1])) return true;

            used[i] = false;  // backtrack
            path.pop();
        }

        return false;
    };

    dfs("JFK");
    return path;
};
```

<strong>Time: O(E!) · Aux Space: O(E)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import defaultdict

class Solution:
    def findItinerary(self, tickets):
        graph = defaultdict(list)

        tickets.sort(reverse=True)

        for src, dst in tickets:
            graph[src].append(dst)

        itinerary = []

        def dfs(airport):
            while graph[airport]:
                next_airport = graph[airport].pop()
                dfs(next_airport)

            itinerary.append(airport)

        dfs("JFK")
        return itinerary[::-1]
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<string> findItinerary(vector<vector<string>>& tickets) {
        unordered_map<string, vector<string>> graph;

        sort(tickets.rbegin(), tickets.rend());

        for (auto& t : tickets)
            graph[t[0]].push_back(t[1]);

        vector<string> itinerary;

        function<void(const string&)> dfs = [&](const string& airport) {
            auto& destinations = graph[airport];

            while (!destinations.empty()) {
                string next = destinations.back();
                destinations.pop_back();
                dfs(next);
            }

            itinerary.push_back(airport);
        };

        dfs("JFK");
        reverse(itinerary.begin(), itinerary.end());
        return itinerary;
    }
};
```

```java filename:Java
class Solution {
    private Map<String, List<String>> graph = new HashMap<>();
    private List<String> itinerary = new ArrayList<>();

    public List<String> findItinerary(List<List<String>> tickets) {
        List<List<String>> sorted = new ArrayList<>(tickets);
        sorted.sort((a, b) -> a.get(0).equals(b.get(0))
                ? b.get(1).compareTo(a.get(1))
                : b.get(0).compareTo(a.get(0)));

        for (List<String> t : sorted)
            graph.computeIfAbsent(t.get(0), k -> new ArrayList<>()).add(t.get(1));

        dfs("JFK");
        Collections.reverse(itinerary);
        return itinerary;
    }

    private void dfs(String airport) {
        List<String> destinations = graph.getOrDefault(airport, new ArrayList<>());

        while (!destinations.isEmpty()) {
            String next = destinations.remove(destinations.size() - 1);
            dfs(next);
        }

        itinerary.add(airport);
    }
}
```

```javascript filename:JavaScript
var findItinerary = function(tickets) {
    const graph = new Map();

    // reverse lexical order, so pop() yields the smallest destination
    const sorted = [...tickets].sort((a, b) =>
        a[0] === b[0] ? (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0)
                      : (a[0] < b[0] ? 1 : -1));

    for (const [src, dst] of sorted) {
        if (!graph.has(src)) graph.set(src, []);
        graph.get(src).push(dst);
    }

    const itinerary = [];

    const dfs = (airport) => {
        const destinations = graph.get(airport) || [];

        while (destinations.length) {
            dfs(destinations.pop());
        }

        itinerary.push(airport);
    };

    dfs("JFK");
    return itinerary.reverse();
};
```

<strong>Time: O(E log E) · Aux Space: O(V + E)</strong>
