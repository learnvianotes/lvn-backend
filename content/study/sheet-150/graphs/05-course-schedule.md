---
id: 3c549df5-8b0d-7799-887c-949e2709e997
key: problem:sheet-150/lc-207
subject: sheet-150
topic: graphs
title: Course Schedule
slug: course-schedule
order: 5
---

Difficulty: <strong>Medium</strong> · [LeetCode 207](https://leetcode.com/problems/course-schedule/)

# Problem

Determine if you can finish all courses given prerequisite dependencies.

# Understanding the problem

Can finish all courses iff the prerequisite graph has no directed cycle.

# Intuition

Kahn's BFS Algorithm (Topological Sort using indegrees).

# Approach

1. Compute indegrees of all vertices.
2. Enqueue all vertices with 0 indegree.
3. While queue: pop node, increment completed count, decrement indegrees of neighbors. Push neighbors hitting 0.
4. Return completed == numCourses.

# Naive Solution

DFS cycle detection with `visiting` and `visited` sets.

```python filename:Python
class Solution:
    def canFinish(self, numCourses, prerequisites):
        graph = [[] for _ in range(numCourses)]

        for course, prerequisite in prerequisites:
            graph[course].append(prerequisite)

        visiting = set()
        visited = set()

        def dfs(course):
            if course in visiting:
                return False

            if course in visited:
                return True

            visiting.add(course)

            for prerequisite in graph[course]:
                if not dfs(prerequisite):
                    return False

            visiting.remove(course)
            visited.add(course)

            return True

        for course in range(numCourses):
            if not dfs(course):
                return False

        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
        vector<vector<int>> graph(numCourses);

        for (auto& p : prerequisites)
            graph[p[0]].push_back(p[1]);

        vector<bool> visiting(numCourses, false), visited(numCourses, false);

        function<bool(int)> dfs = [&](int course) -> bool {
            if (visiting[course]) return false;
            if (visited[course]) return true;

            visiting[course] = true;

            for (int prerequisite : graph[course])
                if (!dfs(prerequisite)) return false;

            visiting[course] = false;
            visited[course] = true;

            return true;
        };

        for (int course = 0; course < numCourses; course++)
            if (!dfs(course)) return false;

        return true;
    }
};
```

```java filename:Java
class Solution {
    private List<List<Integer>> graph = new ArrayList<>();
    private boolean[] visiting, visited;

    public boolean canFinish(int numCourses, int[][] prerequisites) {
        for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());

        for (int[] p : prerequisites)
            graph.get(p[0]).add(p[1]);

        visiting = new boolean[numCourses];
        visited = new boolean[numCourses];

        for (int course = 0; course < numCourses; course++)
            if (!dfs(course)) return false;

        return true;
    }

    private boolean dfs(int course) {
        if (visiting[course]) return false;
        if (visited[course]) return true;

        visiting[course] = true;

        for (int prerequisite : graph.get(course))
            if (!dfs(prerequisite)) return false;

        visiting[course] = false;
        visited[course] = true;

        return true;
    }
}
```

```javascript filename:JavaScript
var canFinish = function(numCourses, prerequisites) {
    const graph = Array.from({ length: numCourses }, () => []);

    for (const [course, prerequisite] of prerequisites)
        graph[course].push(prerequisite);

    const visiting = new Set();
    const visited = new Set();

    const dfs = (course) => {
        if (visiting.has(course)) return false;
        if (visited.has(course)) return true;

        visiting.add(course);

        for (const prerequisite of graph[course])
            if (!dfs(prerequisite)) return false;

        visiting.delete(course);
        visited.add(course);

        return true;
    };

    for (let course = 0; course < numCourses; course++)
        if (!dfs(course)) return false;

    return true;
};
```

<strong>Time: O(V + E) · Aux Space: O(V + E)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def canFinish(self, numCourses, prerequisites):
        graph = [[] for _ in range(numCourses)]
        indegree = [0] * numCourses

        for course, prerequisite in prerequisites:
            graph[prerequisite].append(course)
            indegree[course] += 1

        queue = deque(
            i for i in range(numCourses)
            if indegree[i] == 0
        )

        completed = 0

        while queue:
            course = queue.popleft()
            completed += 1

            for next_course in graph[course]:
                indegree[next_course] -= 1

                if indegree[next_course] == 0:
                    queue.append(next_course)

        return completed == numCourses
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
        vector<vector<int>> graph(numCourses);
        vector<int> indegree(numCourses, 0);

        for (auto& p : prerequisites) {
            graph[p[1]].push_back(p[0]);
            indegree[p[0]]++;
        }

        queue<int> q;
        for (int i = 0; i < numCourses; i++)
            if (indegree[i] == 0) q.push(i);

        int completed = 0;

        while (!q.empty()) {
            int course = q.front();
            q.pop();
            completed++;

            for (int next : graph[course])
                if (--indegree[next] == 0) q.push(next);
        }

        return completed == numCourses;
    }
};
```

```java filename:Java
class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());
        int[] indegree = new int[numCourses];

        for (int[] p : prerequisites) {
            graph.get(p[1]).add(p[0]);
            indegree[p[0]]++;
        }

        Deque<Integer> queue = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++)
            if (indegree[i] == 0) queue.offer(i);

        int completed = 0;

        while (!queue.isEmpty()) {
            int course = queue.poll();
            completed++;

            for (int next : graph.get(course))
                if (--indegree[next] == 0) queue.offer(next);
        }

        return completed == numCourses;
    }
}
```

```javascript filename:JavaScript
var canFinish = function(numCourses, prerequisites) {
    const graph = Array.from({ length: numCourses }, () => []);
    const indegree = new Array(numCourses).fill(0);

    for (const [course, prerequisite] of prerequisites) {
        graph[prerequisite].push(course);
        indegree[course]++;
    }

    const queue = [];
    for (let i = 0; i < numCourses; i++)
        if (indegree[i] === 0) queue.push(i);

    let completed = 0;

    for (let head = 0; head < queue.length; head++) {
        const course = queue[head];
        completed++;

        for (const next of graph[course])
            if (--indegree[next] === 0) queue.push(next);
    }

    return completed === numCourses;
};
```

<strong>Time: O(V + E) · Aux Space: O(V + E)</strong>
