---
id: 53731c9a-7dbd-7495-838b-c23bb99d449a
key: problem:sheet-150/lc-51
subject: sheet-150
topic: backtracking
title: N-Queens
slug: n-queens
order: 6
---

Difficulty: <strong>Hard</strong> · [LeetCode 51](https://leetcode.com/problems/n-queens/)

# Problem

Place n queens on an n × n board so that no two queens attack each other.

# Understanding the problem

At each row, we have up to n choices. Placements must be checked for column, positive diagonal (row + col), and negative diagonal (row - col) collisions.

# Intuition

Instead of scanning the board every time, maintain three sets: `columns`, positive diagonals (`row + col`), and negative diagonals (`row - col`). Then checking whether a position is safe becomes O(1).

# Approach

1. Initialize board and three hash sets: `columns`, `positive_diagonals`, `negative_diagonals`.
2. Define `backtrack(row)`. If `row == n`, add formatted board to `result`.
3. Loop `col` from `0` to `n - 1`.
4. If `col in columns`, `row + col in positive_diagonals`, or `row - col in negative_diagonals`, skip.
5. Place `"Q"`, add to all 3 sets, recurse `row + 1`, and then backtrack (remove `"Q"` and remove from sets).

# Naive Solution

Try placing a queen in every column of every row, then check whether the board is valid with an `is_safe` helper function scanning the board in O(n) time.

```python filename:Python
class Solution:
    def solveNQueens(self, n):
        result = []
        board = [["."] * n for _ in range(n)]

        def is_safe(row, col):
            # Check column
            for r in range(row):
                if board[r][col] == "Q":
                    return False

            # Check upper-left diagonal
            r, c = row - 1, col - 1
            while r >= 0 and c >= 0:
                if board[r][c] == "Q":
                    return False
                r -= 1
                c -= 1

            # Check upper-right diagonal
            r, c = row - 1, col + 1
            while r >= 0 and c < n:
                if board[r][c] == "Q":
                    return False
                r -= 1
                c += 1

            return True

        def backtrack(row):
            if row == n:
                result.append(
                    ["".join(r) for r in board]
                )
                return

            for col in range(n):
                if is_safe(row, col):
                    board[row][col] = "Q"
                    backtrack(row + 1)
                    board[row][col] = "."

        backtrack(0)
        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<string>> solveNQueens(int n) {
        vector<vector<string>> result;
        vector<string> board(n, string(n, '.'));
        backtrack(0, n, board, result);
        return result;
    }

private:
    bool isSafe(int row, int col, int n, vector<string>& board) {
        // Check column
        for (int r = 0; r < row; r++) {
            if (board[r][col] == 'Q') return false;
        }

        // Check upper-left diagonal
        for (int r = row - 1, c = col - 1; r >= 0 && c >= 0; r--, c--) {
            if (board[r][c] == 'Q') return false;
        }

        // Check upper-right diagonal
        for (int r = row - 1, c = col + 1; r >= 0 && c < n; r--, c++) {
            if (board[r][c] == 'Q') return false;
        }

        return true;
    }

    void backtrack(int row, int n, vector<string>& board, vector<vector<string>>& result) {
        if (row == n) {
            result.push_back(board);
            return;
        }

        for (int col = 0; col < n; col++) {
            if (isSafe(row, col, n, board)) {
                board[row][col] = 'Q';
                backtrack(row + 1, n, board, result);
                board[row][col] = '.';
            }
        }
    }
};
```

```java filename:Java
class Solution {
    public List<List<String>> solveNQueens(int n) {
        List<List<String>> result = new ArrayList<>();
        char[][] board = new char[n][n];
        for (char[] row : board) Arrays.fill(row, '.');

        backtrack(0, n, board, result);
        return result;
    }

    private boolean isSafe(int row, int col, int n, char[][] board) {
        // Check column
        for (int r = 0; r < row; r++) {
            if (board[r][col] == 'Q') return false;
        }

        // Check upper-left diagonal
        for (int r = row - 1, c = col - 1; r >= 0 && c >= 0; r--, c--) {
            if (board[r][c] == 'Q') return false;
        }

        // Check upper-right diagonal
        for (int r = row - 1, c = col + 1; r >= 0 && c < n; r--, c++) {
            if (board[r][c] == 'Q') return false;
        }

        return true;
    }

    private void backtrack(int row, int n, char[][] board, List<List<String>> result) {
        if (row == n) {
            List<String> snapshot = new ArrayList<>();
            for (char[] r : board) snapshot.add(new String(r));
            result.add(snapshot);
            return;
        }

        for (int col = 0; col < n; col++) {
            if (isSafe(row, col, n, board)) {
                board[row][col] = 'Q';
                backtrack(row + 1, n, board, result);
                board[row][col] = '.';
            }
        }
    }
}
```

```javascript filename:JavaScript
var solveNQueens = function(n) {
    const result = [];
    const board = Array.from({ length: n }, () => new Array(n).fill('.'));

    const isSafe = (row, col) => {
        // Check column
        for (let r = 0; r < row; r++) {
            if (board[r][col] === 'Q') return false;
        }

        // Check upper-left diagonal
        for (let r = row - 1, c = col - 1; r >= 0 && c >= 0; r--, c--) {
            if (board[r][c] === 'Q') return false;
        }

        // Check upper-right diagonal
        for (let r = row - 1, c = col + 1; r >= 0 && c < n; r--, c++) {
            if (board[r][c] === 'Q') return false;
        }

        return true;
    };

    const backtrack = (row) => {
        if (row === n) {
            result.push(board.map((r) => r.join('')));
            return;
        }

        for (let col = 0; col < n; col++) {
            if (isSafe(row, col)) {
                board[row][col] = 'Q';
                backtrack(row + 1);
                board[row][col] = '.';
            }
        }
    };

    backtrack(0);
    return result;
};
```

<strong>Time: O(n^2 × n!) approx · Aux Space: O(n^2) board + O(n) recursion · Output Space: O(number of solutions × n^2)</strong>

# Code (Optimized)

```python filename:Python
class Solution:
    def solveNQueens(self, n):
        result = []

        board = [["."] * n for _ in range(n)]

        columns = set()
        positive_diagonals = set()  # row + col
        negative_diagonals = set()  # row - col

        def backtrack(row):
            if row == n:
                result.append(
                    ["".join(r) for r in board]
                )
                return

            for col in range(n):
                if col in columns:
                    continue

                if row + col in positive_diagonals:
                    continue

                if row - col in negative_diagonals:
                    continue

                # Place queen
                board[row][col] = "Q"
                columns.add(col)
                positive_diagonals.add(row + col)
                negative_diagonals.add(row - col)

                backtrack(row + 1)

                # Backtrack
                board[row][col] = "."
                columns.remove(col)
                positive_diagonals.remove(row + col)
                negative_diagonals.remove(row - col)

        backtrack(0)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<vector<string>> solveNQueens(int n) {
        vector<vector<string>> result;
        vector<string> board(n, string(n, '.'));

        unordered_set<int> columns;
        unordered_set<int> positiveDiagonals;  // row + col
        unordered_set<int> negativeDiagonals;  // row - col

        function<void(int)> backtrack = [&](int row) {
            if (row == n) {
                result.push_back(board);
                return;
            }

            for (int col = 0; col < n; col++) {
                if (columns.count(col)) continue;

                if (positiveDiagonals.count(row + col)) continue;

                if (negativeDiagonals.count(row - col)) continue;

                // Place queen
                board[row][col] = 'Q';
                columns.insert(col);
                positiveDiagonals.insert(row + col);
                negativeDiagonals.insert(row - col);

                backtrack(row + 1);

                // Backtrack
                board[row][col] = '.';
                columns.erase(col);
                positiveDiagonals.erase(row + col);
                negativeDiagonals.erase(row - col);
            }
        };

        backtrack(0);

        return result;
    }
};
```

```java filename:Java
class Solution {
    private List<List<String>> result = new ArrayList<>();
    private char[][] board;

    private Set<Integer> columns = new HashSet<>();
    private Set<Integer> positiveDiagonals = new HashSet<>();  // row + col
    private Set<Integer> negativeDiagonals = new HashSet<>();  // row - col

    public List<List<String>> solveNQueens(int n) {
        board = new char[n][n];
        for (char[] row : board) Arrays.fill(row, '.');

        backtrack(0, n);

        return result;
    }

    private void backtrack(int row, int n) {
        if (row == n) {
            List<String> snapshot = new ArrayList<>();
            for (char[] r : board) snapshot.add(new String(r));
            result.add(snapshot);
            return;
        }

        for (int col = 0; col < n; col++) {
            if (columns.contains(col)) continue;

            if (positiveDiagonals.contains(row + col)) continue;

            if (negativeDiagonals.contains(row - col)) continue;

            // Place queen
            board[row][col] = 'Q';
            columns.add(col);
            positiveDiagonals.add(row + col);
            negativeDiagonals.add(row - col);

            backtrack(row + 1, n);

            // Backtrack
            board[row][col] = '.';
            columns.remove(col);
            positiveDiagonals.remove(row + col);
            negativeDiagonals.remove(row - col);
        }
    }
}
```

```javascript filename:JavaScript
var solveNQueens = function(n) {
    const result = [];

    const board = Array.from({ length: n }, () => new Array(n).fill('.'));

    const columns = new Set();
    const positiveDiagonals = new Set();  // row + col
    const negativeDiagonals = new Set();  // row - col

    const backtrack = (row) => {
        if (row === n) {
            result.push(board.map((r) => r.join('')));
            return;
        }

        for (let col = 0; col < n; col++) {
            if (columns.has(col)) continue;

            if (positiveDiagonals.has(row + col)) continue;

            if (negativeDiagonals.has(row - col)) continue;

            // Place queen
            board[row][col] = 'Q';
            columns.add(col);
            positiveDiagonals.add(row + col);
            negativeDiagonals.add(row - col);

            backtrack(row + 1);

            // Backtrack
            board[row][col] = '.';
            columns.delete(col);
            positiveDiagonals.delete(row + col);
            negativeDiagonals.delete(row - col);
        }
    };

    backtrack(0);

    return result;
};
```

<strong>Safety Check: O(1) · Time: O(n × n!) approx · Aux Space: O(n^2) board + O(n) sets/recursion · Output Space: O(number of solutions × n^2)</strong>

# Takeaway

Safety check is reduced to O(1) using sets for columns and diagonals. The search itself remains exponential (O(n × n!) approx).
