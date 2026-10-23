---
id: f6435e73-a619-761b-81b2-60fe7aa6e314
key: topic:cpp/inheritance
subject: cpp
topic: inheritance
title: Inheritance & Access Specifiers
slug: inheritance-access-specifiers
order: 1
---

A derived class inherits the members of its base class and can add or customise behaviour. Public inheritance models an <strong>is-a</strong> relationship.

# Basics

```cpp filename:C%2B%2B
#include <iostream>
#include <string>

class Animal {
public:
    explicit Animal(std::string name) : name_(std::move(name)) { std::cout << "Animal()\n"; }
    ~Animal() { std::cout << "~Animal()\n"; }
    void eat() const { std::cout << name_ << " eats\n"; }
protected:
    std::string name_;                 // visible to derived classes, not to outsiders
};

class Dog : public Animal {
public:
    Dog(std::string name, std::string breed)
        : Animal(std::move(name)), breed_(std::move(breed)) { std::cout << "Dog()\n"; }   // base first
    ~Dog() { std::cout << "~Dog()\n"; }
    void bark() const { std::cout << name_ << " the " << breed_ << " barks\n"; }
private:
    std::string breed_;
};

int main() {
    Dog d("Rex", "beagle");
    d.eat();          // inherited
    d.bark();         // added
}
```

```text filename:Output
Animal()
Dog()
Rex eats
Rex the beagle barks
~Dog()
~Animal()
```

> [!NOTE] Order
>
> Construction goes <strong>base → members → derived body</strong>; destruction runs in exactly the reverse order.

# Inheritance access

| Base member is… | `public` inheritance | `protected` inheritance | `private` inheritance |
| --- | --- | --- | --- |
| `public` | public | protected | private |
| `protected` | protected | protected | private |
| `private` | inaccessible | inaccessible | inaccessible |

- `public` inheritance = <em>is-a</em> (a `Dog` can be used wherever an `Animal&` is expected). 99% of the time this is what you want.
- `private` inheritance = <em>implemented-in-terms-of</em> — usually better expressed with composition (a member).
- `class D : B` defaults to <strong>private</strong> inheritance; `struct D : B` to public.

# Hiding, `using` and calling the base version

```cpp filename:C%2B%2B
#include <iostream>

struct Base {
    void greet() const { std::cout << "Base::greet\n"; }
    void greet(int n) const { std::cout << "Base::greet(" << n << ")\n"; }
};

struct Derived : Base {
    using Base::greet;                 // without this, greet(int) would be hidden
    void greet() const {
        std::cout << "Derived::greet, then ";
        Base::greet();                 // call the base version explicitly
    }
};

struct WithCtors : Base {
    using Base::Base;                  // inherit constructors (C++11)
};

int main() {
    Derived d;
    d.greet();
    d.greet(3);
}
```

```text filename:Output
Derived::greet, then Base::greet
Base::greet(3)
```

> [!WARNING] Watch out
>
> Declaring a function in the derived class with the same <em>name</em> hides <strong>all</strong> base overloads of that name, whatever their parameters. Bring them back with `using Base::name;`.

# Composition vs inheritance

> [!TIP] Do
>
> Use inheritance for genuine is-a relationships with polymorphic behaviour; prefer <strong>composition</strong> (has-a) for reuse: a `Car` <em>has an</em> `Engine`.

> [!DANGER] Avoid
>
> Inheriting just to reuse code (`class Stack : public std::vector<int>`) — it exposes every base operation and couples you to its implementation.

```question
What is not inherited from a base class?

---

Constructors (unless brought in with `using Base::Base;`), the destructor, copy/move assignment operators (the derived class gets its own implicitly-declared ones), and friendships. Private members <em>are</em> inherited — they're part of the object — but not accessible.
```
