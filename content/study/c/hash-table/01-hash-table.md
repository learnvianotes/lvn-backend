---
id: f401f335-ba4e-71cf-8e44-fc342be0f649
key: topic:c/hash-table
subject: c
topic: hash-table
title: Hash Table
slug: hash-table
order: 1
---

An array of buckets indexed by `hash(key) % capacity`. With a good hash function and a reasonable load factor, lookup, insert and delete are O(1) on average.

```c filename:C
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define NBUCKETS 8

typedef struct Entry {
    char *key;
    int value;
    struct Entry *next;               /* separate chaining */
} Entry;

typedef struct { Entry *buckets[NBUCKETS]; size_t count; } Map;

unsigned long hash(const char *s) {   /* djb2 by Dan Bernstein */
    unsigned long h = 5381;
    for (; *s; s++) h = h * 33 + (unsigned char)*s;
    return h;
}

void map_put(Map *m, const char *key, int value) {
    size_t i = hash(key) % NBUCKETS;
    for (Entry *e = m->buckets[i]; e; e = e->next)
        if (strcmp(e->key, key) == 0) { e->value = value; return; }   /* update */
    Entry *e = malloc(sizeof *e);
    if (!e) exit(1);
    size_t n = strlen(key) + 1;
    e->key = malloc(n);
    if (!e->key) exit(1);
    memcpy(e->key, key, n);
    e->value = value;
    e->next = m->buckets[i];          /* insert at bucket head */
    m->buckets[i] = e;
    m->count++;
}

int *map_get(Map *m, const char *key) {
    for (Entry *e = m->buckets[hash(key) % NBUCKETS]; e; e = e->next)
        if (strcmp(e->key, key) == 0) return &e->value;
    return NULL;
}

void map_free(Map *m) {
    for (int i = 0; i < NBUCKETS; i++)
        for (Entry *e = m->buckets[i], *next; e; e = next) {
            next = e->next;
            free(e->key);
            free(e);
        }
}

int main(void) {
    Map m = {0};
    const char *words[] = {"the", "cat", "sat", "on", "the", "mat", "the", "cat"};
    for (int i = 0; i < 8; i++) {
        int *c = map_get(&m, words[i]);
        if (c) (*c)++; else map_put(&m, words[i], 1);
    }
    const char *probe[] = {"the", "cat", "mat", "dog"};
    for (int i = 0; i < 4; i++) {
        int *c = map_get(&m, probe[i]);
        printf("%s: %d\n", probe[i], c ? *c : 0);
    }
    printf("distinct words: %zu\n", m.count);
    map_free(&m);
    return 0;
}
```

```text filename:Output
the: 3
cat: 2
mat: 1
dog: 0
distinct words: 5
```

| Collision strategy | How | Notes |
| --- | --- | --- |
| Separate chaining | Each bucket is a linked list | Simple; degrades gracefully; extra pointers |
| Linear probing | Try `i + 1`, `i + 2`, … in the array | Cache-friendly; needs tombstones for delete; clustering |
| Quadratic / double hashing | Probe with a step that grows or comes from a 2nd hash | Less clustering |

> [!NOTE] Key point
>
> Keep the <em>load factor</em> (`count / capacity`) below \~0.75 by resizing (allocate a bigger bucket array, rehash every entry). Resizing by doubling keeps insertion amortised O(1).

```question
What makes a good hash function?

---

It is fast, deterministic, and spreads typical keys uniformly across buckets so that small changes in the key change many output bits. For strings, FNV-1a, djb2 or xxHash/SipHash (the latter resists hash-flooding attacks) are common choices.
```
