# Creates the bucket that holds an environment's Terraform state — once per AWS account, before anything else
# (bootstrap.sh). Its own state is local and small; losing it only means importing the bucket again.

terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

variable "region" {
  type = string
}

variable "bucket" {
  type = string
}

variable "aws_emulator" {
  description = "true only for the AWS stand-in (ADR-0066): an AWS emulator (Moto) at AWS_ENDPOINT_URL instead of AWS"
  type        = bool
  default     = false
}

provider "aws" {
  region            = var.region
  s3_use_path_style = var.aws_emulator
}

resource "aws_s3_bucket" "state" {
  bucket = var.bucket
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# The state holds generated secrets (database password, JWT key): encrypted, private, owner-only.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

output "bucket" {
  value = aws_s3_bucket.state.id
}
