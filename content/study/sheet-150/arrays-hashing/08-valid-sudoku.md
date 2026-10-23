---
id: 8c6ee77b-298c-7657-aa6e-3e1fc5999c03
key: problem:sheet-150/lc-36
subject: sheet-150
topic: arrays-hashing
title: Valid Sudoku
slug: valid-sudoku
order: 8
---

Difficulty: <strong>Medium</strong> · [LeetCode 36](https://leetcode.com/problems/valid-sudoku/)

# Problem

Determine if a 9×9 Sudoku board is valid. Each row, column, and 3×3 sub-box must contain digits 1–9 without repetition. Empty cells are `'.'`.

# Intuition

Track seen digits per row, column, and box simultaneously in ONE pass. Box index: `(r//3)*3 + (c//3)`. If any digit repeats in any set → invalid.

# Optimized Code

```python filename:Python
class Solution:
    def isValidSudoku(self, board: list[list[str]]) -> bool:
        rows = [set() for _ in range(9)]
        cols = [set() for _ in range(9)]
        boxes = [set() for _ in range(9)]
        for r in range(9):
            for c in range(9):
                v = board[r][c]
                if v == '.': continue
                box = (r//3)*3 + c//3
                if v in rows[r] or v in cols[c] or v in boxes[box]:
                    return False
                rows[r].add(v); cols[c].add(v); boxes[box].add(v)
        return True
```

```cpp filename:C%2B%2B
class Solution {
public:
    bool isValidSudoku(vector<vector<char>>& board) {
        unordered_set<char> rows[9], cols[9], boxes[9];
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++) {
                char v = board[r][c];
                if (v == '.') continue;
                int box = (r / 3) * 3 + c / 3;
                if (rows[r].count(v) || cols[c].count(v) || boxes[box].count(v))
                    return false;
                rows[r].insert(v); cols[c].insert(v); boxes[box].insert(v);
            }
        return true;
    }
};
```

```java filename:Java
class Solution {
    public boolean isValidSudoku(char[][] board) {
        List<Set<Character>> rows = new ArrayList<>(), cols = new ArrayList<>(), boxes = new ArrayList<>();
        for (int i = 0; i < 9; i++) {
            rows.add(new HashSet<>()); cols.add(new HashSet<>()); boxes.add(new HashSet<>());
        }
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++) {
                char v = board[r][c];
                if (v == '.') continue;
                int box = (r / 3) * 3 + c / 3;
                if (rows.get(r).contains(v) || cols.get(c).contains(v) || boxes.get(box).contains(v))
                    return false;
                rows.get(r).add(v); cols.get(c).add(v); boxes.get(box).add(v);
            }
        return true;
    }
}
```

```javascript filename:JavaScript
var isValidSudoku = function(board) {
    const rows=[...Array(9)].map(()=>new Set());
    const cols=[...Array(9)].map(()=>new Set());
    const boxes=[...Array(9)].map(()=>new Set());
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
        const v=board[r][c]; if(v==='.') continue;
        const box=Math.floor(r/3)*3+Math.floor(c/3);
        if(rows[r].has(v)||cols[c].has(v)||boxes[box].has(v)) return false;
        rows[r].add(v);cols[c].add(v);boxes[box].add(v);
    }
    return true;
};
```

<strong>Time: O(81) = O(1) · Space: O(81) = O(1)</strong>

# Takeaway

<strong>Pattern: Multi-Constraint Tracking in One Pass</strong> — Maintain separate sets for each constraint dimension. Box formula: `(r//3)*3 + c//3`.
