---
id: 57a37de9-9051-7861-9dd1-815787f7edfa
key: topic:api-design/openapi
subject: api-design
topic: openapi
title: OpenAPI / Swagger
slug: openapi-swagger
order: 1
---

OpenAPI is the standard machine-readable contract for REST APIs. Write once — generate docs, SDKs, mock servers, and test suites automatically.

> [!INFO]
>
> <strong>OpenAPI Specification (OAS)</strong> is a language-agnostic interface description for REST APIs in JSON or YAML. Swagger is the tooling ecosystem.

# Minimal OpenAPI spec

```
openapi: "3.1.0"
info:
  title: Product API
  version: "1.0.0"

paths:
  /products/{id}:
    get:
      summary: Get a product by ID
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        "200": { description: Product found }
        "404": { description: Not found }
```

# What you get from an OpenAPI spec

> [!NOTE] Interactive docs
>
> Swagger UI / ReDoc auto-generated. Consumers try endpoints from browser.

> [!NOTE] SDK generation
>
> Type-safe client SDKs in 40+ languages. OpenAPI Generator.

> [!NOTE] Mock servers
>
> Frontend teams build against mocks before backend is built. Prism, Stoplight.

> [!NOTE] Contract testing
>
> Validate implementation matches spec on every commit. Dredd, Schemathesis.

> [!NOTE] Linting
>
> Spectral enforces design standards. Run in CI.

> [!NOTE] API portal
>
> Host developer portal from spec. Readme.io, Stoplight.

> [!NOTE]
>
> <strong>Design-first workflow:</strong> Write OpenAPI spec → review → generate mock → build frontend against mock → build backend → run contract tests → ship.
