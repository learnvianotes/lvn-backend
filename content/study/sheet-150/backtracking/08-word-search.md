---
id: 4937cc5f-a7d7-70cc-930c-1e7e38c5f99f
key: problem:sheet-150/lc-79
subject: sheet-150
topic: backtracking
title: Word Search
slug: word-search
order: 8
---

Difficulty: <strong>Medium</strong> · [LeetCode 79](https://leetcode.com/problems/word-search/)

# Problem

Find whether a word exists in a grid by moving up/down/left/right.

# Understanding the problem

Let R = rows, C = columns, L = word length. The first character can start from R × C cells. After that, there are up to 4 choices initially and at most 3 choices afterward because we don't immediately revisit the previous cell.

# Intuition

Prune impossible searches before DFS: check whether the word's character frequency exists in the board, search from the rarer end of the word (reverse if `board_count[word[0]] > board_count[word[-1]]`), and use in-place marking.

# Approach

1. Count character frequencies in `board` and `word` using `Counter`.
2. If board lacks any character required by word, return `False`.
3. If `board_count[word[0]] > board_count[word[-1]]`, reverse word to start search from the rarer end.
4. Run DFS from matching start cells using in-place `'#'` cell marking and backtracking.

# Naive Solution

Try every cell as the starting position and recursively explore all four directions.

```python filename:Python
class Solution:
    def exist(self, board, word):
        rows = len(board)
        cols = len(board[0])

        def dfs(r, c, index):
            if index == len(word):
                return True

            if r < 0 or r >= rows or c < 0 or c >= cols:
                return False

            if board[r][c] != word[index]:
                return False

            original = board[r][c]
            board[r][c] = '#'

            found = (
                dfs(r + 1, c, index + 1) or
                dfs(r - 1, c, index + 1) or
                dfs(r, c + 1, index + 1) or
                dfs(r, c - 1, index + 1)
            )

            board[r][c] = original
            return found

        for r in range(rows):
            for c in range(cols):
                if dfs(r, c, 0):
                    return True

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool exist(vector<vector<char>>& board, string word) {
        int rows = board.size();
        int cols = board[0].size();

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (dfs(board, word, r, c, 0)) return true;
            }
        }

        return false;
    }

private:
    bool dfs(vector<vector<char>>& board, const string& word, int r, int c, int index) {
        if (index == (int)word.size()) return true;

        if (r < 0 || r >= (int)board.size() || c < 0 || c >= (int)board[0].size()) return false;

        if (board[r][c] != word[index]) return false;

        char original = board[r][c];
        board[r][c] = '#';

        bool found = dfs(board, word, r + 1, c, index + 1) ||
                     dfs(board, word, r - 1, c, index + 1) ||
                     dfs(board, word, r, c + 1, index + 1) ||
                     dfs(board, word, r, c - 1, index + 1);

        board[r][c] = original;
        return found;
    }
};
```

```java filename:Java
class Solution {
    public boolean exist(char[][] board, String word) {
        int rows = board.length;
        int cols = board[0].length;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (dfs(board, word, r, c, 0)) return true;
            }
        }

        return false;
    }

    private boolean dfs(char[][] board, String word, int r, int c, int index) {
        if (index == word.length()) return true;

        if (r < 0 || r >= board.length || c < 0 || c >= board[0].length) return false;

        if (board[r][c] != word.charAt(index)) return false;

        char original = board[r][c];
        board[r][c] = '#';

        boolean found = dfs(board, word, r + 1, c, index + 1) ||
                        dfs(board, word, r - 1, c, index + 1) ||
                        dfs(board, word, r, c + 1, index + 1) ||
                        dfs(board, word, r, c - 1, index + 1);

        board[r][c] = original;
        return found;
    }
}
```

```javascript filename:JavaScript
var exist = function(board, word) {
    const rows = board.length;
    const cols = board[0].length;

    const dfs = (r, c, index) => {
        if (index === word.length) return true;

        if (r < 0 || r >= rows || c < 0 || c >= cols) return false;

        if (board[r][c] !== word[index]) return false;

        const original = board[r][c];
        board[r][c] = '#';

        const found =
            dfs(r + 1, c, index + 1) ||
            dfs(r - 1, c, index + 1) ||
            dfs(r, c + 1, index + 1) ||
            dfs(r, c - 1, index + 1);

        board[r][c] = original;
        return found;
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (dfs(r, c, 0)) return true;
        }
    }

    return false;
};
```

<strong>Time: O(R × C × 4 × 3^(L-1)) · Aux Space: O(L)</strong>

# Code (Optimized)

```python filename:Python
from collections import Counter

class Solution:
    def exist(self, board, word):
        rows = len(board)
        cols = len(board[0])

        board_count = Counter(
            cell
            for row in board
            for cell in row
        )

        word_count = Counter(word)

        for char, count in word_count.items():
            if board_count[char] < count:
                return False

        # Start from the rarer character
        if board_count[word[0]] > board_count[word[-1]]:
            word = word[::-1]

        def dfs(r, c, index):
            if index == len(word):
                return True

            if (
                r < 0 or r >= rows or
                c < 0 or c >= cols or
                board[r][c] != word[index]
            ):
                return False

            temp = board[r][c]
            board[r][c] = '#'

            found = (
                dfs(r + 1, c, index + 1) or
                dfs(r - 1, c, index + 1) or
                dfs(r, c + 1, index + 1) or
                dfs(r, c - 1, index + 1)
            )

            board[r][c] = temp
            return found

        for r in range(rows):
            for c in range(cols):
                if board[r][c] == word[0]:
                    if dfs(r, c, 0):
                        return True

        return False
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool exist(vector<vector<char>>& board, string word) {
        int rows = board.size();
        int cols = board[0].size();

        unordered_map<char, int> boardCount, wordCount;
        for (auto& row : board)
            for (char cell : row) boardCount[cell]++;
        for (char ch : word) wordCount[ch]++;

        for (auto& [ch, count] : wordCount) {
            if (boardCount[ch] < count) return false;
        }

        // Start from the rarer character
        if (boardCount[word[0]] > boardCount[word.back()]) {
            reverse(word.begin(), word.end());
        }

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (board[r][c] == word[0]) {
                    if (dfs(board, word, r, c, 0)) return true;
                }
            }
        }

        return false;
    }

private:
    bool dfs(vector<vector<char>>& board, const string& word, int r, int c, int index) {
        if (index == (int)word.size()) return true;

        if (r < 0 || r >= (int)board.size() ||
            c < 0 || c >= (int)board[0].size() ||
            board[r][c] != word[index]) {
            return false;
        }

        char temp = board[r][c];
        board[r][c] = '#';

        bool found = dfs(board, word, r + 1, c, index + 1) ||
                     dfs(board, word, r - 1, c, index + 1) ||
                     dfs(board, word, r, c + 1, index + 1) ||
                     dfs(board, word, r, c - 1, index + 1);

        board[r][c] = temp;
        return found;
    }
};
```

```java filename:Java
class Solution {
    public boolean exist(char[][] board, String word) {
        int rows = board.length;
        int cols = board[0].length;

        Map<Character, Integer> boardCount = new HashMap<>();
        Map<Character, Integer> wordCount = new HashMap<>();
        for (char[] row : board)
            for (char cell : row) boardCount.merge(cell, 1, Integer::sum);
        for (char ch : word.toCharArray()) wordCount.merge(ch, 1, Integer::sum);

        for (Map.Entry<Character, Integer> entry : wordCount.entrySet()) {
            if (boardCount.getOrDefault(entry.getKey(), 0) < entry.getValue()) return false;
        }

        // Start from the rarer character
        char first = word.charAt(0), last = word.charAt(word.length() - 1);
        if (boardCount.getOrDefault(first, 0) > boardCount.getOrDefault(last, 0)) {
            word = new StringBuilder(word).reverse().toString();
        }

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (board[r][c] == word.charAt(0)) {
                    if (dfs(board, word, r, c, 0)) return true;
                }
            }
        }

        return false;
    }

    private boolean dfs(char[][] board, String word, int r, int c, int index) {
        if (index == word.length()) return true;

        if (r < 0 || r >= board.length ||
            c < 0 || c >= board[0].length ||
            board[r][c] != word.charAt(index)) {
            return false;
        }

        char temp = board[r][c];
        board[r][c] = '#';

        boolean found = dfs(board, word, r + 1, c, index + 1) ||
                        dfs(board, word, r - 1, c, index + 1) ||
                        dfs(board, word, r, c + 1, index + 1) ||
                        dfs(board, word, r, c - 1, index + 1);

        board[r][c] = temp;
        return found;
    }
}
```

```javascript filename:JavaScript
var exist = function(board, word) {
    const rows = board.length;
    const cols = board[0].length;

    const boardCount = new Map();
    const wordCount = new Map();
    for (const row of board)
        for (const cell of row) boardCount.set(cell, (boardCount.get(cell) || 0) + 1);
    for (const ch of word) wordCount.set(ch, (wordCount.get(ch) || 0) + 1);

    for (const [ch, count] of wordCount) {
        if ((boardCount.get(ch) || 0) < count) return false;
    }

    // Start from the rarer character
    if ((boardCount.get(word[0]) || 0) > (boardCount.get(word[word.length - 1]) || 0)) {
        word = [...word].reverse().join('');
    }

    const dfs = (r, c, index) => {
        if (index === word.length) return true;

        if (
            r < 0 || r >= rows ||
            c < 0 || c >= cols ||
            board[r][c] !== word[index]
        ) {
            return false;
        }

        const temp = board[r][c];
        board[r][c] = '#';

        const found =
            dfs(r + 1, c, index + 1) ||
            dfs(r - 1, c, index + 1) ||
            dfs(r, c + 1, index + 1) ||
            dfs(r, c - 1, index + 1);

        board[r][c] = temp;
        return found;
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c] === word[0]) {
                if (dfs(r, c, 0)) return true;
            }
        }
    }

    return false;
};
```

<strong>Time: O(R × C × 4 × 3^(L-1)) · Aux Space: O(L) · Extra preprocessing: O(R × C + L)</strong>

# Takeaway

The optimization mainly improves practical pruning (character counting &amp; rarer-end search), rather than changing the worst-case exponential bound.
