# ADR-0066: An AWS stand-in VM for the sandbox's Terraform

- Status: Accepted (owner direction, 2026-10-13: "for teraform create a VM in the aosp that you can use for now")
- Date: 2026-10-13
- Deciders: owner; Backend agent
- Spec sections: §16.1 (Environments), §16.2 (Deployment), §18
- Builds on: ADR-0035 (the sandbox from one `.env`), ADR-0036 (the local environment on a VM)

## Context

The sandbox's Terraform (`envs/sandbox` and the modules network, data, storage, secrets, mail, service and edge) has
never been applied: there is no AWS account yet. CI checks only `fmt` and `validate`. Those catch syntax and type
errors, not what AWS's API says about the requests.

The local environment (ADR-0036) runs the apps, but its Terraform is a different root module (the Docker provider).
So none of the AWS modules are exercised before the first real `apply`.

The owner asked for a VM on this machine, with its files on the `/mnt/aosp` disk, to use for Terraform until there
is an account.

## Decision

1. **An emulated AWS account: Moto.**
   - Moto (`motoserver/moto`, Apache-2.0) runs in Docker in its own small VM.
   - It is pinned by version and digest in `.env`.
   - It needs no account and no token. (LocalStack's image now needs a sign-in, so it is not used.)
   - Moto keeps everything in memory, so a VM that stops forgets the emulated account.
2. **The same VM tooling.**
   - `infra/local-vm/vm.sh` takes `LVN_VM_ENV=<env>` and reads `envs/<env>/.env`.
   - The local environment's behaviour is unchanged.
   - The stand-in is `emulated`: 2 CPUs, 3 GB of memory, a 20 GB disk, SSH on 2223.
   - Moto is forwarded to `127.0.0.1:4566` on this machine only.
   - On this machine its files are in `/mnt/aosp/storage/lvn-aws-vm`.
3. **The sandbox's own code, not a copy.**
   - `envs/emulated/.env` sets `TF_ROOT=sandbox`, so `run.sh emulated …` runs `envs/sandbox` with its own state and
     its own `.terraform-emulated` directory.
   - `AWS_ENDPOINT_URL` and test credentials point the AWS provider and the S3 backend at Moto.
   - `bootstrap.sh emulated` creates the state bucket in Moto, as it would in a new account. Locking works as on AWS
     (S3 lock files).
   - Terraform runs inside the VM, from code copied in on each command.
4. **One switch for the emulator's gaps.**
   - The variable `aws_emulator` is false by default, so real AWS is unchanged. It is true only in `envs/emulated`.
   - On real AWS it changes nothing. In the emulated env it sets:
     - path-style S3 (provider and backend);
     - in the edge module, a plain custom origin instead of a CloudFront VPC origin, and the managed cache and origin
       request policies by their fixed, documented ids instead of looked up by name;
     - in the data module, no ElastiCache at all: the apps' `REDIS_URL` gets a placeholder host.
   - The budget is left out by the existing switch (`TF_VAR_budget_alert_email` empty).
5. **One command.**
   - `infra/scripts/aws-stand-in.sh up` starts the VM and Moto, creates the state bucket when the account is new, and
     runs `init`.
   - `plan`, `apply`, `destroy`, `output` and `state` pass through to `run.sh emulated`.
   - `check` runs `fmt`, `validate`, then applies and destroys everything.
   - `reset` starts a new, empty account. `down` stops the VM.

## What Moto cannot do (the gaps)

| Piece | Why | In the emulated env |
| --- | --- | --- |
| CloudFront VPC origin (`aws_cloudfront_vpc_origin`) | Moto has no VPC origin API | custom origin to the ALB |
| CloudFront managed policies (data sources) | no ListCachePolicies / ListOriginRequestPolicies | their fixed ids |
| ElastiCache replication group | Moto creates it without member clusters; the provider fails to read it back | left out; a placeholder host in `REDIS_URL` |
| ElastiCache subnet group | no DeleteCacheSubnetGroup; `destroy` waits for ever | left out |
| (a single cache cluster instead) | Moto reports neither its nodes nor its security groups, cannot modify it, and keeps it "deleting" for ever | not used |
| AWS Budgets | no DescribeSubscribersForNotification; the provider retries for ever | no budget |
| S3 Control (bucket tags) | the SDK puts the account id in the host name | the VM resolves `123456789012.localhost` to itself |
| AWS managed IAM policies | Moto loads them only when asked | `MOTO_IAM_LOAD_MANAGED_POLICIES=true` |
| Reading some attributes back | Moto answers with defaults: RDS Performance Insights off, a parameter group without its parameters, CloudFront's legacy `forwarded_values`, SES identity tags; the IAM and bucket policies built from them follow | a plan right after an apply is not empty (9 changes); they are the emulator's, not drift |

## Consequences

- **Every other resource of the sandbox is applied and destroyed against an AWS API before there is an account.**
  That is 92 resources: VPC, subnets, NAT and routes; security groups and rules; RDS and its groups; S3 with versioning,
  encryption, CORS, lifecycle and policies; KMS; Secrets Manager; SES identity; ECR; ECS cluster, task definitions and
  services; ALB, listener and rules; IAM; SSM; logs; CloudFront.
  - It catches wrong arguments, missing references and ordering errors.
  - It does not show that AWS accepts every value (Moto validates less), that IAM policies allow what the apps do, or
    that the services run: Moto starts nothing.
- **The pieces the switch leaves out are checked only on real AWS:** the VPC origin, the managed policy lookups, the
  ElastiCache subnet and replication groups, and the budget. The first sandbox apply should watch them.
- **A plan that settles to "no changes" after an apply is checked only on AWS.** On Moto it shows the read-back
  differences in the table above.
- The emulated account and its state live and die together with Moto. `up` notices a new account and bootstraps again.
- The VM uses 3 GB of memory while it runs. `down` stops it.
- When the AWS account exists, the sandbox runs as before (`run.sh sandbox …`). This env stays for trying changes to
  the modules first.
