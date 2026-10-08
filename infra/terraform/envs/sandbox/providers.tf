terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  # State in the sandbox account's S3 bucket with native locking; the bucket is created once by hand (README).
  # `terraform init -backend-config=backend.hcl` supplies bucket, key and region.
  backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = "learnvianotes", Environment = "sandbox", ManagedBy = "terraform" }
  }
}
