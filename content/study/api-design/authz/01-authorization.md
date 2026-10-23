---
id: 5efa767d-b0bc-7e6a-9e4c-d2d308e6909b
key: topic:api-design/authz
subject: api-design
topic: authz
title: Authorization
slug: authorization
order: 1
---

Authorization answers: "What can you do?" It comes after authentication.

> [!INFO]
>
> <strong>Authorization</strong> = what actions is this authenticated user allowed to perform? Three main models — each with different trade-offs.

### RBAC

> [!INFO]
>
> <strong>RBAC — Role-Based Access Control.</strong> Assign users to roles. Roles have permissions. Simple and scalable.

> [!NOTE] Admin
>
> Full access. Read, write, delete, manage users, configure system.

> [!NOTE] Editor
>
> Create and edit content. Cannot delete. Cannot manage users.

> [!NOTE] Viewer
>
> Read-only. Cannot modify anything.

GitHub teams · CMS tools · Slack workspaces

> [!NOTE]
>
> <strong>Principle of least privilege:</strong> Grant only minimum permissions needed. Audit and remove unused permissions regularly.

### ABAC

> [!INFO]
>
> <strong>ABAC — Attribute-Based Access Control.</strong> Decisions based on attributes of user, resource, and environment. More flexible than RBAC. More complex.

```
Example policy:
user.department == "HR"
&& time < 18:00
&& resource.confidentiality == "internal"
```

Healthcare · Financial services · Government · AWS IAM policies

### ACL

> [!INFO]
>
> <strong>ACL — Access Control List.</strong> Each resource has its own explicit list. Maximum granularity.

> [!NOTE] Per-file permissions (Google Drive model)
>
> 1. AliceOwner — Read + Write + Share + Delete
> 2. BobEditor — Read + Write
> 3. CarolNo access

> [!WARNING]
>
> Granular but hard to scale. Need indexing strategies. Good for user-facing sharing features.

### OAuth2 scopes

> [!INFO]
>
> <strong>OAuth2 scopes.</strong> Third-party app requests specific permissions. You approve scopes — not full account access.

```
GitHub OAuth scopes:
scope: "read:repo"   // read repos
scope: "write:repo"  // push code
// NOT granted: delete:repo
```

> [!NOTE]
>
> <strong>Key:</strong> Access token = approved permissions, not a password. If app is compromised, revoke the token — not your whole account.
