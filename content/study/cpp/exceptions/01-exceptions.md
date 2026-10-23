---
id: c7f2dbfc-a9c0-741e-a272-1f1b1c4721fd
key: topic:cpp/exceptions
subject: cpp
topic: exceptions
title: Exceptions
slug: exceptions
order: 1
---

`throw` signals an error that the current function can't handle; the stack unwinds (destroying locals) until a matching `catch` is found.

# throw / try / catch

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
#include <string>

double divide(double a, double b) {
    if (b == 0) throw std::invalid_argument("division by zero");
    return a / b;
}

int parseAge(const std::string& s) {
    int age = std::stoi(s);                          // may throw invalid_argument / out_of_range
    if (age < 0 || age > 150) throw std::out_of_range("age " + s + " out of range");
    return age;
}

int main() {
    try {
        std::cout << divide(10, 4) << '\n';
        std::cout << divide(1, 0) << '\n';           // throws — the rest of the try is skipped
        std::cout << "never printed\n";
    } catch (const std::invalid_argument& e) {
        std::cout << "invalid: " << e.what() << '\n';
    }

    for (std::string input : {"42", "abc", "200"}) {
        try {
            std::cout << parseAge(input) << '\n';
        } catch (const std::out_of_range& e) {       // most specific first
            std::cout << "range: " << e.what() << '\n';
        } catch (const std::exception& e) {          // any standard exception
            std::cout << "error: " << e.what() << '\n';
        } catch (...) {                              // anything at all
            std::cout << "unknown\n";
        }
    }
}
```

```text filename:Output
2.5
invalid: division by zero
42
error: stoi: no conversion
range: age 200 out of range
```

> [!NOTE] Rule
>
> Throw by value, catch by <strong>const reference</strong> (`catch (const std::exception& e)`). Catching by value copies and <em>slices</em> derived exceptions; catching by reference keeps their dynamic type and `what()`.

# The standard hierarchy

| Exception | Thrown by / used for |
| --- | --- |
| `std::exception` | Base of all — has `virtual const char* what()` |
| `std::logic_error` → `invalid_argument`, `out_of_range`, `length_error`, `domain_error` | Bugs detectable before running: bad arguments, `vector::at`, `stoi` |
| `std::runtime_error` → `range_error`, `overflow_error`, `system_error` | Errors only detectable at run time: I/O, OS |
| `std::bad_alloc` | `new` failed |
| `std::bad_cast`, `std::bad_optional_access`, `std::bad_variant_access`, `std::bad_function_call` | Misused library types |

# Custom exceptions &amp; rethrowing

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
#include <string>

class HttpError : public std::runtime_error {
public:
    HttpError(int code, const std::string& msg)
        : std::runtime_error(msg), code_(code) {}
    int code() const noexcept { return code_; }
private:
    int code_;
};

void fetch() { throw HttpError(404, "page not found"); }

void handler() {
    try {
        fetch();
    } catch (const HttpError& e) {
        std::cout << "log: " << e.code() << '\n';
        throw;                                       // rethrow the SAME exception object
    }
}

int main() {
    try { handler(); }
    catch (const std::exception& e) { std::cout << "top level: " << e.what() << '\n'; }
}
```

```text filename:Output
log: 404
top level: page not found
```

# Stack unwinding

```cpp filename:C%2B%2B
#include <iostream>
#include <stdexcept>
struct Guard {
    const char* name;
    ~Guard() { std::cout << "cleanup " << name << '\n'; }
};
void inner() { Guard g{"inner"}; throw std::runtime_error("fail"); }
void outer() { Guard g{"outer"}; inner(); }
int main() {
    try { outer(); } catch (const std::exception& e) { std::cout << "caught " << e.what() << '\n'; }
}
```

```text filename:Output
cleanup inner
cleanup outer
caught fail
```

> [!TIP] Do
>
> Use exceptions for <em>exceptional</em> failures that the immediate caller can't sensibly handle (I/O failure, invalid config, out of memory). Rely on RAII so unwinding cleans up.

> [!DANGER] Avoid
>
> Using exceptions for normal control flow (e.g. “not found” in a lookup), throwing from destructors, or `catch (...) {}` that silently swallows errors.

> [!WARNING] Watch out
>
> If an exception escapes `main` (or any `noexcept` function), `std::terminate` is called and the program aborts — destructors of the remaining stack may not run.

```question
What happens when an exception is thrown?

---

The exception object is copied/moved into special storage, then the runtime searches up the call stack for a matching `catch`. Each frame it leaves is <em>unwound</em>: local objects are destroyed in reverse order. When a handler matches (by type, allowing derived-to-base), it runs; if none matches, `std::terminate` is called.
```

```question
Exceptions vs error codes?

---

Exceptions can't be ignored silently, separate the error path from the happy path, and carry rich information through many layers. Error codes (or `std::optional`/`std::expected`) are explicit in the signature, cheaper when failure is common, and required where exceptions are disabled (some embedded/game code). Many code bases use exceptions for rare failures and return values for expected ones.
```
