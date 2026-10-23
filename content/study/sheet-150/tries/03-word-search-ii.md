---
id: 6971fcc3-6f0e-7efb-b774-b57caa650fdd
key: problem:sheet-150/lc-212
subject: sheet-150
topic: tries
title: Word Search II
slug: word-search-ii
order: 3
---

Difficulty: <strong>Hard</strong> · [LeetCode 212](https://leetcode.com/problems/word-search-ii/)

# Problem

Given an `m x n` board of characters and a list of strings `words`, return all words from the list that can be found in the board (adjacent horizontal/vertical cells, no cell reused).

# Understanding the problem

Running separate board-DFS for each word is wasteful when words share prefixes. A Trie over all words enables prefix pruning — a non-matching prefix stops all further exploration.

# Intuition

Build a single Trie from all words. Run one DFS from every board cell navigating the Trie simultaneously. When the current character is not in the Trie node's children, prune immediately — this avoids exploring invalid prefixes shared across many words.

# Approach

1. Build Trie from all words, storing `node.word = word` (not `is_word`) at terminal nodes.
2. Outer loops: iterate every board cell `(r, c)` and call `dfs(r, c, root)`.
3. DFS checks: out-of-bounds, visited marker `'#'`, or char not in `node.children` → return immediately.
4. If `next_node.word is not None`: append to result and set `next_node.word = None` to prevent duplicates.
5. Mark cell `board[r][c] = '#'`, recurse in 4 directions with `next_node`, then restore cell.

# Naive Solution — Brute Force

For every word, start a full board DFS from every matching cell.

```python filename:Python
class Solution:

    def findWords(self, board, words):

        rows = len(board)
        cols = len(board[0])
        result = []

        def exists(word):

            def dfs(r, c, index):
                if index == len(word):
                    return True

                if (
                    r < 0 or r >= rows or c < 0 or c >= cols
                    or board[r][c] != word[index]
                ):
                    return False

                temp = board[r][c]
                board[r][c] = "#"

                found = (
                    dfs(r + 1, c, index + 1)
                    or dfs(r - 1, c, index + 1)
                    or dfs(r, c + 1, index + 1)
                    or dfs(r, c - 1, index + 1)
                )

                board[r][c] = temp
                return found

            for r in range(rows):
                for c in range(cols):
                    if board[r][c] == word[0]:
                        if dfs(r, c, 0):
                            return True

            return False

        for word in words:
            if exists(word):
                result.append(word)

        return result
```

```cpp filename:C%2B%2B
class Solution {
public:
    vector<string> findWords(vector<vector<char>>& board, vector<string>& words) {
        vector<string> result;

        for (const string& word : words) {
            if (exists(board, word)) result.push_back(word);
        }

        return result;
    }

private:
    bool exists(vector<vector<char>>& board, const string& word) {
        int rows = board.size(), cols = board[0].size();

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (board[r][c] == word[0] && dfs(board, word, r, c, 0)) return true;
            }
        }

        return false;
    }

    bool dfs(vector<vector<char>>& board, const string& word, int r, int c, int index) {
        if (index == (int)word.size()) return true;

        if (r < 0 || r >= (int)board.size() || c < 0 || c >= (int)board[0].size()
            || board[r][c] != word[index]) {
            return false;
        }

        char temp = board[r][c];
        board[r][c] = '#';

        bool found = dfs(board, word, r + 1, c, index + 1)
                  || dfs(board, word, r - 1, c, index + 1)
                  || dfs(board, word, r, c + 1, index + 1)
                  || dfs(board, word, r, c - 1, index + 1);

        board[r][c] = temp;
        return found;
    }
};
```

```java filename:Java
class Solution {
    public List<String> findWords(char[][] board, String[] words) {
        List<String> result = new ArrayList<>();

        for (String word : words) {
            if (exists(board, word)) result.add(word);
        }

        return result;
    }

    private boolean exists(char[][] board, String word) {
        int rows = board.length, cols = board[0].length;

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (board[r][c] == word.charAt(0) && dfs(board, word, r, c, 0)) return true;
            }
        }

        return false;
    }

    private boolean dfs(char[][] board, String word, int r, int c, int index) {
        if (index == word.length()) return true;

        if (r < 0 || r >= board.length || c < 0 || c >= board[0].length
            || board[r][c] != word.charAt(index)) {
            return false;
        }

        char temp = board[r][c];
        board[r][c] = '#';

        boolean found = dfs(board, word, r + 1, c, index + 1)
                     || dfs(board, word, r - 1, c, index + 1)
                     || dfs(board, word, r, c + 1, index + 1)
                     || dfs(board, word, r, c - 1, index + 1);

        board[r][c] = temp;
        return found;
    }
}
```

```javascript filename:JavaScript
var findWords = function(board, words) {
    const rows = board.length;
    const cols = board[0].length;
    const result = [];

    const exists = (word) => {
        const dfs = (r, c, index) => {
            if (index === word.length) return true;

            if (
                r < 0 || r >= rows || c < 0 || c >= cols
                || board[r][c] !== word[index]
            ) {
                return false;
            }

            const temp = board[r][c];
            board[r][c] = "#";

            const found = dfs(r + 1, c, index + 1)
                || dfs(r - 1, c, index + 1)
                || dfs(r, c + 1, index + 1)
                || dfs(r, c - 1, index + 1);

            board[r][c] = temp;
            return found;
        };

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c] === word[0] && dfs(r, c, 0)) return true;
            }
        }

        return false;
    };

    for (const word of words) {
        if (exists(word)) result.push(word);
    }

    return result;
};
```

<strong>Time: O(W × R × C × 4^L) · Space: O(L) recursion</strong>

# Optimized Code (Python 3)

```python filename:Python
class TrieNode:

    def __init__(self):
        self.children = {}
        self.word = None


class Solution:

    def findWords(self, board, words):

        root = TrieNode()

        # Build Trie from all words
        for word in words:

            node = root

            for char in word:

                if char not in node.children:
                    node.children[char] = TrieNode()

                node = node.children[char]

            node.word = word

        rows = len(board)
        cols = len(board[0])
        result = []

        def dfs(r, c, node):

            if r < 0 or r >= rows or c < 0 or c >= cols:
                return

            char = board[r][c]

            if char == "#":
                return

            if char not in node.children:
                return

            next_node = node.children[char]

            # Complete word found
            if next_node.word is not None:
                result.append(next_node.word)
                next_node.word = None  # prevent duplicates

            board[r][c] = "#"  # mark visited

            dfs(r + 1, c, next_node)
            dfs(r - 1, c, next_node)
            dfs(r, c + 1, next_node)
            dfs(r, c - 1, next_node)

            board[r][c] = char  # restore

        for r in range(rows):
            for c in range(cols):
                dfs(r, c, root)

        return result
```

```cpp filename:C%2B%2B
struct TrieNode {
    unordered_map<char, TrieNode*> children;
    string word;  // empty means "no word ends here"
};

class Solution {
public:
    vector<string> findWords(vector<vector<char>>& board, vector<string>& words) {
        TrieNode* root = new TrieNode();

        // Build Trie from all words
        for (const string& word : words) {
            TrieNode* node = root;

            for (char c : word) {
                if (!node->children.count(c)) node->children[c] = new TrieNode();

                node = node->children[c];
            }

            node->word = word;
        }

        vector<string> result;

        for (int r = 0; r < (int)board.size(); r++) {
            for (int c = 0; c < (int)board[0].size(); c++) {
                dfs(board, r, c, root, result);
            }
        }

        return result;
    }

private:
    void dfs(vector<vector<char>>& board, int r, int c, TrieNode* node, vector<string>& result) {
        if (r < 0 || r >= (int)board.size() || c < 0 || c >= (int)board[0].size()) return;

        char ch = board[r][c];

        if (ch == '#') return;

        if (!node->children.count(ch)) return;

        TrieNode* next = node->children[ch];

        // Complete word found
        if (!next->word.empty()) {
            result.push_back(next->word);
            next->word.clear();  // prevent duplicates
        }

        board[r][c] = '#';  // mark visited

        dfs(board, r + 1, c, next, result);
        dfs(board, r - 1, c, next, result);
        dfs(board, r, c + 1, next, result);
        dfs(board, r, c - 1, next, result);

        board[r][c] = ch;  // restore
    }
};
```

```java filename:Java
class TrieNode {
    Map<Character, TrieNode> children = new HashMap<>();
    String word = null;
}

class Solution {
    private char[][] board;
    private List<String> result;

    public List<String> findWords(char[][] board, String[] words) {
        TrieNode root = new TrieNode();

        // Build Trie from all words
        for (String word : words) {
            TrieNode node = root;

            for (char c : word.toCharArray()) {
                if (!node.children.containsKey(c)) node.children.put(c, new TrieNode());

                node = node.children.get(c);
            }

            node.word = word;
        }

        this.board = board;
        result = new ArrayList<>();

        for (int r = 0; r < board.length; r++) {
            for (int c = 0; c < board[0].length; c++) {
                dfs(r, c, root);
            }
        }

        return result;
    }

    private void dfs(int r, int c, TrieNode node) {
        if (r < 0 || r >= board.length || c < 0 || c >= board[0].length) return;

        char ch = board[r][c];

        if (ch == '#') return;

        if (!node.children.containsKey(ch)) return;

        TrieNode next = node.children.get(ch);

        // Complete word found
        if (next.word != null) {
            result.add(next.word);
            next.word = null;  // prevent duplicates
        }

        board[r][c] = '#';  // mark visited

        dfs(r + 1, c, next);
        dfs(r - 1, c, next);
        dfs(r, c + 1, next);
        dfs(r, c - 1, next);

        board[r][c] = ch;  // restore
    }
}
```

```javascript filename:JavaScript
class TrieNode {
    constructor() {
        this.children = new Map();
        this.word = null;
    }
}

var findWords = function(board, words) {
    const root = new TrieNode();

    // Build Trie from all words
    for (const word of words) {
        let node = root;

        for (const char of word) {
            if (!node.children.has(char)) node.children.set(char, new TrieNode());

            node = node.children.get(char);
        }

        node.word = word;
    }

    const rows = board.length;
    const cols = board[0].length;
    const result = [];

    const dfs = (r, c, node) => {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;

        const char = board[r][c];

        if (char === "#") return;

        if (!node.children.has(char)) return;

        const nextNode = node.children.get(char);

        // Complete word found
        if (nextNode.word !== null) {
            result.push(nextNode.word);
            nextNode.word = null; // prevent duplicates
        }

        board[r][c] = "#"; // mark visited

        dfs(r + 1, c, nextNode);
        dfs(r - 1, c, nextNode);
        dfs(r, c + 1, nextNode);
        dfs(r, c - 1, nextNode);

        board[r][c] = char; // restore
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            dfs(r, c, root);
        }
    }

    return result;
};
```

<strong>Time: O(R × C × 4^L) with prefix pruning · Space: O(total chars in words) + O(L) stack</strong>

# Takeaway

<strong>Pattern</strong> — Multi-word board search → Trie + DFS + Backtracking + Prefix Pruning
