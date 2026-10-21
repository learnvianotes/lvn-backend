# The web's optional Google Analytics property

- Date: 2026-10-21
- Package: `@lvn/contracts` 0.61.0
- Spec: ADR-0092 (§15.2)
- Breaking: no

## What changes for clients

- **`webConfigSchema`** gains an optional `NEXT_PUBLIC_GA_MEASUREMENT_ID` (`G-…`). With it set, the web asks each
  visitor whether Google Analytics may run, loads it only after "Allow", sends path-only page views, and keeps the
  choice on the device and in step across tabs. Unset, nothing changes.
- `deploy.sh` and `deploy-local.sh` pass it to the web build from `infra/terraform/envs/<env>/.env`.
- The phone is unchanged.
