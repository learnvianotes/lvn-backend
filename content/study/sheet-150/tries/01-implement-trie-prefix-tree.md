---
id: a583d3f4-ab4d-76ee-b4f5-fcfb14cfdf25
key: problem:sheet-150/lc-208
subject: sheet-150
topic: tries
title: Implement Trie (Prefix Tree)
slug: implement-trie-prefix-tree
order: 1
---

Difficulty: <strong>Medium</strong> · [LeetCode 208](https://leetcode.com/problems/implement-trie-prefix-tree/)

# Problem

Implement a trie data structure supporting `insert(word)`, `search(word)`, and `startsWith(prefix)`.

# Understanding the problem

A Trie stores strings character-by-character as a tree. Each node tracks its children and whether a complete word ends there.

# Intuition

Store characters in a tree where each edge is a character. Traverse character-by-character for O(L) insert, search, and prefix checks.

# Approach

1. Define `TrieNode` with `children = {}` and `is_word = False`.
2. `insert(word)`: Walk node-by-node from root, creating missing children. Set `node.is_word = True` at last character.
3. `search(word)`: Walk node-by-node. Return `False` if any character is missing. Return `node.is_word` at end.
4. `startsWith(prefix)`: Same traversal as `search` but return `True` regardless of `is_word` at end.

# Naive Solution — Brute Force

Store all words in a list and perform string operations on every query.

```python filename:Python
class Trie:

    def __init__(self):
        self.words = []

    def insert(self, word):
        if word not in self.words:
            self.words.append(word)

    def search(self, word):
        return word in self.words

    def startsWith(self, prefix):
        for word in self.words:
            if word.startswith(prefix):
                return True

        return False
```

```cpp filename:C%2B%2B
class Trie {
public:
    Trie() {}

    void insert(string word) {
        if (find(words.begin(), words.end(), word) == words.end()) {
            words.push_back(word);
        }
    }

    bool search(string word) {
        return find(words.begin(), words.end(), word) != words.end();
    }

    bool startsWith(string prefix) {
        for (const string& word : words) {
            if (word.compare(0, prefix.size(), prefix) == 0) return true;
        }

        return false;
    }

private:
    vector<string> words;
};
```

```java filename:Java
class Trie {
    private List<String> words;

    public Trie() {
        words = new ArrayList<>();
    }

    public void insert(String word) {
        if (!words.contains(word)) {
            words.add(word);
        }
    }

    public boolean search(String word) {
        return words.contains(word);
    }

    public boolean startsWith(String prefix) {
        for (String word : words) {
            if (word.startsWith(prefix)) return true;
        }

        return false;
    }
}
```

```javascript filename:JavaScript
class Trie {
    constructor() {
        this.words = [];
    }

    insert(word) {
        if (!this.words.includes(word)) {
            this.words.push(word);
        }
    }

    search(word) {
        return this.words.includes(word);
    }

    startsWith(prefix) {
        for (const word of this.words) {
            if (word.startsWith(prefix)) return true;
        }

        return false;
    }
}
```

<strong>insert/search/startsWith: O(N × L) · Space: O(N × L)</strong>

# Optimized Code (Python 3)

```python filename:Python
class TrieNode:

    def __init__(self):
        self.children = {}
        self.is_word = False


class Trie:

    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):

        node = self.root

        for char in word:

            if char not in node.children:
                node.children[char] = TrieNode()

            node = node.children[char]

        node.is_word = True

    def search(self, word):

        node = self.root

        for char in word:

            if char not in node.children:
                return False

            node = node.children[char]

        return node.is_word

    def startsWith(self, prefix):

        node = self.root

        for char in prefix:

            if char not in node.children:
                return False

            node = node.children[char]

        return True
```

```cpp filename:C%2B%2B
struct TrieNode {
    unordered_map<char, TrieNode*> children;
    bool isWord = false;
};

class Trie {
public:
    Trie() : root(new TrieNode()) {}

    void insert(string word) {
        TrieNode* node = root;

        for (char c : word) {
            if (!node->children.count(c)) node->children[c] = new TrieNode();

            node = node->children[c];
        }

        node->isWord = true;
    }

    bool search(string word) {
        TrieNode* node = root;

        for (char c : word) {
            if (!node->children.count(c)) return false;

            node = node->children[c];
        }

        return node->isWord;
    }

    bool startsWith(string prefix) {
        TrieNode* node = root;

        for (char c : prefix) {
            if (!node->children.count(c)) return false;

            node = node->children[c];
        }

        return true;
    }

private:
    TrieNode* root;
};
```

```java filename:Java
class TrieNode {
    Map<Character, TrieNode> children = new HashMap<>();
    boolean isWord = false;
}

class Trie {
    private TrieNode root;

    public Trie() {
        root = new TrieNode();
    }

    public void insert(String word) {
        TrieNode node = root;

        for (char c : word.toCharArray()) {
            if (!node.children.containsKey(c)) node.children.put(c, new TrieNode());

            node = node.children.get(c);
        }

        node.isWord = true;
    }

    public boolean search(String word) {
        TrieNode node = root;

        for (char c : word.toCharArray()) {
            if (!node.children.containsKey(c)) return false;

            node = node.children.get(c);
        }

        return node.isWord;
    }

    public boolean startsWith(String prefix) {
        TrieNode node = root;

        for (char c : prefix.toCharArray()) {
            if (!node.children.containsKey(c)) return false;

            node = node.children.get(c);
        }

        return true;
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

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word) {
        let node = this.root;

        for (const char of word) {
            if (!node.children.has(char)) node.children.set(char, new TrieNode());

            node = node.children.get(char);
        }

        node.isWord = true;
    }

    search(word) {
        let node = this.root;

        for (const char of word) {
            if (!node.children.has(char)) return false;

            node = node.children.get(char);
        }

        return node.isWord;
    }

    startsWith(prefix) {
        let node = this.root;

        for (const char of prefix) {
            if (!node.children.has(char)) return false;

            node = node.children.get(char);
        }

        return true;
    }
}
```

<strong>insert/search/startsWith: O(L) · Space: O(total characters inserted)</strong>

# Takeaway

<strong>Pattern</strong> — Efficient prefix lookup → Trie (Hash Map per node)
