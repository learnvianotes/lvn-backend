---
id: 035dd605-a961-7b2c-aef1-77b57eff7c2d
key: topic:oops/poly
subject: oops
topic: poly
title: Polymorphism
slug: polymorphism
order: 1
---

"Many forms." Same function name, different behavior depending on context. Two kinds: compile-time and runtime.

> [!INFO]
>
> <strong>Polymorphism</strong> — the ability of objects to take on different forms or behave differently depending on context. One interface, multiple implementations.

### Compile-time (static)

> [!NOTE]
>
> <strong>Compile-time polymorphism</strong> — the compiler resolves which function to call at compile time. No runtime overhead. Two forms: function overloading and operator overloading.

> [!NOTE] Function overloading
>
> Same function name, different parameter list (count or type). Compiler picks the right version based on arguments.
>
> `int   add(int a, int b)               { return a+b; }`<br><br>`float add(float a, float b)           { return a+b; }`<br><br>`int   add(int a, int b, int c)     { return a+b+c; }`<br><br><br>`add(1, 2);       // calls version 1`<br><br>`add(1.1f, 2.2f); // calls version 2`<br><br>`add(1, 2, 3);    // calls version 3`

> [!NOTE] Operator overloading
>
> Redefine how standard operators (`+`, `-`, `==`) work with custom objects.
>
> `class Complex {`<br><br>`  int real, imag;`<br><br>`  Complex operator+(Complex c2) {`<br><br>`    Complex res;`<br><br>`    res.real = real + c2.real;`<br><br>`    return res;`<br><br>`  }`<br><br>`};`<br>`Complex c3 = c1 + c2; // calls operator+`

### Run-time (dynamic)

> [!NOTE]
>
> <strong>Run-time polymorphism</strong> — function to call is decided at runtime via virtual function tables. Requires inheritance. Enables flexible, extensible designs.

> [!NOTE] Function overriding
>
> Parent and child both define the same function. Child's version replaces parent's. Depends on inheritance.
>
> `class Animal {`<br><br>`  virtual void speak() { cout << "..."; }`<br><br>`};`<br><br>`class Dog : public Animal {`<br><br>`  void speak() { cout << "Woof!"; }  // overrides`<br><br>`};`<br><br>`Animal* a = new Dog();`<br><br>`a->speak();  // prints "Woof!" — runtime dispatch`

> [!NOTE] Virtual functions
>
> Declared with `virtual` in the base class. C++ uses a vtable (virtual function table) to resolve the correct override at runtime. Must be overridden in derived class.
>
> `virtual void draw() = 0;  // pure virtual — must override`<br><br>`// Class with pure virtual = abstract class`<br><br>`// Cannot instantiate abstract class directly`
>
> Without `virtual`, the base class version is always called regardless of the actual object type (static binding). With `virtual`, the correct override is called at runtime (dynamic binding).
