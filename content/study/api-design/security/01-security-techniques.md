---
id: 9f6fff72-62b9-7d3c-81bb-5666b8b63049
key: topic:api-design/security
subject: api-design
topic: security
title: Security techniques
slug: security-techniques
order: 1
---

Security is not a feature — it's a foundation. Every production API needs all of these.

> [!NOTE] 1. Rate limiting
>
> Limit requests per user/IP/key per time window. Prevents DDoS, brute-force, API abuse. Return 429 with Retry-After.

> [!NOTE] 2. CORS
>
> Tells browsers which domains can call your API. Prevents malicious sites from making API calls using user's session.
>
> `Access-Control-Allow-Origin: https://app.yourdomain.com`<br>`// Never "*" for authenticated APIs`

> [!NOTE] 3. SQL / NoSQL injection
>
> Attacker sends malicious input executed as DB query. Still #1 on OWASP Top 10.
>
> `"SELECT * FROM users WHERE name='" + input + "'"`<br>`// VULNERABLE`<br><br>`db.query("SELECT * FROM users WHERE name=?", [input])`<br>`// SAFE — parameterized`

> [!NOTE] 4. Input validation
>
> Validate every input. Type check, length limits, format validation, allowlists. Reject early with 400 + field-level errors.

> [!NOTE] 5. CSRF
>
> Attacker tricks logged-in user's browser into making unintended API call using session cookie.
>
> `X-CSRF-Token: <random_server_issued_token>`<br>`// Or: SameSite=Strict cookie attribute`

> [!NOTE] 6. XSS
>
> Attacker injects malicious JS into your app. Runs in other users' browsers — steals cookies, tokens.
>
> <strong>Fix:</strong> Escape user input before rendering. Use CSP headers. Never `innerHTML` with user data. HttpOnly cookies.

> [!NOTE] 7. HTTPS + HSTS
>
> Always HTTPS. HSTS forces browsers to only use HTTPS — prevents downgrade attacks.
>
> `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

> [!NOTE] 8. WAF
>
> Web Application Firewall filters malicious traffic at layer 7. Blocks OWASP Top 10 patterns, suspicious IPs, bot traffic.
>
> AWS WAF · Cloudflare WAF · Azure Front Door

> [!NOTE] 9. VPN access controls
>
> For internal APIs, require requests from within VPN. Limits access to known networks. Critical for admin APIs.

# OWASP API Security Top 10

1. 1

   Broken Object Level Authorization

   API returns data for IDs it shouldn't. Check ownership on every request.

2. 2

   Broken Authentication

   Weak tokens, no expiry, credential stuffing.

3. 3

   Broken Object Property Level Auth

   Exposing internal fields, mass assignment (set isAdmin=true).

4. 4

   Unrestricted Resource Consumption

   No rate limiting, no payload size limits.

5. 5

   Broken Function Level Authorization

   Admin endpoints accessible to normal users.

6. 6

   Unrestricted Sensitive Flows

   No brute-force protection on login, OTP, password reset.

7. 7

   SSRF

   API fetches URLs from user input — attacker targets internal services.

8. 8

   Security Misconfiguration

   Debug endpoints exposed, verbose errors in prod.

9. 9

   Improper Inventory Management

   Old API versions still live, undocumented endpoints.

10. 10

    Unsafe API Consumption

    Blindly trusting third-party API data without validation.
