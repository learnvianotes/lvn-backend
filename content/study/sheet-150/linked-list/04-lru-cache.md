---
id: 23611c06-334c-7353-b3f0-3abc4fa3cb11
key: problem:sheet-150/lc-146
subject: sheet-150
topic: linked-list
title: LRU Cache
slug: lru-cache
order: 4
---

Difficulty: <strong>Medium</strong> · [LeetCode 146](https://leetcode.com/problems/lru-cache/)

# Problem

Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) get and put.

# Understanding the problem

Lookup in O(1) + Order update in O(1) + Eviction in O(1).

# Intuition

HashMap for O(1) key-to-node lookup + Doubly Linked List with dummy head/tail for O(1) node removal and insertion.

# Approach

1. Use doubly linked list nodes `(key, value, prev, next)`.
2. Dummy `left` (LRU) and `right` (Most Recent).
3. `get(key)`: remove node from list, insert at right, return value.
4. `put(key, val)`: remove existing if present, insert new node at right. If capacity exceeded, remove `left.next` node from list &amp; cache.

# Naive Solution — Brute Force

Use a hash map for key-value store and a list for access order (O(n) list removal).

```python filename:Python
class LRUCache:

    def __init__(self, capacity):
        self.capacity = capacity
        self.cache = {}
        self.order = []

    def get(self, key):
        if key not in self.cache:
            return -1

        self.order.remove(key)
        self.order.append(key)

        return self.cache[key]

    def put(self, key, value):
        if key in self.cache:
            self.order.remove(key)

        self.cache[key] = value
        self.order.append(key)

        if len(self.cache) > self.capacity:
            oldest = self.order.pop(0)
            del self.cache[oldest]
```

```cpp filename:C%2B%2B
class LRUCache {
    int capacity;
    unordered_map<int, int> cache;
    deque<int> order;

public:
    LRUCache(int capacity) : capacity(capacity) {}

    int get(int key) {
        if (!cache.count(key)) {
            return -1;
        }

        order.erase(find(order.begin(), order.end(), key));
        order.push_back(key);

        return cache[key];
    }

    void put(int key, int value) {
        if (cache.count(key)) {
            order.erase(find(order.begin(), order.end(), key));
        }

        cache[key] = value;
        order.push_back(key);

        if (cache.size() > capacity) {
            int oldest = order.front();
            order.pop_front();
            cache.erase(oldest);
        }
    }
};
```

```java filename:Java
class LRUCache {
    private int capacity;
    private Map<Integer, Integer> cache;
    private LinkedList<Integer> order;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new HashMap<>();
        this.order = new LinkedList<>();
    }

    public int get(int key) {
        if (!cache.containsKey(key)) {
            return -1;
        }

        order.remove((Integer) key);
        order.addLast(key);

        return cache.get(key);
    }

    public void put(int key, int value) {
        if (cache.containsKey(key)) {
            order.remove((Integer) key);
        }

        cache.put(key, value);
        order.addLast(key);

        if (cache.size() > capacity) {
            int oldest = order.removeFirst();
            cache.remove(oldest);
        }
    }
}
```

```javascript filename:JavaScript
class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();
        this.order = [];
    }

    get(key) {
        if (!this.cache.has(key)) {
            return -1;
        }

        this.order.splice(this.order.indexOf(key), 1);
        this.order.push(key);

        return this.cache.get(key);
    }

    put(key, value) {
        if (this.cache.has(key)) {
            this.order.splice(this.order.indexOf(key), 1);
        }

        this.cache.set(key, value);
        this.order.push(key);

        if (this.cache.size > this.capacity) {
            const oldest = this.order.shift();
            this.cache.delete(oldest);
        }
    }
}
```

<strong>Get: O(n), Put: O(n) · Space: O(capacity)</strong>

# Optimized Code (Python 3)

```python filename:Python
class Node:
    def __init__(self, key=0, value=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None


class LRUCache:

    def __init__(self, capacity):
        self.capacity = capacity
        self.cache = {}

        self.left = Node()
        self.right = Node()

        self.left.next = self.right
        self.right.prev = self.left

    def remove(self, node):
        previous = node.prev
        next_node = node.next

        previous.next = next_node
        next_node.prev = previous

    def insert(self, node):
        previous = self.right.prev

        previous.next = node
        node.prev = previous

        node.next = self.right
        self.right.prev = node

    def get(self, key):
        if key not in self.cache:
            return -1

        node = self.cache[key]

        self.remove(node)
        self.insert(node)

        return node.value

    def put(self, key, value):
        if key in self.cache:
            self.remove(self.cache[key])

        node = Node(key, value)

        self.cache[key] = node
        self.insert(node)

        if len(self.cache) > self.capacity:
            lru = self.left.next

            self.remove(lru)
            del self.cache[lru.key]
```

```cpp filename:C%2B%2B
class LRUCache {
    struct Node {
        int key, value;
        Node* prev = nullptr;
        Node* next = nullptr;
        Node(int key = 0, int value = 0) : key(key), value(value) {}
    };

    int capacity;
    unordered_map<int, Node*> cache;
    Node* left;
    Node* right;

    void remove(Node* node) {
        Node* previous = node->prev;
        Node* nextNode = node->next;

        previous->next = nextNode;
        nextNode->prev = previous;
    }

    void insert(Node* node) {
        Node* previous = right->prev;

        previous->next = node;
        node->prev = previous;

        node->next = right;
        right->prev = node;
    }

public:
    LRUCache(int capacity) : capacity(capacity) {
        left = new Node();
        right = new Node();

        left->next = right;
        right->prev = left;
    }

    int get(int key) {
        if (!cache.count(key)) {
            return -1;
        }

        Node* node = cache[key];

        remove(node);
        insert(node);

        return node->value;
    }

    void put(int key, int value) {
        if (cache.count(key)) {
            remove(cache[key]);
            delete cache[key];
        }

        Node* node = new Node(key, value);

        cache[key] = node;
        insert(node);

        if (cache.size() > capacity) {
            Node* lru = left->next;

            remove(lru);
            cache.erase(lru->key);
            delete lru;
        }
    }
};
```

```java filename:Java
class LRUCache {
    private static class Node {
        int key, value;
        Node prev, next;

        Node(int key, int value) {
            this.key = key;
            this.value = value;
        }
    }

    private int capacity;
    private Map<Integer, Node> cache;
    private Node left;
    private Node right;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new HashMap<>();

        this.left = new Node(0, 0);
        this.right = new Node(0, 0);

        left.next = right;
        right.prev = left;
    }

    private void remove(Node node) {
        Node previous = node.prev;
        Node nextNode = node.next;

        previous.next = nextNode;
        nextNode.prev = previous;
    }

    private void insert(Node node) {
        Node previous = right.prev;

        previous.next = node;
        node.prev = previous;

        node.next = right;
        right.prev = node;
    }

    public int get(int key) {
        if (!cache.containsKey(key)) {
            return -1;
        }

        Node node = cache.get(key);

        remove(node);
        insert(node);

        return node.value;
    }

    public void put(int key, int value) {
        if (cache.containsKey(key)) {
            remove(cache.get(key));
        }

        Node node = new Node(key, value);

        cache.put(key, node);
        insert(node);

        if (cache.size() > capacity) {
            Node lru = left.next;

            remove(lru);
            cache.remove(lru.key);
        }
    }
}
```

```javascript filename:JavaScript
class DLLNode {
    constructor(key = 0, value = 0) {
        this.key = key;
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}

class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();

        this.left = new DLLNode();
        this.right = new DLLNode();

        this.left.next = this.right;
        this.right.prev = this.left;
    }

    remove(node) {
        const previous = node.prev;
        const nextNode = node.next;

        previous.next = nextNode;
        nextNode.prev = previous;
    }

    insert(node) {
        const previous = this.right.prev;

        previous.next = node;
        node.prev = previous;

        node.next = this.right;
        this.right.prev = node;
    }

    get(key) {
        if (!this.cache.has(key)) {
            return -1;
        }

        const node = this.cache.get(key);

        this.remove(node);
        this.insert(node);

        return node.value;
    }

    put(key, value) {
        if (this.cache.has(key)) {
            this.remove(this.cache.get(key));
        }

        const node = new DLLNode(key, value);

        this.cache.set(key, node);
        this.insert(node);

        if (this.cache.size > this.capacity) {
            const lru = this.left.next;

            this.remove(lru);
            this.cache.delete(lru.key);
        }
    }
}
```

<strong>Get: O(1), Put: O(1) · Space: O(capacity)</strong>

# Takeaway

<strong>Pattern</strong> — HashMap + Doubly Linked List for O(1) lookup &amp; order manipulation
