---
id: e4be00c2-3725-715c-8d36-1ec0c063bf57
key: topic:oops/abs
subject: oops
topic: abs
title: Abstraction
slug: abstraction
order: 1
---

Hide unnecessary implementation details. Expose only what the user of your class needs to know.

> [!INFO]
>
> <strong>Abstraction</strong> — showing only the essential features while hiding the complex implementation. You drive a car without knowing how the engine works. You use `sort()` without knowing the algorithm. That's abstraction.

> [!NOTE] vs. Encapsulation
>
> <strong>Encapsulation</strong> is the mechanism (bundling + private). <strong>Abstraction</strong> is the design principle (hiding complexity). Encapsulation implements abstraction.<br><br>Abstraction: what to hide. Encapsulation: how to hide it.

> [!NOTE] Abstract classes
>
> A class with at least one pure virtual function. Cannot be instantiated directly. Meant to be a base class — defines the interface that derived classes must implement.

```cpp filename:C%2B%2B
class Shape {   // abstract class

  public:

    virtual float area() = 0;  // pure virtual

};


class Circle : public Shape {

  float r;

  float area() { return 3.14f * r * r; } // must implement

};


// Shape s; // ERROR — cannot instantiate abstract class

Shape* s = new Circle(); // OK — pointer to abstract
```
