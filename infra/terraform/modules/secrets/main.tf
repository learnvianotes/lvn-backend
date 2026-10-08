# Secret containers the ECS tasks read (§7.2, §16.1: secrets from AWS Secrets Manager, injected as ECS task secrets).
# Terraform creates the names only; operators put the values in with the console or the CLI, so no secret value is
# ever in Terraform state or in this repository.

resource "aws_secretsmanager_secret" "this" {
  for_each                = toset(var.names)
  name                    = "${var.name}/${each.value}"
  recovery_window_in_days = var.recovery_window_days
}
