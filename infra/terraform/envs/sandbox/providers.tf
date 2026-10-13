terraform {
  required_version = ">= 1.9"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
    tls    = { source = "hashicorp/tls", version = "~> 4.0" }
  }
  # State in the bucket bootstrap.sh creates, with S3-native locking. run.sh fills in bucket, key and region from .env.
  backend "s3" {}
}

provider "aws" {
  region = var.region
  # The AWS stand-in (ADR-0066): an emulator at AWS_ENDPOINT_URL serves buckets by path, not by host name.
  s3_use_path_style = var.aws_emulator
  default_tags {
    tags = { Project = "learnvianotes", Environment = var.environment, ManagedBy = "terraform" }
  }
}
