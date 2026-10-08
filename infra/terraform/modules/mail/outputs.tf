output "send_policy_json" {
  description = "IAM policy allowing the apps to send as the sender identity"
  value       = data.aws_iam_policy_document.send.json
}

output "identity_arn" {
  value = aws_sesv2_email_identity.sender.arn
}
