---
id: b23c2b0e-655a-76a6-ab31-ee8b4cfc2701
key: topic:oops/access
subject: oops
topic: access
title: Access Modifiers
slug: access-modifiers
order: 1
---

Control who can see and use which data members and methods. The primary tool for data hiding.

> [!NOTE] public
>
> Accessible from anywhere — inside the class, outside the class, in derived classes. Least restrictive.

> [!NOTE] private
>
> Accessible only inside the class itself. Not even derived classes can access. Most restrictive. Default in C++ classes.

> [!NOTE] protected
>
> Accessible inside the class AND in derived classes. Not accessible from outside. Middle ground.

# Inheritance access table

| Base class | Derived: private mode | Derived: protected mode | Derived: public mode |
| --- | --- | --- | --- |
| private | Not inherited | Not inherited | Not inherited |
| protected | → private | → protected | → protected |
| public | → private | → protected | → public |

> [!NOTE]
>
> <strong>Key rule:</strong> Private members are NEVER inherited regardless of inheritance mode. Protected and public members are inherited, but their visibility in the derived class is determined by the inheritance mode — it can only become more restrictive, never less.

# Getters and Setters

> [!INFO]
>
> Since private data can't be accessed directly from outside, we use <strong>getter</strong> functions (to read private data) and <strong>setter</strong> functions (to write private data with validation). This gives controlled access.

```cpp filename:C%2B%2B
class Student {

  private:

    int age;

  public:

    void setAge(int a) {     // setter — validates before setting

      if(a > 0) age = a;

    }

    int getAge() {           // getter — read-only access

      return age;

    }

};
```
