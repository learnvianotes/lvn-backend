# Infrastructure (Terraform): the local environment

Beta and production run on Lightsail with Docker Compose (ADR-0096): `infra/lightsail/` and
`docs/runbooks/lightsail.md`. Terraform remains for the local environment only, the lab on a VM on this machine
(ADR-0036). The AWS modules, the sandbox and emulated roots and the state bootstrap were retired with ADR-0096; they
are in git history at `c568538`.

```text
envs/local     the local environment's root module; settings in envs/local/.env (template .env.example)
monitoring     Prometheus, Alertmanager, Grafana and the OpenTelemetry collector's settings (ADR-0089)
run.sh, lib.sh wrappers that load envs/local/.env and keep the state in the VM
../scripts/deploy-local.sh   images → VM, terraform apply in the VM: services, buckets, migration, apps; fails unless ready
../local-vm/vm.sh            the local environment's VM
```

## The local environment

ADR-0036. The sandbox's shape — the same images, generated secrets, a migration step, one entrance for web and API —
on a Debian VM on this machine, with Terraform and Docker inside the VM and the state kept there. It needs QEMU with
KVM (`/dev/kvm`), Docker, `curl`, `xz`, `rsync` and `python3`; nothing else is installed on the host.

```bash
cp infra/terraform/envs/local/.env.example infra/terraform/envs/local/.env   # add the Tailscale address, Firebase values
infra/local-vm/vm.sh up                      # first run: downloads Debian 13, installs Docker and Terraform (~3 min)
infra/scripts/deploy-local.sh                # images → VM, terraform apply in the VM: services, buckets, migration, apps
pnpm smoke http://127.0.0.1:8080 --mailpit http://127.0.0.1:8025
```

| What | Where |
| --- | --- |
| Web, and the API at `/graphql` | `TF_VAR_public_url` (port 8080 on each `LVN_VM_PUBLISH_ADDRESSES`) |
| S3 endpoint of pre-signed URLs | `TF_VAR_s3_public_url` (port 8081) |
| Every email sent | Mailpit, `http://127.0.0.1:8025` |
| A shell in the VM | `infra/local-vm/vm.sh ssh` (then `docker ps`, `docker logs lvn-local-api`) |
| Terraform by hand | `infra/local-vm/vm.sh ssh 'cd lvn/infra/terraform && ./run.sh local plan'` |

`vm.sh stop` shuts the VM down and `vm.sh up` starts it again with everything in place; `vm.sh destroy` deletes its
disk. The web build bakes in `TF_VAR_public_url`, so deploy again after changing it. Phones use the development build
pointed at that URL (it allows plain HTTP); for Google sign-in on the web, add its host to Firebase's authorized domains.
