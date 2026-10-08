# The apps' secrets (§7.2, §16.1: injected as ECS task secrets from AWS Secrets Manager). Terraform writes the values it
# generates (database and Redis URLs, the JWT key pair, the code HMAC secret), so nothing is entered by hand. The values
# are also in the Terraform state, which lives in an encrypted, private bucket.

resource "aws_secretsmanager_secret" "this" {
  for_each                = toset(var.names)
  name                    = "${var.name}/${each.value}"
  recovery_window_in_days = var.recovery_window_days
}

resource "aws_secretsmanager_secret_version" "this" {
  for_each      = toset(var.names)
  secret_id     = aws_secretsmanager_secret.this[each.value].id
  secret_string = var.values[each.value]
}
