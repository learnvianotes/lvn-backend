---
id: ccf05412-7b8e-7dc9-aca8-554c75f84d7d
key: topic:oops/static
subject: oops
topic: static
title: Static Keyword
slug: static-keyword
order: 1
---

Static variables exist for the entire program lifetime. Static class members are shared across all objects.

> [!NOTE] Static local variable
>
> Declared inside a function. Created and initialized only once. Retains its value between function calls. Lives until program ends.
>
> `void counter() {`<br>`  static int count = 0; // init once`<br>`  count++;`<br>`  cout << count; // 1, 2, 3 on each call`<br>`}`

> [!NOTE] Static class member
>
> Belongs to the class, not any specific object. Shared by all objects. Must be initialized outside the class definition. Accessed via `ClassName::member`.
>
> `class Bank {`<br>`  static float rate; // shared`<br>`};`<br>`float Bank::rate = 5.5f;`<br>`// Bank::rate — same for all objects`

> [!NOTE]
>
> <strong>Static objects</strong> — created once, live for the entire program lifetime. Destructor called only when the program terminates. Stored in a special memory segment (BSS/data), not on the stack.
