---
id: fa1e7cc2-4031-7c90-8327-8d555f772d79
key: topic:javascript/how-js-runs
subject: javascript
topic: how-js-runs
title: How JavaScript Runs
slug: how-javascript-runs
order: 1
---

Source text → tokens → AST → bytecode → optimised machine code. One call stack, one heap, and an event loop that feeds it work.

# The pipeline inside V8

Source code → Parser → AST → Ignition (bytecode) → TurboFan (optimised machine code)

1. <strong>Parse</strong>

   The source is tokenised and turned into an <strong>Abstract Syntax Tree</strong>. Syntax errors are found here — before a single line runs.

2. <strong>Interpret</strong>

   The <strong>Ignition</strong> interpreter compiles the AST to compact bytecode and starts running it immediately (fast startup).

3. <strong>Profile</strong>

   While running, the engine records which functions are <em>hot</em> and which types they see.

4. <strong>Optimise (JIT)</strong>

   Hot functions are compiled by <strong>TurboFan</strong> (and the mid-tier Maglev) into machine code specialised for the observed types.

5. <strong>Deoptimise</strong>

   If an assumption breaks (a function that always saw numbers suddenly gets a string), the engine throws the optimised code away and falls back to bytecode.

> [!INFO]
>
> <strong>JIT (Just-In-Time) compilation</strong> — compiling code to machine code <em>while the program runs</em>, using runtime type feedback — so JavaScript is neither purely interpreted nor ahead-of-time compiled.

> [!NOTE] Performance tip
>
> Write <em>monomorphic</em> code: keep the same object shapes and argument types in hot paths. Mixing types in one function (`add(1, 2)` then `add('a', 'b')`) makes it polymorphic and slower.

# Memory: stack and heap

> [!NOTE] Call stack
>
> A LIFO stack of <strong>execution contexts</strong> — one frame per running function call, holding its local variables and where to return to.

> [!NOTE] Heap
>
> A large unstructured region where objects, arrays and closures live. Managed automatically by the <strong>garbage collector</strong>.

# Execution contexts

Every time code runs it gets an <strong>execution context</strong>. There is one <em>global</em> context, plus one new context per function call. Each context is created in two phases:

| Phase | What happens |
| --- | --- |
| <strong>Creation</strong> (memory) | Scope is set up; `var` names are created as `undefined`, function declarations are stored in full, `let`/`const`/`class` names are created but <em>uninitialised</em> (TDZ). `this` is determined. |
| <strong>Execution</strong> | Code runs line by line; assignments fill in the values. |

# The call stack in action

```javascript filename:JavaScript
function third() {
  console.log("3. in third — stack: global → first → second → third");
}
function second() {
  console.log("2. in second");
  third();
  console.log("4. back in second");
}
function first() {
  console.log("1. in first");
  second();
  console.log("5. back in first");
}
first();
```

```text filename:Output
1. in first
2. in second
3. in third — stack: global → first → second → third
4. back in second
5. back in first
```

If functions call each other without end, the stack overflows:

```javascript filename:JavaScript
function forever(n) {
  return forever(n + 1);
}
try {
  forever(0);
} catch (e) {
  console.log(e.name + ": " + e.message);
}
```

```text filename:Output
RangeError: Maximum call stack size exceeded
```

# Single-threaded, yet non-blocking

JavaScript runs your code on <strong>one thread</strong>. Slow work (network, disk, timers) is handed to the runtime; when it finishes, a callback is queued and the <strong>event loop</strong> pushes it onto the stack once the stack is empty. See <em>The Event Loop</em> topic for the full picture.

Call stack → Runtime APIs (timers, I/O) → Task queues → Event loop → back to stack

```question
Is JavaScript interpreted or compiled?

---

Both. Modern engines parse to bytecode and interpret it for fast startup, then JIT-compile hot functions to optimised machine code using runtime type feedback — and can deoptimise if assumptions break.
```

```question
What is an execution context?

---

The environment a piece of code runs in: its variable environment (scope), the outer-scope reference (scope chain), and the value of `this`. A global context is created first, then one per function call, pushed onto the call stack.
```
