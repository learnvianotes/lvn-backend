---
id: 8fde118b-e1a6-7f6b-8f8d-728b2990e8c8
key: topic:cpp/enums
subject: cpp
topic: enums
title: enum & enum class
slug: enum-enum-class
order: 1
---

Enumerations give names to a fixed set of integral values. Prefer the scoped `enum class` (C++11): its names don't leak and it doesn't convert to `int` silently.

# Unscoped `enum` (C-style)

```cpp filename:C%2B%2B
#include <iostream>
enum Color { Red, Green, Blue };          // Red=0, Green=1, Blue=2
enum Status { Ok = 200, NotFound = 404 };  // explicit values

int main() {
    Color c = Green;
    int n = c;                    // implicit conversion to int
    std::cout << n << ' ' << Blue + 1 << ' ' << NotFound << '\n';
}
```

```text filename:Output
1 3 404
```

> [!WARNING] Watch out
>
> Unscoped enumerators are injected into the surrounding scope — two enums can't both have a `None` — and they compare/convert freely with integers and each other.

# Scoped `enum class`

```cpp filename:C%2B%2B
#include <cstdint>
#include <iostream>
#include <string_view>

enum class Direction : std::uint8_t { North, East, South, West };   // underlying type: 1 byte

std::string_view name(Direction d) {
    switch (d) {
        case Direction::North: return "North";
        case Direction::East:  return "East";
        case Direction::South: return "South";
        case Direction::West:  return "West";
    }
    return "?";
}

Direction turnRight(Direction d) {
    return static_cast<Direction>((static_cast<int>(d) + 1) % 4);   // explicit conversions
}

int main() {
    Direction d = Direction::West;
    std::cout << name(d) << " -> " << name(turnRight(d)) << '\n';
    std::cout << sizeof(Direction) << ' ' << static_cast<int>(Direction::South) << '\n';
}
```

```text filename:Output
West -> North
1 2
```

```cpp filename:C%2B%2B
enum class Fruit { Apple, Pear };
int main() {
    int x = Fruit::Apple;      // error: no implicit conversion to int
    return x;
}
```

|  | `enum` | `enum class` |
| --- | --- | --- |
| Names scoped? | No — `Red` | Yes — `Color::Red` |
| Implicit → `int`? | Yes | No — needs `static_cast` |
| Underlying type | Implementation-chosen (can be fixed) | `int` by default, can be fixed (`: std::uint8_t`) |
| Forward-declarable | Only with fixed underlying type | Yes |

> [!NOTE] Key point
>
> With `-Wall`, a `switch` over an enum that misses an enumerator (and has no `default`) triggers a warning — a free exhaustiveness check. C++20 also allows `using enum Direction;` inside a scope to drop the prefix.

```question
Why prefer enum class over plain enum?

---

Scoping (no name clashes), strong typing (no accidental comparison with `int` or with another enum), and a guaranteed underlying type that allows forward declaration. You opt into conversions explicitly with `static_cast`.
```
