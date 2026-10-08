output "public_url" {
  description = "The site and API address: https://<id>.cloudfront.net"
  value       = "https://${aws_cloudfront_distribution.this.domain_name}"
}

output "distribution_id" {
  value = aws_cloudfront_distribution.this.id
}
