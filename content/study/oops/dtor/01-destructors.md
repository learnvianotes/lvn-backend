---
id: 2784e1eb-65e5-74c6-a0c7-11a63d3e820d
key: topic:oops/dtor
subject: oops
topic: dtor
title: Destructors
slug: destructors
order: 1
---

The opposite of a constructor. Called automatically when an object goes out of scope to free allocated memory.

> [!INFO]
>
> <strong>Destructor</strong> — a special member function prefixed with `~` that runs automatically when an object is destroyed (goes out of scope or is explicitly deleted). Its job: release any dynamic memory the object owns to prevent memory leaks.

> [!NOTE] Constructor → Destructor order
>
> Objects are constructed in order. Destroyed in reverse order (LIFO). In inheritance: base constructor → derived constructor → ... → derived destructor → base destructor.

> [!NOTE] delete keyword
>
> `delete ptr` — frees heap memory for a single object.<br>`delete[] arr` — frees heap memory for an array.<br>Always pair `new` with `delete` to avoid leaks.

```cpp filename:C%2B%2B
class Teacher {

  int* data;

  public:

    Teacher() { data = new int[100]; } // alloc

    ~Teacher() { delete[] data; }       // free — ~symbol

};


// Manual delete for heap objects:

Teacher* t = new Teacher();

delete t;  // calls destructor + frees memory
```

> [!NOTE]
>
> <strong>Static objects</strong> live for the entire lifetime of the program. Their destructor is called only when the program exits — not when a function returns.
