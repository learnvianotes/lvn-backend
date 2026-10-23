---
id: daed7b4d-94f2-7d8c-8144-fb57d2bded98
key: topic:dsa-advanced/trie
subject: dsa-advanced
topic: trie
title: Trie Data Structure
slug: trie-data-structure
order: 1
---

A trie (prefix tree) stores a set of words as a tree of characters, so that every operation costs time proportional to the <strong>length of the word</strong> — not to the number of words — and so that words sharing a prefix share a path. It is the structure behind autocomplete, spell-checkers and IP routing tables.

> [!INFO]
>
> <strong>Trie</strong> — a rooted tree in which every edge is labelled with a character and every node represents the prefix spelled out by the path from the root. A flag on a node marks that this prefix is a complete word. The root represents the empty string.

```text filename:Trie%20for%20%7B%20geeks%2C%20geek%2C%20bad%2C%20bat%2C%20cat%2C%20cut%20%7D%20%E2%80%94%20%22geek%22%20and%20%22geeks%22%20share%20one%20path%2C%20%22ba%22%20is%20a%20prefix%20of%20two%20words
         (root)
  ┌────────┼────────┐
  b        c        g
  │     ┌──┴──┐     │
  a     a     u     e
┌─┴─┐   │     │     │
d*  t*  t*    t*    e
                    │
                    k*          * = isEndOfWord
                    │
                    s*
```

Tries are the right choice when a dictionary of words must support these operations efficiently:

1. <strong>Search</strong> — is this exact word in the dictionary?
2. <strong>Insert</strong> — add a word.
3. <strong>Delete</strong> — remove a word (without disturbing words that share its prefix).
4. <strong>Prefix search</strong> — does any word start with `pre`? List them all (autocomplete).
5. <strong>Lexicographic ordering</strong> — a pre-order traversal visits the words in sorted order for free.

| Operation | Trie | Hash table |
| --- | --- | --- |
| Search | Θ(word\_len) | Θ(word\_len) average |
| Insert | Θ(word\_len) | Θ(word\_len) average |
| Delete | Θ(word\_len) | Θ(word\_len) average |
| Prefix search | Θ(prefix\_len) | not supported |
| Lexicographic ordering | Θ(output\_len) | not supported (needs a sort) |
| Memory | high — up to 26 pointers per node | low |

> [!NOTE] Key point
>
> A hash table matches a trie on exact-match operations, and uses far less memory. Reach for a trie only when you need <strong>prefix</strong> queries or <strong>sorted</strong> output — those are the operations a hash table simply cannot do.

# Trie representation

For lowercase English words each node holds an array of 26 child pointers (index `ch − 'a'`) and a boolean `isEndOfWord`. The characters themselves are not stored in the nodes — they are implied by the array index on the way down.

```python filename:Python
class TrieNode:
    def __init__(self):
        self.child = [None] * 26          # child[i] → node for chr(ord('a') + i), or None
        self.is_end_of_word = False       # True ⇔ the path from the root spells a stored word

root = TrieNode()                         # the empty trie: a root with no children
print(sum(c is not None for c in root.child), root.is_end_of_word)
```

```text filename:Output
0 False
```

| Field | Meaning |
| --- | --- |
| `child[26]` | one slot per letter; `None`/`nullptr` means no word continues with that letter |
| `isEndOfWord` | marks a complete word — needed because `geek` must be found while `gee` must not |

> [!NOTE] Variants
>
> Alphabets larger than 26 letters (Unicode, arbitrary bytes) use a hash map from character to child instead of a fixed array — slower per step, but the memory no longer scales with the alphabet size.

# Insert, search and prefix search

> [!TIP] Example
>
> <strong>Input:</strong> `insert geeks, geek, bad, bat, cat, cut; search("geek")`<br><strong>Output:</strong> `true`<br><strong>Input:</strong> `search("gee")`<br><strong>Output:</strong> `false (a prefix, not a word)`<br><strong>Input:</strong> `startsWith("ge")`<br><strong>Output:</strong> `true`

> [!NOTE] Idea
>
> All three walk the same path. <strong>Insert</strong> creates the missing child at every step and marks the final node. <strong>Search</strong> stops with `false` as soon as a child is missing and, at the end, returns the `isEndOfWord` flag. <strong>Prefix search</strong> is search without the final flag check.

1. <strong>Start at the root</strong>

   with the first character of the key.

2. <strong>Follow child\[ch − 'a'\]</strong>

   insert: create the node if it is missing — search: return `false` if it is missing.

3. <strong>At the last character</strong>

   insert: set `isEndOfWord = true` — search: return `isEndOfWord` — startsWith: return `true`.

```python filename:Python
class TrieNode:
    def __init__(self):
        self.child = [None] * 26
        self.is_end_of_word = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, key):
        node = self.root
        for ch in key:
            i = ord(ch) - ord('a')
            if node.child[i] is None:            # extend the path where it stops
                node.child[i] = TrieNode()
            node = node.child[i]
        node.is_end_of_word = True               # mark the complete word

    def _walk(self, key):                        # node where `key` ends, or None
        node = self.root
        for ch in key:
            node = node.child[ord(ch) - ord('a')]
            if node is None:
                return None
        return node

    def search(self, key):
        node = self._walk(key)
        return node is not None and node.is_end_of_word

    def starts_with(self, prefix):
        return self._walk(prefix) is not None

    def words(self):                             # pre-order traversal → lexicographic order
        out = []
        def dfs(node, prefix):
            if node.is_end_of_word:
                out.append(prefix)
            for i, c in enumerate(node.child):
                if c is not None:
                    dfs(c, prefix + chr(ord('a') + i))
        dfs(self.root, "")
        return out

trie = Trie()
for w in ["geeks", "geek", "bad", "bat", "cat", "cut"]:
    trie.insert(w)
for w in ["geek", "gee", "cut", "dog"]:
    print(f"search {w}:", "true" if trie.search(w) else "false")
for pre in ["ge", "do"]:
    print(f"startsWith {pre}:", "true" if trie.starts_with(pre) else "false")
print("words:", " ".join(trie.words()))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

struct TrieNode {
    TrieNode* child[26] = {};
    bool isEndOfWord = false;
};

class Trie {
    TrieNode* root = new TrieNode();
    TrieNode* walk(const string& key) const {           // node where `key` ends, or nullptr
        TrieNode* node = root;
        for (char ch : key) {
            node = node->child[ch - 'a'];
            if (!node) return nullptr;
        }
        return node;
    }
    void dfs(TrieNode* node, string& prefix, vector<string>& out) const {
        if (node->isEndOfWord) out.push_back(prefix);
        for (int i = 0; i < 26; i++)
            if (node->child[i]) {
                prefix.push_back('a' + i);
                dfs(node->child[i], prefix, out);
                prefix.pop_back();
            }
    }
public:
    void insert(const string& key) {
        TrieNode* node = root;
        for (char ch : key) {
            int i = ch - 'a';
            if (!node->child[i]) node->child[i] = new TrieNode();   // extend the path where it stops
            node = node->child[i];
        }
        node->isEndOfWord = true;                                   // mark the complete word
    }
    bool search(const string& key) const { TrieNode* n = walk(key); return n && n->isEndOfWord; }
    bool startsWith(const string& prefix) const { return walk(prefix) != nullptr; }
    vector<string> words() const { vector<string> out; string p; dfs(root, p, out); return out; }   // sorted
};

int main() {
    Trie trie;
    for (string w : {"geeks", "geek", "bad", "bat", "cat", "cut"}) trie.insert(w);
    for (string w : {"geek", "gee", "cut", "dog"}) cout << "search " << w << ": " << (trie.search(w) ? "true" : "false") << "\n";
    for (string p : {"ge", "do"}) cout << "startsWith " << p << ": " << (trie.startsWith(p) ? "true" : "false") << "\n";
    cout << "words:";
    for (const string& w : trie.words()) cout << " " << w;
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static class TrieNode {
        TrieNode[] child = new TrieNode[26];
        boolean isEndOfWord;
    }

    static class Trie {
        TrieNode root = new TrieNode();

        void insert(String key) {
            TrieNode node = root;
            for (char ch : key.toCharArray()) {
                int i = ch - 'a';
                if (node.child[i] == null) node.child[i] = new TrieNode();   // extend the path where it stops
                node = node.child[i];
            }
            node.isEndOfWord = true;                                          // mark the complete word
        }
        TrieNode walk(String key) {                                           // node where key ends, or null
            TrieNode node = root;
            for (char ch : key.toCharArray()) {
                node = node.child[ch - 'a'];
                if (node == null) return null;
            }
            return node;
        }
        boolean search(String key) { TrieNode n = walk(key); return n != null && n.isEndOfWord; }
        boolean startsWith(String prefix) { return walk(prefix) != null; }
        List<String> words() { List<String> out = new ArrayList<>(); dfs(root, new StringBuilder(), out); return out; }
        void dfs(TrieNode node, StringBuilder prefix, List<String> out) {     // pre-order → sorted
            if (node.isEndOfWord) out.add(prefix.toString());
            for (int i = 0; i < 26; i++)
                if (node.child[i] != null) {
                    prefix.append((char) ('a' + i));
                    dfs(node.child[i], prefix, out);
                    prefix.setLength(prefix.length() - 1);
                }
        }
    }

    public static void main(String[] args) {
        Trie trie = new Trie();
        for (String w : new String[]{"geeks", "geek", "bad", "bat", "cat", "cut"}) trie.insert(w);
        for (String w : new String[]{"geek", "gee", "cut", "dog"}) System.out.println("search " + w + ": " + trie.search(w));
        for (String p : new String[]{"ge", "do"}) System.out.println("startsWith " + p + ": " + trie.startsWith(p));
        System.out.println("words: " + String.join(" ", trie.words()));
    }
}
```

```javascript filename:JavaScript
class TrieNode {
    constructor() { this.child = new Array(26).fill(null); this.isEndOfWord = false; }
}

class Trie {
    constructor() { this.root = new TrieNode(); }
    insert(key) {
        let node = this.root;
        for (const ch of key) {
            const i = ch.charCodeAt(0) - 97;
            if (node.child[i] === null) node.child[i] = new TrieNode();   // extend the path where it stops
            node = node.child[i];
        }
        node.isEndOfWord = true;                                           // mark the complete word
    }
    walk(key) {                                                            // node where key ends, or null
        let node = this.root;
        for (const ch of key) {
            node = node.child[ch.charCodeAt(0) - 97];
            if (node === null) return null;
        }
        return node;
    }
    search(key) { const n = this.walk(key); return n !== null && n.isEndOfWord; }
    startsWith(prefix) { return this.walk(prefix) !== null; }
    words() {                                                              // pre-order → sorted
        const out = [];
        const dfs = (node, prefix) => {
            if (node.isEndOfWord) out.push(prefix);
            node.child.forEach((c, i) => { if (c !== null) dfs(c, prefix + String.fromCharCode(97 + i)); });
        };
        dfs(this.root, "");
        return out;
    }
}

const trie = new Trie();
for (const w of ["geeks", "geek", "bad", "bat", "cat", "cut"]) trie.insert(w);
for (const w of ["geek", "gee", "cut", "dog"]) console.log(`search ${w}:`, trie.search(w));
for (const p of ["ge", "do"]) console.log(`startsWith ${p}:`, trie.startsWith(p));
console.log("words:", trie.words().join(" "));
```

```text filename:Output
search geek: true
search gee: false
search cut: true
search dog: false
startsWith ge: true
startsWith do: false
words: bad bat cat cut geek geeks
```

Time O(L) per insert / search / startsWith for a word of length L · Space O(total characters × alphabet) for the trie

> [!WARNING] Pitfall
>
> Returning `true` from `search` as soon as the walk succeeds finds `"gee"` even though only `"geek"` was inserted. The final `isEndOfWord` check is what separates <em>search</em> from <em>startsWith</em>.

# Delete

Deleting must remove the word without breaking any other word that shares its path. `geeks` and `geek` share `g-e-e-k`; deleting `geeks` may remove only the `s` node, and deleting `geek` must only clear a flag.

> [!TIP] Example
>
> <strong>Input:</strong> `insert geeks, geek, bad, bat, cat, cut; delete("geeks")`<br><strong>Output:</strong> `search("geeks") = false, search("geek") = true`<br><strong>Input:</strong> `delete("bad")`<br><strong>Output:</strong> `search("bad") = false, search("bat") = true`

> [!NOTE] Idea
>
> Write a recursive function that walks down to the last character. On the way <strong>back up</strong>: clear `isEndOfWord` at the last node; then delete a node only if it is <strong>not</strong> the end of another word <strong>and</strong> has no children. Deletion stops at the first node that is still needed.

1. <strong>Recurse to the node of the last character</strong>

   `depth == len(key)`: unmark `isEndOfWord`.

2. <strong>Is this node now useless?</strong>

   No children and not the end of any word → return `null` so the parent drops its pointer.

3. <strong>Walk back up</strong>

   Each parent re-checks: if it is not a word end and has no children left, it is removed as well. The first node that still serves another word stops the chain.

```text filename:The%20three%20cases%3A%20remove%20a%20leaf%2C%20stop%20at%20a%20shared%20node%2C%20remove%20a%20whole%20chain
delete("geeks")              delete("bad")                 delete("geek")
g-e-e-k*-s*                  b-a-d*                        g-e-e-k*
         └ unmark s,         a-t*                                  └ unmark k; k is a leaf → remove
           s has no          └ unmark d; d is a leaf        e has no children now → remove
           children →          → remove d; a still has     e → remove, g → remove
           remove s            child t → stop              root stays (it also has b, c)
k keeps its * — geek lives on
```

```python filename:Python
class TrieNode:
    def __init__(self):
        self.child = [None] * 26
        self.is_end_of_word = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, key):
        node = self.root
        for ch in key:
            i = ord(ch) - ord('a')
            if node.child[i] is None:
                node.child[i] = TrieNode()
            node = node.child[i]
        node.is_end_of_word = True

    def _walk(self, key):
        node = self.root
        for ch in key:
            node = node.child[ord(ch) - ord('a')]
            if node is None:
                return None
        return node

    def search(self, key):
        node = self._walk(key)
        return node is not None and node.is_end_of_word

    def starts_with(self, prefix):
        return self._walk(prefix) is not None

    def delete(self, key):
        def _delete(node, depth):                       # returns the node to keep, or None to drop it
            if node is None:
                return None
            if depth == len(key):
                node.is_end_of_word = False             # the word itself is gone …
            else:
                i = ord(key[depth]) - ord('a')
                node.child[i] = _delete(node.child[i], depth + 1)
            if node.is_end_of_word or any(c is not None for c in node.child):
                return node                             # … but this node still serves other words
            return None                                 # useless node: unlink it
        self.root = _delete(self.root, 0) or TrieNode()

    def words(self):
        out = []
        def dfs(node, prefix):
            if node.is_end_of_word:
                out.append(prefix)
            for i, c in enumerate(node.child):
                if c is not None:
                    dfs(c, prefix + chr(ord('a') + i))
        dfs(self.root, "")
        return out

t = Trie()
for w in ["geeks", "geek", "bad", "bat", "cat", "cut"]:
    t.insert(w)
b = lambda v: "true" if v else "false"
t.delete("geeks"); print(f"after delete(geeks): geeks={b(t.search('geeks'))} geek={b(t.search('geek'))}")
t.delete("bad");   print(f"after delete(bad): bad={b(t.search('bad'))} bat={b(t.search('bat'))}")
t.delete("geek");  print(f"after delete(geek): geek={b(t.search('geek'))} startsWith(ge)={b(t.starts_with('ge'))}")
print("words:", " ".join(t.words()))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <string>
#include <vector>
using namespace std;

struct TrieNode {
    TrieNode* child[26] = {};
    bool isEndOfWord = false;
    bool hasChild() const { for (TrieNode* c : child) if (c) return true; return false; }
};

class Trie {
    TrieNode* root = new TrieNode();
    TrieNode* walk(const string& key) const {
        TrieNode* node = root;
        for (char ch : key) { node = node->child[ch - 'a']; if (!node) return nullptr; }
        return node;
    }
    static TrieNode* remove(TrieNode* node, const string& key, size_t depth) {   // node to keep, or nullptr
        if (!node) return nullptr;
        if (depth == key.size()) {
            node->isEndOfWord = false;                              // the word itself is gone …
        } else {
            int i = key[depth] - 'a';
            node->child[i] = remove(node->child[i], key, depth + 1);
        }
        if (node->isEndOfWord || node->hasChild()) return node;     // … but this node still serves other words
        delete node;                                                // useless node: unlink it
        return nullptr;
    }
    void dfs(TrieNode* node, string& prefix, vector<string>& out) const {
        if (node->isEndOfWord) out.push_back(prefix);
        for (int i = 0; i < 26; i++)
            if (node->child[i]) { prefix.push_back('a' + i); dfs(node->child[i], prefix, out); prefix.pop_back(); }
    }
public:
    void insert(const string& key) {
        TrieNode* node = root;
        for (char ch : key) {
            int i = ch - 'a';
            if (!node->child[i]) node->child[i] = new TrieNode();
            node = node->child[i];
        }
        node->isEndOfWord = true;
    }
    bool search(const string& key) const { TrieNode* n = walk(key); return n && n->isEndOfWord; }
    bool startsWith(const string& p) const { return walk(p) != nullptr; }
    void erase(const string& key) { root = remove(root, key, 0); if (!root) root = new TrieNode(); }
    vector<string> words() const { vector<string> out; string p; dfs(root, p, out); return out; }
};

const char* b(bool v) { return v ? "true" : "false"; }

int main() {
    Trie t;
    for (string w : {"geeks", "geek", "bad", "bat", "cat", "cut"}) t.insert(w);
    t.erase("geeks"); cout << "after delete(geeks): geeks=" << b(t.search("geeks")) << " geek=" << b(t.search("geek")) << "\n";
    t.erase("bad");   cout << "after delete(bad): bad=" << b(t.search("bad")) << " bat=" << b(t.search("bat")) << "\n";
    t.erase("geek");  cout << "after delete(geek): geek=" << b(t.search("geek")) << " startsWith(ge)=" << b(t.startsWith("ge")) << "\n";
    cout << "words:";
    for (const string& w : t.words()) cout << " " << w;
    cout << "\n";
}
```

```java filename:Java
import java.util.ArrayList;
import java.util.List;

public class Main {
    static class TrieNode {
        TrieNode[] child = new TrieNode[26];
        boolean isEndOfWord;
        boolean hasChild() { for (TrieNode c : child) if (c != null) return true; return false; }
    }

    static class Trie {
        TrieNode root = new TrieNode();

        void insert(String key) {
            TrieNode node = root;
            for (char ch : key.toCharArray()) {
                int i = ch - 'a';
                if (node.child[i] == null) node.child[i] = new TrieNode();
                node = node.child[i];
            }
            node.isEndOfWord = true;
        }
        TrieNode walk(String key) {
            TrieNode node = root;
            for (char ch : key.toCharArray()) { node = node.child[ch - 'a']; if (node == null) return null; }
            return node;
        }
        boolean search(String key) { TrieNode n = walk(key); return n != null && n.isEndOfWord; }
        boolean startsWith(String p) { return walk(p) != null; }

        void delete(String key) { root = delete(root, key, 0); if (root == null) root = new TrieNode(); }
        TrieNode delete(TrieNode node, String key, int depth) {           // node to keep, or null to drop it
            if (node == null) return null;
            if (depth == key.length()) {
                node.isEndOfWord = false;                                 // the word itself is gone …
            } else {
                int i = key.charAt(depth) - 'a';
                node.child[i] = delete(node.child[i], key, depth + 1);
            }
            if (node.isEndOfWord || node.hasChild()) return node;         // … but this node still serves other words
            return null;                                                  // useless node: unlink it
        }
        List<String> words() { List<String> out = new ArrayList<>(); dfs(root, new StringBuilder(), out); return out; }
        void dfs(TrieNode node, StringBuilder prefix, List<String> out) {
            if (node.isEndOfWord) out.add(prefix.toString());
            for (int i = 0; i < 26; i++)
                if (node.child[i] != null) {
                    prefix.append((char) ('a' + i)); dfs(node.child[i], prefix, out); prefix.setLength(prefix.length() - 1);
                }
        }
    }

    public static void main(String[] args) {
        Trie t = new Trie();
        for (String w : new String[]{"geeks", "geek", "bad", "bat", "cat", "cut"}) t.insert(w);
        t.delete("geeks"); System.out.println("after delete(geeks): geeks=" + t.search("geeks") + " geek=" + t.search("geek"));
        t.delete("bad");   System.out.println("after delete(bad): bad=" + t.search("bad") + " bat=" + t.search("bat"));
        t.delete("geek");  System.out.println("after delete(geek): geek=" + t.search("geek") + " startsWith(ge)=" + t.startsWith("ge"));
        System.out.println("words: " + String.join(" ", t.words()));
    }
}
```

```javascript filename:JavaScript
class TrieNode {
    constructor() { this.child = new Array(26).fill(null); this.isEndOfWord = false; }
    hasChild() { return this.child.some(c => c !== null); }
}

class Trie {
    constructor() { this.root = new TrieNode(); }
    insert(key) {
        let node = this.root;
        for (const ch of key) {
            const i = ch.charCodeAt(0) - 97;
            if (node.child[i] === null) node.child[i] = new TrieNode();
            node = node.child[i];
        }
        node.isEndOfWord = true;
    }
    walk(key) {
        let node = this.root;
        for (const ch of key) { node = node.child[ch.charCodeAt(0) - 97]; if (node === null) return null; }
        return node;
    }
    search(key) { const n = this.walk(key); return n !== null && n.isEndOfWord; }
    startsWith(p) { return this.walk(p) !== null; }

    delete(key) {
        const rec = (node, depth) => {                              // node to keep, or null to drop it
            if (node === null) return null;
            if (depth === key.length) {
                node.isEndOfWord = false;                           // the word itself is gone …
            } else {
                const i = key.charCodeAt(depth) - 97;
                node.child[i] = rec(node.child[i], depth + 1);
            }
            if (node.isEndOfWord || node.hasChild()) return node;   // … but this node still serves other words
            return null;                                            // useless node: unlink it
        };
        this.root = rec(this.root, 0) ?? new TrieNode();
    }
    words() {
        const out = [];
        const dfs = (node, prefix) => {
            if (node.isEndOfWord) out.push(prefix);
            node.child.forEach((c, i) => { if (c !== null) dfs(c, prefix + String.fromCharCode(97 + i)); });
        };
        dfs(this.root, "");
        return out;
    }
}

const t = new Trie();
for (const w of ["geeks", "geek", "bad", "bat", "cat", "cut"]) t.insert(w);
t.delete("geeks"); console.log(`after delete(geeks): geeks=${t.search("geeks")} geek=${t.search("geek")}`);
t.delete("bad");   console.log(`after delete(bad): bad=${t.search("bad")} bat=${t.search("bat")}`);
t.delete("geek");  console.log(`after delete(geek): geek=${t.search("geek")} startsWith(ge)=${t.startsWith("ge")}`);
console.log("words:", t.words().join(" "));
```

```text filename:Output
after delete(geeks): geeks=false geek=true
after delete(bad): bad=false bat=true
after delete(geek): geek=false startsWith(ge)=false
words: bat cat cut
```

Time O(L) — one pass down and one pass back up · Space O(L) recursion depth

> [!WARNING] Pitfall
>
> Only clearing `isEndOfWord` ("lazy delete") keeps `search` correct but leaves dead branches in memory and makes `startsWith("ge")` wrongly return `true` after every `ge…` word is gone. Deleting a node that is still a word end or still has children breaks other words — check both conditions before unlinking.

# Count distinct rows in a binary matrix

Given a binary matrix (every entry `0` or `1`), count how many <strong>distinct</strong> rows it has.

> [!TIP] Example
>
> <strong>Input:</strong> `matrix = [[1,0,0], [1,1,1], [1,0,0], [1,1,1]]`<br><strong>Output:</strong> `2`

<strong>Naive:</strong> for every row, compare it with every earlier row; count it if it matches none. `R` rows, each compared with up to `R` others, `C` entries per comparison.

```python filename:Python
def count_distinct_rows(matrix):
    res = 0
    for i, row in enumerate(matrix):
        if all(row != matrix[j] for j in range(i)):     # matches no earlier row → new
            res += 1
    return res

print(count_distinct_rows([[1, 0, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1]]))
```

```text filename:Output
2
```

Time O(R² · C) · Space O(1)

> [!NOTE] Idea
>
> Treat every row as a <em>word</em> over the alphabet `{0, 1}` and insert it into a <strong>binary trie</strong> (two children per node). Insertion of a row that is already present ends at a node that is already marked — so `insert` can report whether the row was new. Every row is inserted once: `O(R · C)` in total.

```text filename:A%20binary%20trie%20of%20the%20rows%3A%20equal%20rows%20walk%20the%20same%20path%20and%20hit%20the%20same%20leaf
rows: 1 0 0 / 1 1 1 / 1 0 0 / 1 1 1

         (root)
           │ 1
           ●
      0 ┌──┴──┐ 1
        ●     ●
      0 │     │ 1
        ●*    ●*          two marked leaves → 2 distinct rows
```

```python filename:Python
class Node:
    def __init__(self):
        self.child = [None, None]          # child[0] for a 0, child[1] for a 1
        self.is_end = False

def insert_row(root, row):                 # True if the row was not present before
    node = root
    for bit in row:
        if node.child[bit] is None:
            node.child[bit] = Node()
        node = node.child[bit]
    if node.is_end:
        return False                       # an identical row ended here already
    node.is_end = True
    return True

def count_distinct_rows(matrix):
    root = Node()
    return sum(1 for row in matrix if insert_row(root, row))

matrix = [[1, 0, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1]]
print("distinct rows:", count_distinct_rows(matrix))
```

```cpp filename:C%2B%2B
#include <iostream>
#include <vector>
using namespace std;

struct Node {
    Node* child[2] = {nullptr, nullptr};   // child[0] for a 0, child[1] for a 1
    bool isEnd = false;
};

bool insertRow(Node* root, const vector<int>& row) {   // true if the row was not present before
    Node* node = root;
    for (int bit : row) {
        if (!node->child[bit]) node->child[bit] = new Node();
        node = node->child[bit];
    }
    if (node->isEnd) return false;                     // an identical row ended here already
    node->isEnd = true;
    return true;
}

int countDistinctRows(const vector<vector<int>>& matrix) {
    Node* root = new Node();
    int res = 0;
    for (const auto& row : matrix)
        if (insertRow(root, row)) res++;
    return res;
}

int main() {
    vector<vector<int>> matrix = {{1, 0, 0}, {1, 1, 1}, {1, 0, 0}, {1, 1, 1}};
    cout << "distinct rows: " << countDistinctRows(matrix) << "\n";
}
```

```java filename:Java
public class Main {
    static class Node {
        Node[] child = new Node[2];        // child[0] for a 0, child[1] for a 1
        boolean isEnd;
    }

    static boolean insertRow(Node root, int[] row) {   // true if the row was not present before
        Node node = root;
        for (int bit : row) {
            if (node.child[bit] == null) node.child[bit] = new Node();
            node = node.child[bit];
        }
        if (node.isEnd) return false;                  // an identical row ended here already
        node.isEnd = true;
        return true;
    }

    static int countDistinctRows(int[][] matrix) {
        Node root = new Node();
        int res = 0;
        for (int[] row : matrix)
            if (insertRow(root, row)) res++;
        return res;
    }

    public static void main(String[] args) {
        int[][] matrix = {{1, 0, 0}, {1, 1, 1}, {1, 0, 0}, {1, 1, 1}};
        System.out.println("distinct rows: " + countDistinctRows(matrix));
    }
}
```

```javascript filename:JavaScript
class Node {
    constructor() { this.child = [null, null]; this.isEnd = false; }   // child[0] for a 0, child[1] for a 1
}

function insertRow(root, row) {               // true if the row was not present before
    let node = root;
    for (const bit of row) {
        if (node.child[bit] === null) node.child[bit] = new Node();
        node = node.child[bit];
    }
    if (node.isEnd) return false;             // an identical row ended here already
    node.isEnd = true;
    return true;
}

function countDistinctRows(matrix) {
    const root = new Node();
    let res = 0;
    for (const row of matrix) if (insertRow(root, row)) res++;
    return res;
}

const matrix = [[1, 0, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1]];
console.log("distinct rows:", countDistinctRows(matrix));
```

```text filename:Output
distinct rows: 2
```

Time O(R · C) · Space O(R · C) for the trie in the worst case

> [!NOTE] Alternative
>
> A hash set of rows (as tuples / strings) also solves this in `O(R · C)` expected time and is shorter to write. The trie answers two things the set cannot: it can list the distinct rows in <strong>sorted order</strong>, and its memory is shared across rows with equal prefixes.

# Interview Q&amp;A

```question
When would you choose a trie over a hash map?

---

When the workload needs <strong>prefix</strong> operations — autocomplete, "does any key start with…", longest-prefix match (IP routing) — or <strong>sorted</strong> enumeration of the keys. For pure exact-match lookups a hash map is faster and uses far less memory.
```

```question
What is the space complexity of a trie, and how can it be reduced?

---

Worst case `O(N · L · A)` for `N` words of length `L` over an alphabet of size `A`, because every node reserves `A` child slots. Reduce it with a hash map or sorted list of children per node (only the children that exist), with a <strong>compressed trie / radix tree</strong> that merges chains of single-child nodes, or with a <strong>ternary search tree</strong>.
```

```question
How do you implement autocomplete with a trie?

---

Walk down the prefix (`O(P)`); if the walk fails there are no completions. Otherwise do a DFS from that node, appending characters, and emit every node with `isEndOfWord`. The DFS visits the children in alphabetical order, so the suggestions come out sorted. Store a <em>count</em> or <em>top-k</em> list in each node to rank suggestions without a full traversal.
```

```question
Why does a trie give lexicographic order for free?

---

A pre-order traversal that visits the children in index order (`a` before `b` before `c`…) reaches every word end in dictionary order, because a shorter word is a prefix of the longer ones below it and siblings are visited alphabetically. This is also why `words()` above prints `bad bat cat cut geek geeks`.
```

```question
What goes wrong if delete just clears the end-of-word flag?

---

Searches stay correct, but memory for dead branches is never reclaimed, and `startsWith` returns `true` for prefixes that no longer lead to any word. Proper deletion removes nodes bottom-up while they are unmarked and childless, stopping at the first node another word still uses.
```
