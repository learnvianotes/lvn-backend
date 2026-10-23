---
id: fcfbc308-c148-7345-b696-03ecfbdf5457
key: problem:sheet-150/lc-210
subject: sheet-150
topic: graphs
title: Course Schedule II
slug: course-schedule-ii
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 210](https://leetcode.com/problems/course-schedule-ii/)

# Problem

Return ordering of courses to finish all. Return empty array if impossible.

# Understanding the problem

Find valid topological sort ordering of directed graph.

# Intuition

Kahn's BFS Algorithm returning topological course order array.

# Approach

1. Compute indegrees and build graph.
2. Enqueue 0 indegree nodes into queue.
3. Pop queue, append to result order, decrement neighbor indegrees. Push neighbors with 0 indegree.
4. Return result if length matches numCourses else \[\].

# Naive Solution

DFS topological sort.

```python filename:Python
class Solution:
    def findOrder(self, numCourses, prerequisites):
        graph = [[] for _ in range(numCourses)]

        for course, prerequisite in prerequisites:
            graph[course].append(prerequisite)

        # 0 = unvisited, 1 = visiting, 2 = done
        state = [0] * numCourses
        result = []

        def dfs(course):
            if state[course] == 1:
                return False  # cycle

            if state[course] == 2:
                return True

            state[course] = 1

            for prerequisite in graph[course]:
                if not dfs(prerequisite):
                    return False

            state[course] = 2
            result.append(course)  # after all its prerequisites

            return True

        for course in range(numCourses):
            if not dfs(course):
                return []

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> findOrder(int numCourses, vector<vector<int>>& prerequisites) {
        vector<vector<int>> graph(numCourses);

        for (auto& p : prerequisites)
            graph[p[0]].push_back(p[1]);

        // 0 = unvisited, 1 = visiting, 2 = done
        vector<int> state(numCourses, 0);
        vector<int> result;

        function<bool(int)> dfs = [&](int course) -> bool {
            if (state[course] == 1) return false;  // cycle
            if (state[course] == 2) return true;

            state[course] = 1;

            for (int prerequisite : graph[course])
                if (!dfs(prerequisite)) return false;

            state[course] = 2;
            result.push_back(course);  // after all its prerequisites

            return true;
        };

        for (int course = 0; course < numCourses; course++)
            if (!dfs(course)) return {};

        return result;
    }
};
```

```java filename:Java
class Solution {
    private List<List<Integer>> graph = new ArrayList<>();
    private int[] state;  // 0 = unvisited, 1 = visiting, 2 = done
    private int[] result;
    private int size = 0;

    public int[] findOrder(int numCourses, int[][] prerequisites) {
        for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());

        for (int[] p : prerequisites)
            graph.get(p[0]).add(p[1]);

        state = new int[numCourses];
        result = new int[numCourses];

        for (int course = 0; course < numCourses; course++)
            if (!dfs(course)) return new int[0];

        return result;
    }

    private boolean dfs(int course) {
        if (state[course] == 1) return false;  // cycle
        if (state[course] == 2) return true;

        state[course] = 1;

        for (int prerequisite : graph.get(course))
            if (!dfs(prerequisite)) return false;

        state[course] = 2;
        result[size++] = course;  // after all its prerequisites

        return true;
    }
}
```

```javascript filename:JavaScript
var findOrder = function(numCourses, prerequisites) {
    const graph = Array.from({ length: numCourses }, () => []);

    for (const [course, prerequisite] of prerequisites)
        graph[course].push(prerequisite);

    // 0 = unvisited, 1 = visiting, 2 = done
    const state = new Array(numCourses).fill(0);
    const result = [];

    const dfs = (course) => {
        if (state[course] === 1) return false;  // cycle
        if (state[course] === 2) return true;

        state[course] = 1;

        for (const prerequisite of graph[course])
            if (!dfs(prerequisite)) return false;

        state[course] = 2;
        result.push(course);  // after all its prerequisites

        return true;
    };

    for (let course = 0; course < numCourses; course++)
        if (!dfs(course)) return [];

    return result;
};
```

<strong>Time: O(V + E) · Aux Space: O(V + E)</strong>

# Optimized Code (Python 3)

```python filename:Python
from collections import deque

class Solution:
    def findOrder(self, numCourses, prerequisites):
        graph = [[] for _ in range(numCourses)]
        indegree = [0] * numCourses

        for course, prerequisite in prerequisites:
            graph[prerequisite].append(course)
            indegree[course] += 1

        queue = deque(
            i for i in range(numCourses)
            if indegree[i] == 0
        )

        result = []

        while queue:
            course = queue.popleft()
            result.append(course)

            for next_course in graph[course]:
                indegree[next_course] -= 1

                if indegree[next_course] == 0:
                    queue.append(next_course)

        return result if len(result) == numCourses else []
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<int> findOrder(int numCourses, vector<vector<int>>& prerequisites) {
        vector<vector<int>> graph(numCourses);
        vector<int> indegree(numCourses, 0);

        for (auto& p : prerequisites) {
            graph[p[1]].push_back(p[0]);
            indegree[p[0]]++;
        }

        queue<int> q;
        for (int i = 0; i < numCourses; i++)
            if (indegree[i] == 0) q.push(i);

        vector<int> result;

        while (!q.empty()) {
            int course = q.front();
            q.pop();
            result.push_back(course);

            for (int next : graph[course])
                if (--indegree[next] == 0) q.push(next);
        }

        if ((int)result.size() == numCourses) return result;
        return {};
    }
};
```

```java filename:Java
class Solution {
    public int[] findOrder(int numCourses, int[][] prerequisites) {
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

        int[] result = new int[numCourses];
        int size = 0;

        while (!queue.isEmpty()) {
            int course = queue.poll();
            result[size++] = course;

            for (int next : graph.get(course))
                if (--indegree[next] == 0) queue.offer(next);
        }

        return size == numCourses ? result : new int[0];
    }
}
```

```javascript filename:JavaScript
var findOrder = function(numCourses, prerequisites) {
    const graph = Array.from({ length: numCourses }, () => []);
    const indegree = new Array(numCourses).fill(0);

    for (const [course, prerequisite] of prerequisites) {
        graph[prerequisite].push(course);
        indegree[course]++;
    }

    const queue = [];
    for (let i = 0; i < numCourses; i++)
        if (indegree[i] === 0) queue.push(i);

    // the queue itself becomes the order
    for (let head = 0; head < queue.length; head++) {
        const course = queue[head];

        for (const next of graph[course])
            if (--indegree[next] === 0) queue.push(next);
    }

    return queue.length === numCourses ? queue : [];
};
```

<strong>Time: O(V + E) · Aux Space: O(V + E)</strong>
