# Object storage (§8, ADR-0032): the files bucket for uploads and the restricted bucket for identity documents
# (ADR-0019) with its own KMS key, so access to documents can be granted and audited separately. Both private,
# versioned, encrypted, owner-enforced; browsers upload with pre-signed PUTs from the web origin only.

resource "aws_kms_key" "restricted" {
  description             = "${var.name}: identity documents (ADR-0019)"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_kms_alias" "restricted" {
  name          = "alias/${var.name}-restricted"
  target_key_id = aws_kms_key.restricted.key_id
}

locals {
  buckets = {
    files      = { name = "${var.name}-files", kms = null }
    restricted = { name = "${var.name}-restricted", kms = aws_kms_key.restricted.arn }
  }
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets
  bucket   = each.value.name
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each                = aws_s3_bucket.this
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = local.buckets
  bucket   = aws_s3_bucket.this[each.key].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = each.value.kms == null ? "AES256" : "aws:kms"
      kms_master_key_id = each.value.kms
    }
    bucket_key_enabled = each.value.kms != null
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
  rule {
    # Deleted objects (the app deletes decided identity documents after 30 days) do not linger as old versions.
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = each.key == "restricted" ? 1 : 30
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = var.web_origins
    # range: the PDF reader (ADR-0040) loads large PDFs piece by piece and reads where each piece sits.
    allowed_headers = ["content-type", "content-length", "range", "x-amz-*"]
    expose_headers  = ["accept-ranges", "content-range", "content-length", "etag"]
    max_age_seconds = 600
  }
}

data "aws_iam_policy_document" "tls_only" {
  for_each = aws_s3_bucket.this
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    resources = [each.value.arn, "${each.value.arn}/*"]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id
  policy   = data.aws_iam_policy_document.tls_only[each.key].json
}
