---
id: 07fb3e8c-1bc8-73ec-bc12-68928df0ff06
key: topic:javascript/browser-apis
subject: javascript
topic: browser-apis
title: "Browser APIs: fetch, Storage & More"
slug: browser-apis-fetch-storage-more
order: 1
---

The runtime gives JavaScript its superpowers: networking, storage, URLs, workers, observers. `fetch` and friends also exist in Node, so several examples here really run.

# fetch

`fetch` returns a promise for a `Response`. It <strong>only rejects on network failure</strong> — HTTP 404/500 still fulfils, so check `response.ok`. This demo starts a tiny local server so the output is deterministic:

```javascript filename:JavaScript
import http from "node:http";
const server = http.createServer((req, res) => {
  if (req.url === "/api/user") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: 1, name: "Asha" }));
  } else {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

async function getJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);   // fetch doesn't throw on 404!
  return res.json();
}
console.log(await getJSON(`${base}/api/user`));
try {
  await getJSON(`${base}/missing`);
} catch (e) {
  console.log("failed:", e.message);
}
const res = await fetch(`${base}/api/user`, { signal: AbortSignal.timeout(2000) });
console.log(res.status, res.headers.get("content-type"));
server.close();
```

```text filename:Output
{ id: 1, name: 'Asha' }
failed: HTTP 404
200 application/json
```

```javascript filename:JavaScript
await fetch("/api/todos", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ title: "Learn fetch" }),
  credentials: "include",            // send cookies cross-origin
});
```

```text filename:Output
JavaScript (POST request, not run)
```

# Web storage

|  | `localStorage` | `sessionStorage` | Cookies | IndexedDB |
| --- | --- | --- | --- | --- |
| Lifetime | Until cleared | Until the tab closes | Set by expiry | Until cleared |
| Size | \~5–10 MB | \~5 MB | \~4 KB each | Large (quota based) |
| Sent to server | No | No | With every request | No |
| API | Sync, strings only | Sync, strings only | `document.cookie` string | Async, structured data |

```javascript filename:JavaScript
localStorage.setItem("prefs", JSON.stringify({ theme: "dark" }));   // store strings only
const prefs = JSON.parse(localStorage.getItem("prefs") ?? "{}");
localStorage.removeItem("prefs");
window.addEventListener("storage", (e) => console.log(e.key, e.newValue)); // other tabs
```

```text filename:Output
JavaScript (browser, not run)
```

> [!WARNING] Watch out
>
> Never store secrets or auth tokens in `localStorage` — any XSS can read it. Prefer `HttpOnly`, `Secure`, `SameSite` cookies for sessions.

# Platform utilities that run everywhere

```javascript filename:JavaScript
const url = new URL("https://shop.example.com:8080/items/42?color=red&size=m#reviews");
console.log(url.hostname, url.port, url.pathname, url.hash);
url.searchParams.set("size", "l");
url.searchParams.append("tag", "new sale");
console.log(url.search);
console.log([...new TextEncoder().encode("hé")], btoa("hi"), atob("aGk="));
console.log(encodeURIComponent("a b&c/d"), crypto.randomUUID().length);
const blob = new Blob(["hello"], { type: "text/plain" });
console.log(blob.size, await blob.text());
```

```text filename:Output
shop.example.com 8080 /items/42 #reviews
?color=red&size=l&tag=new+sale
[ 104, 195, 169 ] aGk= hi
a%20b%26c%2Fd 36
5 hello
```

# Other APIs to know

| API | Use |
| --- | --- |
| Web Workers | Run CPU-heavy JS on another thread; talk via `postMessage` (no DOM access) |
| Service Workers | Network proxy for offline support, caching, push notifications (PWAs) |
| `IntersectionObserver` | Lazy-load images, infinite scroll — know when elements enter the viewport |
| `MutationObserver` / `ResizeObserver` | React to DOM changes / element size changes |
| `requestAnimationFrame` | Smooth animations synced to the display |
| `history.pushState`, `location` | Client-side routing in SPAs |
| `navigator.clipboard`, `geolocation`, `Notification` | Permission-gated device features |
| WebSocket / EventSource | Real-time two-way / server-sent streams |

# Same-origin policy and CORS

Browsers block scripts from reading responses from a different <strong>origin</strong> (scheme + host + port) unless the server opts in with CORS headers such as `Access-Control-Allow-Origin`. Non-simple requests (custom headers, `PUT`, JSON bodies) are preceded by an `OPTIONS` <strong>preflight</strong>. CORS is enforced by the browser, not the server — `curl` and Node ignore it.

```question
Does fetch reject on a 404?

---

No. `fetch` rejects only on network errors (DNS failure, offline, CORS block, abort). Any HTTP response — including 404 and 500 — fulfils; check `response.ok` or `response.status` and throw yourself.
```

```question
localStorage vs sessionStorage vs cookies?

---

`localStorage` persists across sessions, `sessionStorage` lasts for one tab session; both are \~5 MB, string-only, synchronous and never sent to the server. Cookies are tiny, sent with every matching request, and can be `HttpOnly` (hidden from JS) — the right place for session identifiers.
```
