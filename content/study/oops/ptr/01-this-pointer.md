---
id: 5f888cc7-a36d-7d77-a25f-901d0abab833
key: topic:oops/ptr
subject: oops
topic: ptr
title: this Pointer
slug: this-pointer
order: 1
---

A special hidden pointer in every member function that points to the object that called the function.

> [!INFO]
>
> <strong>this</strong> is an implicit pointer available inside every non-static member function. It holds the address of the current object. Used to disambiguate when a local variable shadows a member variable, or to return the current object from a method.

```cpp filename:C%2B%2B
class Teacher {

  string name;

  public:

    void setName(string name) {

      // 'name' (param) shadows 'name' (member)

      this->name = name;  // this->name = member

    }

};


// this->prop is the same as (*this).prop

// Used in copy constructor to avoid ambiguity
```

> [!NOTE] this->prop
>
> Accesses the current object's member. Equivalent to `(*this).prop`. Arrow operator dereferences the pointer and accesses the member in one step.

> [!NOTE] Return *this
>
> Return the current object by reference to enable method chaining: `obj.setName("A").setSalary(100)`. Each method returns `*this` (the object itself).
