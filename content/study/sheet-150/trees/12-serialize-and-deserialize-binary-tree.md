---
id: 6bb86d3d-37de-76a4-9a1f-f6306b1fbbac
key: problem:sheet-150/lc-297
subject: sheet-150
topic: trees
title: Serialize and Deserialize Binary Tree
slug: serialize-and-deserialize-binary-tree
order: 12
---

Difficulty: <strong>Hard</strong> · [LeetCode 297](https://leetcode.com/problems/serialize-and-deserialize-binary-tree/)

# Problem

Design an algorithm to serialize a binary tree to a string and deserialize string back to tree.

# Understanding the problem

Preorder traversal with null marker (`#`) unambiguously encodes tree structure into flat comma-separated string.

# Standard Solution

Preorder traversal with `#` null markers using string index pointer.

```python filename:Python
class Codec:

    def serialize(self, root):
        result = []

        def dfs(node):
            if not node:
                result.append("#")
                return

            result.append(str(node.val))
            dfs(node.left)
            dfs(node.right)

        dfs(root)
        return ",".join(result)

    def deserialize(self, data):
        values = data.split(",")
        index = 0

        def dfs():
            nonlocal index

            if values[index] == "#":
                index += 1
                return None

            node = TreeNode(int(values[index]))
            index += 1

            node.left = dfs()
            node.right = dfs()

            return node

        return dfs()
```

```cpp filename:C%2B%2B
class Codec {
public:
    // Encodes a tree to a single string.
    string serialize(TreeNode* root) {
        string result;
        dfsSerialize(root, result);
        result.pop_back();  // drop trailing comma
        return result;
    }

    // Decodes your encoded data to tree.
    TreeNode* deserialize(string data) {
        vector<string> values;
        stringstream ss(data);
        string token;
        while (getline(ss, token, ',')) values.push_back(token);

        int index = 0;
        return dfsDeserialize(values, index);
    }

private:
    void dfsSerialize(TreeNode* node, string& result) {
        if (!node) {
            result += "#,";
            return;
        }

        result += to_string(node->val) + ",";
        dfsSerialize(node->left, result);
        dfsSerialize(node->right, result);
    }

    TreeNode* dfsDeserialize(vector<string>& values, int& index) {
        if (values[index] == "#") {
            index++;
            return nullptr;
        }

        TreeNode* node = new TreeNode(stoi(values[index]));
        index++;

        node->left = dfsDeserialize(values, index);
        node->right = dfsDeserialize(values, index);

        return node;
    }
};
```

```java filename:Java
public class Codec {
    private String[] values;
    private int index;

    // Encodes a tree to a single string.
    public String serialize(TreeNode root) {
        List<String> result = new ArrayList<>();
        dfsSerialize(root, result);
        return String.join(",", result);
    }

    // Decodes your encoded data to tree.
    public TreeNode deserialize(String data) {
        values = data.split(",");
        index = 0;
        return dfsDeserialize();
    }

    private void dfsSerialize(TreeNode node, List<String> result) {
        if (node == null) {
            result.add("#");
            return;
        }

        result.add(String.valueOf(node.val));
        dfsSerialize(node.left, result);
        dfsSerialize(node.right, result);
    }

    private TreeNode dfsDeserialize() {
        if (values[index].equals("#")) {
            index++;
            return null;
        }

        TreeNode node = new TreeNode(Integer.parseInt(values[index]));
        index++;

        node.left = dfsDeserialize();
        node.right = dfsDeserialize();

        return node;
    }
}
```

```javascript filename:JavaScript
var serialize = function(root) {
    const result = [];

    const dfs = (node) => {
        if (!node) {
            result.push("#");
            return;
        }

        result.push(String(node.val));
        dfs(node.left);
        dfs(node.right);
    };

    dfs(root);
    return result.join(",");
};

var deserialize = function(data) {
    const values = data.split(",");
    let index = 0;

    const dfs = () => {
        if (values[index] === "#") {
            index++;
            return null;
        }

        const node = new TreeNode(Number(values[index]));
        index++;

        node.left = dfs();
        node.right = dfs();

        return node;
    };

    return dfs();
};
```

<strong>Time: O(n) · Aux Space: O(n)</strong>
