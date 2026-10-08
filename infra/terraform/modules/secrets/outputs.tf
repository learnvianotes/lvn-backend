output "arns" {
  description = "Secret ARN by variable name"
  value       = { for k, s in aws_secretsmanager_secret.this : k => s.arn }
}
