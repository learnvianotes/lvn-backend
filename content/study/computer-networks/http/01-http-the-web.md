---
id: a179e4c9-76ff-7cd6-b725-36d98933c2f8
key: topic:computer-networks/http
subject: computer-networks
topic: http
title: HTTP & the Web
slug: http-the-web
order: 1
---

The protocol underneath every webpage you've ever loaded.

> [!INFO] Definition
>
> <strong>HTTP</strong> (HyperText Transfer Protocol) is an application-layer protocol that defines how a client requests a resource from a server, and how the server formats its response. HTTP itself runs <strong>on top of TCP</strong> — TCP guarantees the underlying bytes actually arrive, HTTP defines what those bytes mean.

# Stateless by design

HTTP is a <strong>stateless protocol</strong> — by default, each request is independent and the server doesn't remember anything about previous requests from the same client. This is exactly why <strong>cookies</strong> exist: to layer state on top of a fundamentally stateless protocol.

# HTTP Methods

| Method | Purpose |
| --- | --- |
| `GET` | Retrieve a resource, no side effects |
| `POST` | Create a new resource / submit data |
| `PUT` | Replace a resource entirely |
| `PATCH` | Partially update a resource |
| `DELETE` | Remove a resource |

# Status codes

| Range | Meaning |
| --- | --- |
| `1xx` | Informational |
| `2xx` | Success |
| `3xx` | Redirection |
| `4xx` | Client mistake (bad request, unauthorized, not found) |
| `5xx` | Server error |

# Request &amp; Response headers

Both requests and responses carry metadata in <strong>headers</strong> — e.g. content type, content length, and `Keep-Alive` settings, which define a timeout for how long a TCP connection should stay open for reuse before being closed, avoiding the overhead of reconnecting for every single request.

# Cookies

> [!INFO] Definition
>
> A <strong>cookie</strong> is a small unique string set by a server and stored in the client's browser, used to maintain state across otherwise-stateless HTTP requests (e.g. staying logged in).

- The first time you visit a site, the server sets the cookie in your browser.
- On every subsequent visit, the browser automatically sends that cookie back, letting the server recognize you.
- Cookies have an <strong>expiration date</strong>, after which they're discarded.
- <strong>Third-party cookies</strong> — cookies set for domains other than the one you're actually visiting (commonly used for cross-site tracking/ads).
