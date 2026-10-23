---
id: f8cc5055-b4f2-76c0-a7ff-d3fdf44a780e
key: topic:oops/friend
subject: oops
topic: friend
title: Friend
slug: friend
order: 1
---

Grant specific external functions or classes access to private and protected members — without making them part of the class.

> [!INFO]
>
> A <strong>friend function</strong> is declared inside a class with the `friend` keyword. It's not a member of the class, but it can access private and protected members. Friendship is granted by the class, not claimed by the function.

> [!NOTE] Friend function
>
> An external function that can access private members of a class. Declared inside the class with `friend` keyword. Defined outside the class like a regular function.
>
> `class Box {`<br><br>`  private: int volume;`<br><br>`  friend void printVolume(Box b);`<br><br>`};`<br><br>`void printVolume(Box b) {`<br><br>`  cout << b.volume; // can access private`<br><br>`}`

> [!NOTE] Friend class
>
> An entire class is granted access to another class's private members. Used when two closely related classes need to work intimately together (e.g., iterator + container).
>
> `class Engine;`<br><br>`class Car {`<br><br>`  friend class Engine; // Engine can see Car's private`<br><br>`  private: int fuelLevel;`<br><br>`};`

> [!WARNING]
>
> Overusing `friend` breaks encapsulation. Use sparingly — only when the external function genuinely needs deep access and can't get it through public methods.
