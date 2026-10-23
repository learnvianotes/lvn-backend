---
id: d48c70b6-cd3f-7dff-8ef1-ef095b425d87
key: topic:system-design/security
subject: system-design
topic: security
title: System Security & Auth
slug: system-security-auth
order: 1
---

Comprehensive reference for OAuth2, OIDC, JWT signatures, refresh token rotation, web vulnerabilities (CSRF, CORS, XSS, SQLi), encryption, and RBAC/ABAC models.

# OAuth 2.0 &amp; OpenID Connect (OIDC)

> [!NOTE] Auth Code Flow with PKCE
>
> Standard for Single Page Apps &amp; Mobile. Client generates <strong>Code Verifier</strong> and <strong>Code Challenge</strong>. Prevents authorization code interception attacks without requiring client secret storage in browser.

> [!NOTE] OIDC (Identity Layer)
>
> Built on top of OAuth 2.0. OAuth handles <em>Authorization</em> (Access Tokens); OIDC handles <em>Authentication</em> (ID Tokens containing user profile claims like `sub`, `email`).

# JWT &amp; Refresh Token Mechanics

> [!INFO]
>
> <strong>JWT Structure:</strong> `Header.Payload.Signature`<br> • <strong>HS256:</strong> Symmetric key (shared secret between auth server &amp; service).<br> • <strong>RS256:</strong> Asymmetric RSA key pair (Auth server signs with Private key, microservices verify with Public key).<br> • <strong>Refresh Token Rotation:</strong> Issuing a new refresh token with every refresh request. If an old refresh token is reused, system triggers security revoking ALL tokens for user.

# Web Security Defenses

# Vulnerability &amp; Defense Matrix

| Vulnerability | Attack Mechanism | Primary Defense |
| --- | --- | --- |
| <strong>CSRF</strong> | Unauthorized commands submitted from trusted user browser | Anti-CSRF tokens, `SameSite=Strict/Lax` cookies |
| <strong>CORS</strong> | Unauthorized cross-origin API requests | Configure `Access-Control-Allow-Origin` headers |
| <strong>XSS</strong> | Malicious JavaScript execution in victim browser | Content Security Policy (CSP), Contextual output escaping |
| <strong>SQL Injection</strong> | Injecting SQL syntax via untrusted user inputs | Parameterized queries, Prepared statements, ORMs |

# Encryption: At Rest &amp; In Transit

> [!NOTE] Encryption at Rest (KMS)
>
> Envelope Encryption: Data encrypted with Data Encryption Key (DEK); DEK encrypted with Master Key (KEK) managed in Hardware Security Modules (AWS KMS).

> [!NOTE] Encryption in Transit (mTLS)
>
> TLS 1.3 for external traffic. Mutual TLS (mTLS) inside Service Mesh: both client and server microservices authenticate each other's X.509 certificates.
