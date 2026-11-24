---
id: f7903c0e-b87b-776a-8de4-14f43e5d2ca0
key: problem:sheet-150/lc-130
subject: sheet-150
topic: graphs
title: Surrounded Regions
slug: surrounded-regions
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 130](https://leetcode.com/problems/surrounded-regions/)

# Problem

Capture all regions surrounded by `'X'`. Modify `'O'` to `'X'` if completely surrounded.

# Understanding the problem

Any `'O'` connected to border boundary CANNOT be captured. All other `'O'` cells will be flipped to `'X'`.

# Intuition

Boundary-first DFS marking boundary-connected `'O'`s as `'#'`, then flipping remaining `'O'` → `'X'` and `'#'` → `'O'`.

# Approach

1. Run DFS on all 4 borders to mark safe `'O'`s as `'#'`.
2. Traverse grid: convert any remaining `'O'` to `'X'`.
3. Restore `'#'` back to `'O'`.

# Naive Solution

DFS from every `'O'` checking if boundary reachable.

```python filename:Python
class Solution:
    def solve(self, board):
        rows = len(board)
        cols = len(board[0])

        # Can this 'O' reach the border through other 'O's?
        def reaches_border(r, c, visited):
            if r < 0 or r >= rows or c < 0 or c >= cols:
                return True

            if board[r][c] != "O" or (r, c) in visited:
                return False

            visited.add((r, c))

            return (
                reaches_border(r + 1, c, visited)
                or reaches_border(r - 1, c, visited)
                or reaches_border(r, c + 1, visited)
                or reaches_border(r, c - 1, visited)
            )

        for r in range(rows):
            for c in range(cols):
                if board[r][c] != "O":
                    continue

                if not reaches_border(r, c, set()):
                    board[r][c] = "X"
```

```cpp filename:C%2B%2B
class Solution {
public:
    void solve(vector<vector<char>>& board) {
        int rows = board.size(), cols = board[0].size();
        vector<vector<bool>> visited;

        // Can this 'O' reach the border through other 'O's?
        function<bool(int, int)> reachesBorder = [&](int r, int c) -> bool {
            if (r < 0 || r >= rows || c < 0 || c >= cols) return true;
            if (board[r][c] != 'O' || visited[r][c]) return false;

            visited[r][c] = true;

            return reachesBorder(r + 1, c) || reachesBorder(r - 1, c) ||
                   reachesBorder(r, c + 1) || reachesBorder(r, c - 1);
        };

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (board[r][c] != 'O') continue;

                visited.assign(rows, vector<bool>(cols, false));

                if (!reachesBorder(r, c)) board[r][c] = 'X';
            }
        }
    }
};
```

```java filename:Java
class Solution {
    private char[][] board;
    private boolean[][] visited;
    private int rows, cols;

    public void solve(char[][] board) {
        this.board = board;
        rows = board.length;
        cols = board[0].length;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (board[r][c] != 'O') continue;

                visited = new boolean[rows][cols];

                if (!reachesBorder(r, c)) board[r][c] = 'X';
            }
        }
    }

    // Can this 'O' reach the border through other 'O's?
    private boolean reachesBorder(int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return true;
        if (board[r][c] != 'O' || visited[r][c]) return false;

        visited[r][c] = true;

        return reachesBorder(r + 1, c) || reachesBorder(r - 1, c) ||
               reachesBorder(r, c + 1) || reachesBorder(r, c - 1);
    }
}
```

```javascript filename:JavaScript
var solve = function(board) {
    const rows = board.length;
    const cols = board[0].length;
    let visited;

    // Can this 'O' reach the border through other 'O's?
    const reachesBorder = (r, c) => {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return true;
        if (board[r][c] !== "O" || visited[r][c]) return false;

        visited[r][c] = true;

        return reachesBorder(r + 1, c) || reachesBorder(r - 1, c) ||
               reachesBorder(r, c + 1) || reachesBorder(r, c - 1);
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] !== "O") continue;

            visited = Array.from({ length: rows }, () => new Array(cols).fill(false));

            if (!reachesBorder(r, c)) board[r][c] = "X";
        }
    }
};
```

<strong>Time: O((R × C)^2) · Aux Space: O(R × C)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Solution:
    def solve(self, board):
        rows = len(board)
        cols = len(board[0])

        def dfs(r, c):
            if (
                r < 0 or r >= rows or
                c < 0 or c >= cols or
                board[r][c] != "O"
            ):
                return

            board[r][c] = "#"

            dfs(r + 1, c)
            dfs(r - 1, c)
            dfs(r, c + 1)
            dfs(r, c - 1)

        # Mark boundary-connected O's
        for r in range(rows):
            dfs(r, 0)
            dfs(r, cols - 1)

        for c in range(cols):
            dfs(0, c)
            dfs(rows - 1, c)

        # Capture surrounded regions
        for r in range(rows):
            for c in range(cols):
                if board[r][c] == "O":
                    board[r][c] = "X"
                elif board[r][c] == "#":
                    board[r][c] = "O"
```

```cpp filename:C%2B%2B
class Solution {
public:
    void solve(vector<vector<char>>& board) {
        int rows = board.size(), cols = board[0].size();

        function<void(int, int)> dfs = [&](int r, int c) {
            if (r < 0 || r >= rows || c < 0 || c >= cols || board[r][c] != 'O')
                return;

            board[r][c] = '#';

            dfs(r + 1, c);
            dfs(r - 1, c);
            dfs(r, c + 1);
            dfs(r, c - 1);
        };

        // Mark boundary-connected O's
        for (int r = 0; r < rows; r++) {
            dfs(r, 0);
            dfs(r, cols - 1);
        }

        for (int c = 0; c < cols; c++) {
            dfs(0, c);
            dfs(rows - 1, c);
        }

        // Capture surrounded regions
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (board[r][c] == 'O') board[r][c] = 'X';
                else if (board[r][c] == '#') board[r][c] = 'O';
            }
        }
    }
};
```

```java filename:Java
class Solution {
    private char[][] board;
    private int rows, cols;

    public void solve(char[][] board) {
        this.board = board;
        rows = board.length;
        cols = board[0].length;

        // Mark boundary-connected O's
        for (int r = 0; r < rows; r++) {
            dfs(r, 0);
            dfs(r, cols - 1);
        }

        for (int c = 0; c < cols; c++) {
            dfs(0, c);
            dfs(rows - 1, c);
        }

        // Capture surrounded regions
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (board[r][c] == 'O') board[r][c] = 'X';
                else if (board[r][c] == '#') board[r][c] = 'O';
            }
        }
    }

    private void dfs(int r, int c) {
        if (r < 0 || r >= rows || c < 0 || c >= cols || board[r][c] != 'O')
            return;

        board[r][c] = '#';

        dfs(r + 1, c);
        dfs(r - 1, c);
        dfs(r, c + 1);
        dfs(r, c - 1);
    }
}
```

```javascript filename:JavaScript
var solve = function(board) {
    const rows = board.length;
    const cols = board[0].length;

    const dfs = (r, c) => {
        if (
            r < 0 || r >= rows ||
            c < 0 || c >= cols ||
            board[r][c] !== "O"
        ) return;

        board[r][c] = "#";

        dfs(r + 1, c);
        dfs(r - 1, c);
        dfs(r, c + 1);
        dfs(r, c - 1);
    };

    // Mark boundary-connected O's
    for (let r = 0; r < rows; r++) {
        dfs(r, 0);
        dfs(r, cols - 1);
    }

    for (let c = 0; c < cols; c++) {
        dfs(0, c);
        dfs(rows - 1, c);
    }

    // Capture surrounded regions
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === "O") board[r][c] = "X";
            else if (board[r][c] === "#") board[r][c] = "O";
        }
    }
};
```

<strong>Time: O(R × C) · Aux Space: O(R × C)</strong>

# Takeaway

<strong>Pattern:</strong> Boundary-first DFS/BFS.
