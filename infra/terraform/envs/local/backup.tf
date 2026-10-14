# The nightly backup (ADR-0089, docs/runbooks/restore.md): backup.sh at 02:30 UTC from a systemd timer of the VM's
# user (Debian's cloud image has no cron), kept running while nobody is signed in (linger). Terraform runs in the VM,
# so this writes the units there; the script is the copy deploy-local.sh keeps in ~/lvn/infra/terraform.
resource "terraform_data" "backup_timer" {
  triggers_replace = [filesha256("${path.module}/backup.sh"), var.name]
  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-EOT
      set -euo pipefail
      units=$HOME/.config/systemd/user
      mkdir -p "$units"
      cat > "$units/lvn-backup.service" <<UNIT
      [Unit]
      Description=LearnViaNotes local environment backup (ADR-0089)
      [Service]
      Type=oneshot
      Environment=LVN_NAME=${var.name}
      ExecStart=/bin/bash %h/lvn/infra/terraform/envs/local/backup.sh
      StandardOutput=append:%h/lvn-backup.log
      StandardError=append:%h/lvn-backup.log
      UNIT
      cat > "$units/lvn-backup.timer" <<UNIT
      [Unit]
      Description=LearnViaNotes nightly backup, 02:30 UTC
      [Timer]
      OnCalendar=*-*-* 02:30:00 UTC
      Persistent=true
      [Install]
      WantedBy=timers.target
      UNIT
      sudo -n loginctl enable-linger "$USER"
      systemctl --user daemon-reload
      systemctl --user enable --now lvn-backup.timer
    EOT
  }
}
