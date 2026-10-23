---
id: 1abd0ed4-bbce-719a-baf7-f739dbc3eee6
key: problem:sheet-150/lc-211
subject: sheet-150
topic: tries
title: Design Add and Search Words Data Structure
slug: design-add-and-search-words-data-structure
order: 2
---

Difficulty: <strong>Medium</strong> · [LeetCode 211](https://leetcode.com/problems/design-add-and-search-words-data-structure/)

# Problem

Design a data structure supporting `addWord(word)` and `search(word)` where `'.'` in search patterns matches any single character.

# Understanding the problem

A wildcard `'.'` means branching into every child of the current Trie node simultaneously — a DFS over all children.

# Intuition

Build a Trie for fast prefix traversal. When encountering `'.'`, branch into all children via DFS and return `True` if any branch succeeds.

# Approach

1. Build Trie with `TrieNode(children, is_word)` exactly as LC 208.
2. `addWord` inserts into the Trie identically.
3. `search(word)` calls `dfs(index, node)`.
4. Base case: `index == len(word)` → return `node.is_word`.
5. If `word[index] != '.'`: advance into `node.children[char]` if exists.
6. If `word[index] == '.'`: iterate all `node.children.values()` and return `True` if any recursive call returns True.

# Naive Solution — Brute Force

Store words in a list and compare each candidate against the search pattern character-by-character.

```python filename:Python
class WordDictionary:

    def __init__(self):
        self.words = []

    def addWord(self, word):
        self.words.append(word)

    def search(self, word):

        for candidate in self.words:

            if len(candidate) != len(word):
                continue

            match = True

            for i in range(len(word)):

                if (
                    word[i] != "."
                    and word[i] != candidate[i]
                ):
                    match = False
                    break

            if match:
                return True

        return False
```

```cpp filename:C%2B%2B
class WordDictionary {
public:
    WordDictionary() {}

    void addWord(string word) {
        words.push_back(word);
    }

    bool search(string word) {
        for (const string& candidate : words) {
            if (candidate.size() != word.size()) continue;

            bool match = true;

            for (int i = 0; i < (int)word.size(); i++) {
                if (word[i] != '.' && word[i] != candidate[i]) {
                    match = false;
                    break;
                }
            }

            if (match) return true;
        }

        return false;
    }

private:
    vector<string> words;
};
```

```java filename:Java
class WordDictionary {
    private List<String> words;

    public WordDictionary() {
        words = new ArrayList<>();
    }

    public void addWord(String word) {
        words.add(word);
    }

    public boolean search(String word) {
        for (String candidate : words) {
            if (candidate.length() != word.length()) continue;

            boolean match = true;

            for (int i = 0; i < word.length(); i++) {
                if (word.charAt(i) != '.' && word.charAt(i) != candidate.charAt(i)) {
                    match = false;
                    break;
                }
            }

            if (match) return true;
        }

        return false;
    }
}
```

```javascript filename:JavaScript
class WordDictionary {
    constructor() {
        this.words = [];
    }

    addWord(word) {
        this.words.push(word);
    }

    search(word) {
        for (const candidate of this.words) {
            if (candidate.length !== word.length) continue;

            let match = true;

            for (let i = 0; i < word.length; i++) {
                if (word[i] !== "." && word[i] !== candidate[i]) {
                    match = false;
                    break;
                }
            }

            if (match) return true;
        }

        return false;
    }
}
```

<strong>addWord: O(1), search: O(N × L) · Space: O(N × L)</strong>

# Optimized Code (Python 3)

```python filename:Python
class TrieNode:

    def __init__(self):
        self.children = {}
        self.is_word = False


class WordDictionary:

    def __init__(self):
        self.root = TrieNode()

    def addWord(self, word):

        node = self.root

        for char in word:

            if char not in node.children:
                node.children[char] = TrieNode()

            node = node.children[char]

        node.is_word = True

    def search(self, word):

        def dfs(index, node):

            if index == len(word):
                return node.is_word

            char = word[index]

            if char != ".":

                if char not in node.children:
                    return False

                return dfs(
                    index + 1,
                    node.children[char]
                )

            # Wildcard: try all children
            for child in node.children.values():

                if dfs(index + 1, child):
                    return True

            return False

        return dfs(0, self.root)
```

```cpp filename:C%2B%2B
struct TrieNode {
    unordered_map<char, TrieNode*> children;
    bool isWord = false;
};

class WordDictionary {
public:
    WordDictionary() : root(new TrieNode()) {}

    void addWord(string word) {
        TrieNode* node = root;

        for (char c : word) {
            if (!node->children.count(c)) node->children[c] = new TrieNode();

            node = node->children[c];
        }

        node->isWord = true;
    }

    bool search(string word) {
        return dfs(word, 0, root);
    }

private:
    TrieNode* root;

    bool dfs(const string& word, int index, TrieNode* node) {
        if (index == (int)word.size()) return node->isWord;

        char c = word[index];

        if (c != '.') {
            if (!node->children.count(c)) return false;

            return dfs(word, index + 1, node->children[c]);
        }

        // Wildcard: try all children
        for (auto& [_, child] : node->children) {
            if (dfs(word, index + 1, child)) return true;
        }

        return false;
    }
};
```

```java filename:Java
class TrieNode {
    Map<Character, TrieNode> children = new HashMap<>();
    boolean isWord = false;
}

class WordDictionary {
    private TrieNode root;

    public WordDictionary() {
        root = new TrieNode();
    }

    public void addWord(String word) {
        TrieNode node = root;

        for (char c : word.toCharArray()) {
            if (!node.children.containsKey(c)) node.children.put(c, new TrieNode());

            node = node.children.get(c);
        }

        node.isWord = true;
    }

    public boolean search(String word) {
        return dfs(word, 0, root);
    }

    private boolean dfs(String word, int index, TrieNode node) {
        if (index == word.length()) return node.isWord;

        char c = word.charAt(index);

        if (c != '.') {
            if (!node.children.containsKey(c)) return false;

            return dfs(word, index + 1, node.children.get(c));
        }

        // Wildcard: try all children
        for (TrieNode child : node.children.values()) {
            if (dfs(word, index + 1, child)) return true;
        }

        return false;
    }
}
```

```javascript filename:JavaScript
class TrieNode {
    constructor() {
        this.children = new Map();
        this.isWord = false;
    }
}

class WordDictionary {
    constructor() {
        this.root = new TrieNode();
    }

    addWord(word) {
        let node = this.root;

        for (const char of word) {
            if (!node.children.has(char)) node.children.set(char, new TrieNode());

            node = node.children.get(char);
        }

        node.isWord = true;
    }

    search(word) {
        const dfs = (index, node) => {
            if (index === word.length) return node.isWord;

            const char = word[index];

            if (char !== ".") {
                if (!node.children.has(char)) return false;

                return dfs(index + 1, node.children.get(char));
            }

            // Wildcard: try all children
            for (const child of node.children.values()) {
                if (dfs(index + 1, child)) return true;
            }

            return false;
        };

        return dfs(0, this.root);
    }
}
```

<strong>addWord: O(L), search: O(L) normal / O(26^L) worst with wildcards · Space: O(total chars) + O(L) DFS stack</strong>

# Takeaway

<strong>Pattern</strong> — Trie + DFS Backtracking for wildcard branching
