---
id: 918d330b-9024-7f9c-beb0-4115d62451b9
key: topic:oops/copy
subject: oops
topic: copy
title: Deep vs Shallow
slug: deep-vs-shallow
order: 1
---

Copying objects that contain pointers requires care. Shallow copy shares memory — dangerous. Deep copy duplicates it — safe.

> [!NOTE] Shallow copy
>
> Copies member values bit-by-bit. Pointer members are copied — both objects point to the same heap memory.
>
> `int* ptr = new int(42);`<br><br>`int* copy = ptr; // same address!`<br><br>`delete ptr;       // deletes the data`<br><br>`// copy now points to freed memory — crash!`

> [!NOTE] Deep copy
>
> Allocates new memory and copies the data into it. Both objects are fully independent.
>
> `int* ptr = new int(42);`<br><br>`int* copy = new int(*ptr); // new alloc`<br><br>`delete ptr;  // safe — copy is independent`

> [!WARNING]
>
> <strong>Rule of Three (C++):</strong> If you define any of destructor, copy constructor, or copy assignment operator — you should define all three. This ensures deep copies everywhere dynamic memory is used.

> [!NOTE]
>
> <strong>When does this matter?</strong> Only when your class owns heap memory (via `new`). If all members are value types (int, string, etc.), the default copy constructor is fine.
