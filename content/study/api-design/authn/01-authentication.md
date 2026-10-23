---
id: 2082b048-6a06-7db4-81b9-ef446f66b05a
key: topic:api-design/authn
subject: api-design
topic: authn
title: Authentication
slug: authentication
order: 1
---

Authentication answers: "Who are you?" It's the first gate before authorization.

> [!INFO]
>
> <strong>Authentication</strong> = verifying identity. Happens before authorization. Login → system confirms identity → authorization decides what they can do.

### Basic auth

> [!NOTE] Basic authentication
>
> Username + password Base64-encoded in Authorization header on every request. Base64 is NOT encryption. Requires HTTPS.

```
Authorization: Basic dXNlcjpwYXNzd29yZA==
// = base64("user:password")
```

> [!WARNING]
>
> Rarely used today. Credentials sent with every request. No token expiry.

### Bearer token

> [!NOTE] Bearer token
>
> Client receives token at login. Sends it with every request. Stateless — server doesn't look up sessions.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

> [!NOTE]
>
> <strong>Standard approach today.</strong> Tokens expire. Can be revoked. Work across microservices without shared session state.

### OAuth2 + JWT

> [!NOTE] OAuth2 + JWT
>
> <strong>OAuth2</strong> grants apps access without sharing your password. <strong>JWT</strong> is self-contained, signed, stateless. Header.Payload.Signature.

```
JWT payload:
{ "user_id": "123", "roles": ["admin"], "exp": 1720000000 }
```

> [!NOTE] Access token
>
> Short-lived (15–60 min). For API calls. If stolen, expires quickly.

> [!NOTE] Refresh token
>
> Long-lived (days/weeks). Gets new access tokens. Rotate on each use.

> [!WARNING]
>
> <strong>JWT caveat:</strong> Can't be invalidated before expiry without a blocklist. Keep access tokens short-lived.

### SSO

> [!NOTE] SSO — Single Sign-On
>
> Login once, access many apps. Reduces password fatigue and attack surface.

> [!NOTE] SAML 2.0
>
> Enterprise SSO. XML-based. Okta, Azure AD. Older but dominant in enterprise.

> [!NOTE] OpenID Connect (OIDC)
>
> Modern SSO. "Login with Google/GitHub." JSON-based, built on OAuth2. Provides ID token (who) + access token (what).

### API keys

> [!NOTE] API keys
>
> Long-lived secret tokens. Server-to-server communication. Easier than OAuth2 for simple cases.

```
X-API-Key: sk_live_abc123xyz...
```

> [!TIP]
>
> <strong>Good for:</strong> Server-to-server. CI/CD pipelines. Long-running integrations.

> [!WARNING]
>
> <strong>Risks:</strong> Harder to rotate. If leaked — full access until revoked. Scope them (read-only, write-only).

### mTLS

> [!NOTE] mTLS — Mutual TLS
>
> Both client AND server authenticate with certificates. Zero-trust architecture. No passwords, no tokens — cryptographic identity only.

```
// Regular TLS: only server has cert
// mTLS: both have certs (mutual authentication)

Client → presents client cert → server validates
Server → presents server cert → client validates
→ Encrypted, mutually authenticated
```

> [!NOTE]
>
> <strong>Use for:</strong> Internal microservice calls. Zero-trust networks. Service mesh (Istio, Linkerd). Compliance (PCI-DSS, HIPAA).
