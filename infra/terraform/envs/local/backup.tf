# The nightly backup (ADR-0089, docs/runbooks/restore.md): backup.sh at 02:30 UTC from the VM's crontab. Terraform runs
# in the VM, so this installs the line there; the script is the copy deploy-local.sh keeps in ~/lvn/infra/terraform.
resource "terraform_data" "backup_cron" {
  triggers_replace = [filesha256("${path.module}/backup.sh")]
  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      line="30 2 * * * LVN_NAME=${var.name} bash $HOME/lvn/infra/terraform/envs/local/backup.sh >> $HOME/lvn-backup.log 2>&1"
      { crontab -l 2>/dev/null | grep -v 'envs/local/backup.sh' || true; echo "$line"; } | crontab -
    EOT
  }
}
