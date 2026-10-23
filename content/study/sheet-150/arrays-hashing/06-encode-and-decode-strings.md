---
id: 97b97de1-5fe8-7aa9-bf4e-6ab972a38d47
key: problem:sheet-150/lc-271
subject: sheet-150
topic: arrays-hashing
title: Encode and Decode Strings
slug: encode-and-decode-strings
order: 6
---

Difficulty: <strong>Medium</strong> · [LeetCode 271](https://leetcode.com/problems/encode-and-decode-strings/)

# Problem

Design encode/decode for a list of strings to a single string. Must handle any characters including `#`, `|`, etc.

# Intuition

<strong>Length-prefix encoding:</strong> Format each string as `"{length}#{content}"`. During decode, read the length, skip `#`, read exactly that many chars. No delimiter collisions possible.

# Optimized Code

```python filename:Python
class Codec:
    def encode(self, strs: list[str]) -> str:
        return ''.join(f'{len(s)}#{s}' for s in strs)

    def decode(self, s: str) -> list[str]:
        res, i = [], 0
        while i < len(s):
            j = s.index('#', i)
            length = int(s[i:j])
            res.append(s[j+1:j+1+length])
            i = j+1+length
        return res
```

```cpp filename:C%2B%2B
class Codec {
public:
    string encode(vector<string>& strs) {
        string res;
        for (const string& s : strs) res += to_string(s.size()) + "#" + s;
        return res;
    }

    vector<string> decode(string s) {
        vector<string> res;
        int i = 0;
        while (i < s.size()) {
            int j = s.find('#', i);
            int length = stoi(s.substr(i, j - i));
            res.push_back(s.substr(j + 1, length));
            i = j + 1 + length;
        }
        return res;
    }
};
```

```java filename:Java
class Codec {
    public String encode(List<String> strs) {
        StringBuilder sb = new StringBuilder();
        for (String s : strs) sb.append(s.length()).append('#').append(s);
        return sb.toString();
    }

    public List<String> decode(String s) {
        List<String> res = new ArrayList<>();
        int i = 0;
        while (i < s.length()) {
            int j = s.indexOf('#', i);
            int length = Integer.parseInt(s.substring(i, j));
            res.add(s.substring(j + 1, j + 1 + length));
            i = j + 1 + length;
        }
        return res;
    }
}
```

```javascript filename:JavaScript
var encode = s => s.map(w => `${w.length}#${w}`).join('');
var decode = function(s) {
    const res=[]; let i=0;
    while(i<s.length){
        const j=s.indexOf('#',i), len=parseInt(s.slice(i,j));
        res.push(s.slice(j+1,j+1+len)); i=j+1+len;
    }
    return res;
};
```

<strong>Encode O(n) · Decode O(n) · Space O(n)</strong>

# Takeaway

<strong>Pattern: Length-Prefix Encoding</strong> — Encode variable-length data with a length prefix to avoid delimiter ambiguity. Used in HTTP/2 framing, protobuf, network protocols.
