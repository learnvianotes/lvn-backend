output "files_bucket" {
  value = aws_s3_bucket.this["files"].id
}

output "restricted_bucket" {
  value = aws_s3_bucket.this["restricted"].id
}

output "bucket_arns" {
  value = { for k, b in aws_s3_bucket.this : k => b.arn }
}

output "restricted_kms_key_arn" {
  value = aws_kms_key.restricted.arn
}
