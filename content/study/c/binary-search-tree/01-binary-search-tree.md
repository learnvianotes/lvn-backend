---
id: 79003f5f-b10f-700f-ba25-0b37b9a1f2e9
key: topic:c/binary-search-tree
subject: c
topic: binary-search-tree
title: Binary Search Tree
slug: binary-search-tree
order: 1
---

A binary tree where every left descendant is smaller and every right descendant is larger than the node. Search, insert and delete are O(h) — O(log n) when balanced, O(n) when degenerate.

```c filename:C
#include <stdio.h>
#include <stdlib.h>

typedef struct Tree { int key; struct Tree *left, *right; } Tree;

Tree *insert(Tree *t, int key) {
    if (!t) {
        t = malloc(sizeof *t);
        if (!t) exit(1);
        t->key = key; t->left = t->right = NULL;
    } else if (key < t->key) t->left = insert(t->left, key);
    else if (key > t->key)   t->right = insert(t->right, key);
    return t;                                  /* duplicates ignored */
}

const Tree *search(const Tree *t, int key) {
    while (t && t->key != key) t = key < t->key ? t->left : t->right;
    return t;
}

Tree *delete(Tree *t, int key) {
    if (!t) return NULL;
    if (key < t->key) t->left = delete(t->left, key);
    else if (key > t->key) t->right = delete(t->right, key);
    else if (!t->left || !t->right) {          /* 0 or 1 child */
        Tree *child = t->left ? t->left : t->right;
        free(t);
        return child;
    } else {                                   /* 2 children: copy in-order successor */
        Tree *s = t->right;
        while (s->left) s = s->left;
        t->key = s->key;
        t->right = delete(t->right, s->key);
    }
    return t;
}

void inorder(const Tree *t)  { if (t) { inorder(t->left); printf("%d ", t->key); inorder(t->right); } }
void preorder(const Tree *t) { if (t) { printf("%d ", t->key); preorder(t->left); preorder(t->right); } }
int height(const Tree *t) {
    if (!t) return 0;
    int l = height(t->left), r = height(t->right);
    return 1 + (l > r ? l : r);
}
void destroy(Tree *t) { if (t) { destroy(t->left); destroy(t->right); free(t); } }  /* postorder */

int main(void) {
    Tree *root = NULL;
    int keys[] = {50, 30, 70, 20, 40, 60, 80};
    for (int i = 0; i < 7; i++) root = insert(root, keys[i]);

    printf("inorder:  "); inorder(root);  printf("\n");
    printf("preorder: "); preorder(root); printf("\n");
    printf("height %d, has 60? %s, has 65? %s\n", height(root),
           search(root, 60) ? "yes" : "no", search(root, 65) ? "yes" : "no");

    root = delete(root, 50);                   /* root with two children */
    printf("after deleting 50: "); inorder(root); printf("(root %d)\n", root->key);
    destroy(root);
    return 0;
}
```

```text filename:Output
inorder:  20 30 40 50 60 70 80
preorder: 50 30 20 40 70 60 80
height 3, has 60? yes, has 65? no
after deleting 50: 20 30 40 60 70 80 (root 60)
```

| Traversal | Order | Use |
| --- | --- | --- |
| In-order | left, node, right | Sorted output of a BST |
| Pre-order | node, left, right | Copy / serialise a tree |
| Post-order | left, right, node | Free a tree (children before parent) |
| Level-order | breadth-first with a queue | Print by levels, shortest path in unweighted trees |

> [!WARNING] Watch out
>
> Inserting already-sorted keys produces a linked list (height n) and O(n) operations. Self-balancing trees (AVL, red-black) keep the height O(log n).

```question
How do you check whether a binary tree is a valid BST?

---

Recurse with an allowed range: every node’s key must lie strictly between a lower and upper bound inherited from its ancestors (`check(node->left, lo, node->key)`, `check(node->right, node->key, hi)`). Comparing a node only with its direct children is not enough.
```
