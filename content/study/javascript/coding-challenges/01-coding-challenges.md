---
id: ca57c787-98dc-7dc3-bae2-aa5a8a240f08
key: topic:javascript/coding-challenges
subject: javascript
topic: coding-challenges
title: Coding Challenges
slug: coding-challenges
order: 1
---

Short problems that show up again and again in JavaScript interviews — each with a clean, idiomatic solution and its complexity.

# Strings

```javascript filename:JavaScript
const isAnagram = (a, b) => {
  if (a.length !== b.length) return false;
  const counts = new Map();
  for (const ch of a) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (const ch of b) {
    if (!counts.get(ch)) return false;
    counts.set(ch, counts.get(ch) - 1);
  }
  return true;
};
const firstUnique = (s) => {
  const freq = {};
  for (const ch of s) freq[ch] = (freq[ch] ?? 0) + 1;
  return [...s].find((ch) => freq[ch] === 1) ?? null;
};
const longestUniqueSubstring = (s) => {        // sliding window, O(n)
  let best = 0, start = 0;
  const lastSeen = new Map();
  [...s].forEach((ch, i) => {
    if (lastSeen.get(ch) >= start) start = lastSeen.get(ch) + 1;
    lastSeen.set(ch, i);
    best = Math.max(best, i - start + 1);
  });
  return best;
};
const compress = (s) => s.replace(/(.)\1*/g, (run, ch) => ch + run.length);

console.log(isAnagram("listen", "silent"), isAnagram("rat", "car"));
console.log(firstUnique("swiss"), longestUniqueSubstring("abcabcbb"), compress("aaabccdddd"));
```

```text filename:Output
true false
w 3 a3b1c2d4
```

# Arrays

```javascript filename:JavaScript
const twoSum = (nums, target) => {             // O(n) with a hash map
  const seen = new Map();
  for (const [i, n] of nums.entries()) {
    if (seen.has(target - n)) return [seen.get(target - n), i];
    seen.set(n, i);
  }
  return null;
};
const maxSubarray = (nums) => {                // Kadane, O(n)
  let best = -Infinity, current = 0;
  for (const n of nums) {
    current = Math.max(n, current + n);
    best = Math.max(best, current);
  }
  return best;
};
const rotate = (arr, k) => {
  k %= arr.length;
  return [...arr.slice(-k), ...arr.slice(0, -k)];
};
const missingNumber = (nums) => (nums.length * (nums.length + 1)) / 2 - nums.reduce((a, b) => a + b, 0);
const moveZeros = (arr) => [...arr.filter((x) => x !== 0), ...arr.filter((x) => x === 0)];

console.log(twoSum([2, 7, 11, 15], 9), maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]));
console.log(rotate([1, 2, 3, 4, 5], 2), missingNumber([3, 0, 1]), moveZeros([0, 1, 0, 3, 12]));
```

```text filename:Output
[ 0, 1 ] 6
[ 4, 5, 1, 2, 3 ] 2 [ 1, 3, 12, 0, 0 ]
```

# Objects and data shaping

```javascript filename:JavaScript
const flattenObject = (obj, prefix = "") =>
  Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? { ...acc, ...flattenObject(v, key) }
      : { ...acc, [key]: v };
  }, {});
const get = (obj, path, fallback) =>
  path.split(".").reduce((cur, key) => cur?.[key], obj) ?? fallback;
const invert = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));

const config = { db: { host: "localhost", port: 5432 }, debug: true };
console.log(flattenObject(config));
console.log(get(config, "db.port"), get(config, "db.user.name", "n/a"));
console.log(invert({ a: "x", b: "y" }));
```

```text filename:Output
{ 'db.host': 'localhost', 'db.port': 5432, debug: true }
5432 n/a
{ x: 'a', y: 'b' }
```

# Async utilities

```javascript filename:JavaScript
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, { retries = 3, delay = 5 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt > retries) throw err;
      await sleep(delay * 2 ** (attempt - 1));     // exponential back-off
    }
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0, active = 0, peak = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      peak = Math.max(peak, ++active);
      results[i] = await fn(items[i]);
      active--;
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return { results, peak };
}

const flaky = async (attempt) => {
  if (attempt < 3) throw new Error(`attempt ${attempt} failed`);
  return `succeeded on attempt ${attempt}`;
};
console.log(await retry(flaky));
const { results, peak } = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
  await sleep(5);
  return n * n;
});
console.log(results, "max concurrent:", peak);
```

```text filename:Output
succeeded on attempt 3
[ 1, 4, 9, 16, 25 ] max concurrent: 2
```

# A tiny LRU cache

```javascript filename:JavaScript
class LRUCache {
  #map = new Map();                       // Map remembers insertion order
  constructor(capacity) { this.capacity = capacity; }
  get(key) {
    if (!this.#map.has(key)) return -1;
    const value = this.#map.get(key);
    this.#map.delete(key);                // move to most-recent position
    this.#map.set(key, value);
    return value;
  }
  put(key, value) {
    this.#map.delete(key);
    this.#map.set(key, value);
    if (this.#map.size > this.capacity) {
      this.#map.delete(this.#map.keys().next().value);   // evict least recent
    }
  }
  keys() { return [...this.#map.keys()]; }
}
const lru = new LRUCache(2);
lru.put("a", 1);
lru.put("b", 2);
lru.get("a");
lru.put("c", 3);                          // evicts "b"
console.log(lru.keys(), lru.get("b"), lru.get("c"));
```

```text filename:Output
[ 'a', 'c' ] -1 3
```

> [!NOTE] Key point
>
> Talk through complexity as you go: the anagram and two-sum solutions are O(n) time / O(n) space; the LRU operations are O(1) because `Map` keeps insertion order.
