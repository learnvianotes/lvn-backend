---
id: 53d50632-e685-7368-9781-a0bb82c765fb
key: topic:oops/encap
subject: oops
topic: encap
title: Encapsulation
slug: encapsulation
order: 1
---

Wrapping data and member functions together in a single unit (class). Like a capsule that hides the medicine inside.

> [!INFO]
>
> <strong>Encapsulation</strong> = bundling data (attributes) + methods (behaviors) that operate on that data into a single unit called a class. The internal implementation is hidden — users only interact through the public interface.<br><br><strong>Data hiding</strong> is achieved by marking sensitive members as `private`. External code cannot accidentally or maliciously corrupt the internal state.

> [!NOTE] The Capsule Analogy
>
> A medicine capsule hides its complex chemical formula inside. You just swallow it — you don't need to know the internals. Similarly, a class exposes a clean public interface and hides implementation details.

> [!NOTE] Why Encapsulate?
>
> Protects data integrity (validation in setters), reduces coupling between components, easier to change internals without breaking external code, and makes debugging simpler.

```
// Bad — no encapsulation

Student s; s.age = -5;  // invalid, but allowed


// Good — encapsulated

s.setAge(-5);  // setter rejects invalid value

s.setAge(20);  // valid, stored safely
```
