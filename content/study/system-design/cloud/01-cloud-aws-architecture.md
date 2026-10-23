---
id: 29cfdf00-d08a-76e0-8c21-14cc0d6a2f9d
key: topic:system-design/cloud
subject: system-design
topic: cloud
title: Cloud / AWS Architecture
slug: cloud-aws-architecture
order: 1
---

In-depth guide to EC2, S3, Lambda, CloudFront, RDS, DynamoDB, SQS/SNS fanout, ALB, ECS/EKS, IAM, and VPC design.

# Compute &amp; Storage Foundations

> [!NOTE] Amazon EC2 & ASG
>
> On-Demand, Reserved, Spot instances. Auto Scaling Groups (ASG) automatically adjust instance count based on CPU/Memory/Request metrics behind Load Balancers.

> [!NOTE] AWS Lambda (Serverless)
>
> Event-driven compute. Cold starts mitigated by Provisioned Concurrency. Execution limited to 15 min. Automatic scaling up to account concurrency limits.

> [!NOTE] Amazon S3
>
> Object storage (11 9s durability). Storage classes: Standard, Intelligent-Tiering, Glacier. Supports Multipart Uploads for large files and Presigned URLs for direct secure client uploads.

> [!NOTE] CloudFront CDN
>
> Global edge distribution network. Reduces latency via edge caching, SSL termination, and edge compute (CloudFront Functions &amp; Lambda@Edge).

# Cloud Databases: RDS &amp; DynamoDB

> [!NOTE] Amazon RDS & Aurora
>
> Managed relational DB. Multi-AZ deployment provides synchronous replication to standby node with automated failover. Read Replicas provide horizontal scale for read workloads.

> [!NOTE] Amazon DynamoDB
>
> NoSQL Key-Value &amp; Document store. Single-table design using Partition Key (PK) &amp; Sort Key (SK). Global Secondary Indexes (GSI) for alternate queries. DAX in-memory cache delivers microsecond latency.

# SNS + SQS Fanout Pattern

Producer Service → SNS Topic → SQS Queue A (Order Service)

Producer Service → SNS Topic ↘ SQS Queue B (Email Service)

# VPC &amp; Security Architecture

> [!INFO]
>
> <strong>AWS VPC Layout:</strong> Divide VPC CIDR into <strong>Public Subnets</strong> (connected to Internet Gateway for ALBs &amp; NAT Gateways) and <strong>Private Subnets</strong> (isolated compute servers &amp; DB instances). Security Groups act as stateful firewalls at instance level; Network ACLs act as stateless firewalls at subnet level.
