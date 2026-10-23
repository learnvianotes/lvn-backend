---
id: 7d8ce889-d558-7b8b-84a0-a2e8fcf21972
key: topic:python/mocking
subject: python
topic: mocking
title: Mocking & Test Doubles
slug: mocking-test-doubles
order: 1
---

A test double stands in for a slow, flaky or external dependency — an API, the clock, the database — so a unit test checks only <em>your</em> code. `unittest.mock` is the standard toolkit.

# Kinds of test doubles

| Double | What it does | Example |
| --- | --- | --- |
| Stub | Returns canned answers | `get_rate()` always returns `83.0` |
| Mock | Records calls so you can assert on them | “`send_email` was called once with this address” |
| Fake | A working lightweight implementation | An in-memory dict instead of a real database |
| Spy | Wraps the real object and records calls | `Mock(wraps=real_func)` |

# Mock basics

```python filename:Python
from unittest.mock import Mock

api = Mock()
api.get_user.return_value = {"id": 7, "name": "Asha"}   # stub a method

print(api.get_user(7)["name"])                    # Asha
print(api.get_user.call_count)                    # 1
print(api.get_user.call_args)                     # call(7)
api.get_user.assert_called_once_with(7)           # passes silently

print(type(api.anything.you.like).__name__)       # Mock   ← attributes are created on demand
```

# side\_effect: exceptions and sequences

```python filename:Python
from unittest.mock import Mock

def fetch_with_retry(client, attempts=3):
    for i in range(attempts):
        try:
            return client.fetch()
        except ConnectionError:
            if i == attempts - 1:
                raise

client = Mock()
client.fetch.side_effect = [ConnectionError(), ConnectionError(), "data"]   # fail, fail, succeed
print(fetch_with_retry(client), client.fetch.call_count)   # data 3

client.fetch.side_effect = ConnectionError("down")          # always fail
try:
    fetch_with_retry(client)
except ConnectionError as e:
    print("gave up:", e)                                     # gave up: down

double = Mock(side_effect=lambda x: x * 2)                   # compute the return value
print(double(21))                                            # 42
```

# patch: replace a name during a test

`patch` swaps an attribute for a mock and restores it afterwards. Patch <strong>where the name is looked up</strong>, not where it was defined: if `app.py` does `from time import time`, patch `app.time`, not `time.time`.

```python filename:Python
import time
from unittest.mock import patch

class Greeter:
    def greeting(self):
        hour = time.localtime().tm_hour
        return "Good morning" if hour < 12 else "Good afternoon"

fake = time.struct_time((2026, 9, 29, 9, 0, 0, 1, 272, 0))
with patch.object(time, "localtime", return_value=fake):      # context-manager form
    print(Greeter().greeting())                                # Good morning

@patch.object(Greeter, "greeting", return_value="Hi")          # decorator form
def check(mock_greeting):
    result = Greeter().greeting()
    mock_greeting.assert_called_once()
    return result

print(check())                                                 # Hi
print(time.localtime is not None)                              # True   ← original restored
```

```python filename:Python
import os
from unittest.mock import patch, mock_open

with patch.dict(os.environ, {"FEATURE_X": "on"}):     # temporary environment
    print(os.environ["FEATURE_X"])                    # on
print("FEATURE_X" in os.environ)                      # False

with patch("builtins.open", mock_open(read_data="line1\nline2")):
    with open("any/path.txt") as f:                   # no real file touched
        print(f.read().splitlines())                  # ['line1', 'line2']
```

# spec &amp; autospec: mocks that fail like the real thing

```python filename:Python
from unittest.mock import create_autospec

class PaymentGateway:
    def charge(self, amount: int, currency: str) -> str:
        raise NotImplementedError

gateway = create_autospec(PaymentGateway, instance=True)
gateway.charge.return_value = "txn-1"
print(gateway.charge(500, "INR"))                     # txn-1

try:
    gateway.charge(500)                               # wrong signature → error, like the real method
except TypeError:
    print("signature checked")                        # signature checked
try:
    gateway.refund(1)                                 # no such method on the real class
except AttributeError:
    print("unknown method rejected")                  # unknown method rejected
```

> [!WARNING] Watch out
>
> A plain `Mock()` accepts any call and any attribute, so a typo like `mock.assert_caled_once()` or a renamed method can make a broken test pass. Use `spec=`/`autospec` (and Python rejects `assert_*` typos since 3.12).

# pytest's monkeypatch

```python filename:Python
def test_uses_api_key(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-key")
    monkeypatch.setattr("shop.payments.charge", lambda amount: "ok")
    assert checkout(100) == "ok"          # undone automatically after the test
```

> [!TIP] Do
>
> Mock at the boundaries: network, time, randomness, file system, third-party services.

> [!DANGER] Avoid
>
> Mocking your own internal functions everywhere — tests then mirror the implementation and break on every refactor while missing real bugs.

```question
Why do you patch where an object is used, not where it's defined?

---

`from module import name` copies the reference into the importing module's namespace. Patching the original module doesn't change that copy, so the code under test still calls the real function. Patch `consumer_module.name`.
```

```question
Mock vs MagicMock?

---

`MagicMock` is a `Mock` that also pre-configures magic methods (`__len__`, `__iter__`, `__enter__`, …), so it can stand in for containers or context managers. `patch` uses `MagicMock` by default.
```

```question
What is side\_effect used for?

---

To make a mock raise an exception, return successive values from an iterable, or compute its result with a function — for testing error handling and retries.
```
