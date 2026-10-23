---
id: 864cefa7-1942-7af4-aeae-46b428892ef5
key: topic:cryptography/ch8
subject: cryptography
topic: ch8
title: Certificates & PKI
slug: certificates-pki
order: 1
---

Managing trust, X.509 certificate formats, certificate chains, and revocation validation.

# 1. X.509 Certificate Fields

> [!INFO]
>
> A digital certificate is a cryptographically signed document that binds a public key to an entity's identity (e.g. a domain name). Standardized under the <strong>X.509</strong> format, it contains:
>
> - <strong>Subject:</strong> The entity owning the public key (e.g., Common Name: `c-note.io`).
> - <strong>Issuer:</strong> The Certificate Authority (CA) that validated the entity and signed the certificate.
> - <strong>Public Key:</strong> The entity's public key (RSA or ECC coordinates).
> - <strong>Signature Algorithm:</strong> The algorithm used to sign the certificate (e.g. `sha256WithRSAEncryption`).
> - <strong>Validity Period:</strong> The start and end dates for the certificate.
> - <strong>CA Signature:</strong> The cryptographic signature of the Issuer CA, generated using the CA's private key.

# 2. The Certificate Chain of Trust

How browsers trust certificates by tracing them back to built-in Root CAs.

```
+------------------------+
|   Root CA Certificate  | -> Built into browser/OS trust store. Self-signed.
+------------------------+
           | Signs
+------------------------+
| Intermediate CA Cert   | -> Signed by Root. Used to sign leaf certs to protect root.
+------------------------+
           | Signs
+------------------------+
|   Leaf Certificate     | -> Installed on the web server (e.g., c-note.io).
+------------------------+
```

# 3. Certificate Revocation: CRL vs. OCSP

> [!TIP] CRL (Certificate Revocation List)
>
> - The CA publishes a signed list of revoked certificate serial numbers.
> - Clients download the entire list periodically to verify certificate status.
> - <strong>Drawbacks:</strong> High bandwidth usage, latency, and lists can become stale.

> [!DANGER] OCSP (Online Certificate Status Protocol)
>
> - Clients query the CA's server directly to verify a certificate's status.
> - <strong>OCSP Stapling:</strong> The web server queries the CA's status periodically, signs the response, and sends ("staples") it to the client during the TLS handshake, reducing latency and protecting privacy.
