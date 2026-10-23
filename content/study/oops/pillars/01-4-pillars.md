---
id: 4056b85e-43c0-7f94-b250-39f7f33ab450
key: topic:oops/pillars
subject: oops
topic: pillars
title: 4 Pillars
slug: 4-pillars
order: 1
---

What each pillar means, how to identify it, and the key mechanism that implements it.

> [!NOTE] Encapsulation
>
> What it is
>
> Bundle data + methods in a class. Hide internals.
>
> How to identify
>
> Private fields with public getters/setters.
>
> Mechanism
>
> `private`, `protected`, getters/setters.

> [!NOTE] Inheritance
>
> What it is
>
> Child class reuses parent class code.
>
> How to identify
>
> `: public Parent` syntax. "is-a" relationship.
>
> Mechanism
>
> Base/derived classes. 5 types. Mode specifiers.

> [!NOTE] Polymorphism
>
> What it is
>
> Same name, different behavior per context.
>
> How to identify
>
> Overloading (compile) or overriding (runtime).
>
> Mechanism
>
> `virtual` functions, vtable, overloading.

> [!NOTE] Abstraction
>
> What it is
>
> Show only necessary parts. Hide complexity.
>
> How to identify
>
> Abstract classes, pure virtual functions, interfaces.
>
> Mechanism
>
> `= 0` pure virtual. Abstract base class pattern.
