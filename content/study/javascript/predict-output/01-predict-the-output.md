---
id: b0c6c5ef-2f94-7524-b0aa-59a4baf656e7
key: topic:javascript/predict-output
subject: javascript
topic: predict-output
title: Predict the Output
slug: predict-the-output
order: 1
---

The most common JavaScript interview format: read a snippet, say what it prints and <em>why</em>. Try each one before looking at the output.

# 1. Hoisting

```javascript filename:JavaScript
var x = 1;
function test() {
  console.log(x);
  var x = 2;
  console.log(x);
}
test();
console.log(typeof hoisted, typeof expr);
function hoisted() {}
var expr = function () {};
```

```text filename:Output
undefined
2
function undefined
```

The local `var x` is hoisted to the top of `test` (as `undefined`) and shadows the global. `expr` is a `var` still holding `undefined` when `typeof` runs.

# 2. Closures in loops

```javascript filename:JavaScript
const fns = [];
for (var i = 0; i < 3; i++) fns.push(() => i);
const fns2 = [];
for (let i = 0; i < 3; i++) fns2.push(() => i);
console.log(fns.map((f) => f()), fns2.map((f) => f()));
```

```text filename:Output
[ 3, 3, 3 ] [ 0, 1, 2 ]
```

# 3. this

```javascript filename:JavaScript
const obj = {
  name: "obj",
  regular() { return this.name; },
  arrow: () => typeof this,
  nested() {
    const inner = () => this.name;     // arrow borrows nested()'s this
    function plain() { return this; }  // plain call → undefined (strict)
    return [inner(), plain()];
  },
};
const { regular } = obj;
console.log(obj.regular(), obj.arrow(), obj.nested());
try { regular(); } catch (e) { console.log(e.constructor.name); }
```

```text filename:Output
obj undefined [ 'obj', undefined ]
TypeError
```

# 4. Event loop ordering

```javascript filename:JavaScript
console.log(1);
setTimeout(() => console.log(2), 0);
Promise.resolve().then(() => {
  console.log(3);
  setTimeout(() => console.log(4), 0);
  Promise.resolve().then(() => console.log(5));
});
(async () => {
  console.log(6);
  await undefined;
  console.log(7);
})();
console.log(8);
```

```text filename:Output
1
6
8
3
7
5
2
4
```

Sync first (1, 6, 8). Then microtasks in queue order: the `then` (3, which queues 5 and timer 4), the `await` continuation (7), then 5. Finally macrotasks in order: 2, then 4.

# 5. Coercion

```javascript filename:JavaScript
console.log(1 < 2 < 3, 3 > 2 > 1);
console.log("5" + 3, "5" - 3, "5" * "2", true + true);
console.log([] + null + 1, [2] * [3], {} + []);
console.log(0 || null || "" || undefined, 1 && "a" && 0);
```

```text filename:Output
true false
53 2 10 2
null1 6 [object Object]
undefined 0
```

`3 > 2 > 1` → `true > 1` → `1 > 1` → `false`. `[] + null + 1` → `"" + "null"` → `"null" + 1`. `||` returns the last operand when all are falsy; `&&` returns the first falsy one.

# 6. References and copies

```javascript filename:JavaScript
let a = { n: 1 };
let b = a;
a.n = 2;
a = { n: 3 };
console.log(b.n);

const arr = [1, 2, 3];
const copy = arr;
copy.push(4);
const spread = [...arr];
spread.push(5);
console.log(arr.length, spread.length);

function change(o) { o.value = "changed"; o = { value: "replaced" }; }
const item = { value: "original" };
change(item);
console.log(item.value);
```

```text filename:Output
2
4 5
changed
```

# 7. Promises

```javascript filename:JavaScript
const p = new Promise((resolve, reject) => {
  console.log("A");
  resolve("B");
  reject("C");
  console.log("D");
});
p.then(console.log).catch(() => console.log("never"));
Promise.reject(new Error("E"))
  .then(() => console.log("skipped"))
  .catch((e) => e.message)
  .then((m) => console.log(m + "!"))
  .finally(() => console.log("F"));
console.log("G");
```

```text filename:Output
A
D
G
B
E!
F
```

# 8. Mixed bag

```javascript filename:JavaScript
console.log(typeof typeof 1, typeof [] === typeof null);
console.log([..."abc"].map(parseInt));
console.log(0.1 + 0.2 == 0.3, 0.5 + 0.25 == 0.75);
const x = { a: 1 }, y = { a: 1 };
console.log(x == y, JSON.stringify(x) === JSON.stringify(y));
console.log([1, 2, 3].indexOf(3) > -1 ? "found" : "missing", [10, 1, 3].sort().join());
function Foo() { return this; }
console.log(new Foo() instanceof Foo, Foo());
```

```text filename:Output
string true
[ NaN, NaN, NaN ]
false true
false true
found 1,10,3
true undefined
```

> [!NOTE] Key point
>
> `parseInt("a", 0)` → `NaN` (radix 0 means default 10, but `a` is not a digit), then radix 1 is invalid, and `"c"` isn't a base-2 digit. `0.5 + 0.25` is exact because both are powers of two.
