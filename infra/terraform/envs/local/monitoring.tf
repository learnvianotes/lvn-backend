# Monitoring on the local environment (ADR-0089, docs/runbooks/on-call.md): the API and worker send OpenTelemetry to a
# collector; Prometheus keeps the metrics 15 days and evaluates the SLO rules; Alertmanager emails alerts (to Mailpit
# here); Grafana shows the SLO dashboard at <public_url>/grafana. The sandbox uses managed services for the same.

resource "random_password" "grafana" {
  length  = 24
  special = false
}

resource "docker_container" "otel_collector" {
  name     = "${var.name}-otel-collector"
  image    = docker_image.this["otelcol"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  command  = ["--config=/etc/otelcol/config.yaml"]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["otel-collector"]
  }
  upload {
    file    = "/etc/otelcol/config.yaml"
    content = file("${path.module}/../../monitoring/otel-collector.yaml")
  }
}

resource "docker_container" "prometheus" {
  name     = "${var.name}-prometheus"
  image    = docker_image.this["prometheus"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  command  = ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.path=/prometheus", "--storage.tsdb.retention.time=15d"]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["prometheus"]
  }
  volumes {
    volume_name    = docker_volume.this["prometheus"].name
    container_path = "/prometheus"
  }
  upload {
    file    = "/etc/prometheus/prometheus.yml"
    content = file("${path.module}/../../monitoring/prometheus.yml")
  }
  upload {
    file    = "/etc/prometheus/rules.yml"
    content = file("${path.module}/../../monitoring/rules.yml")
  }
}

resource "docker_container" "alertmanager" {
  name     = "${var.name}-alertmanager"
  image    = docker_image.this["alertmanager"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  command  = ["--config.file=/etc/alertmanager/alertmanager.yml"]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["alertmanager"]
  }
  upload {
    file    = "/etc/alertmanager/alertmanager.yml"
    content = templatefile("${path.module}/../../monitoring/alertmanager.yml.tftpl", { to = var.alert_email, domain = "learnvianotes.local" })
  }
}

resource "docker_container" "grafana" {
  name     = "${var.name}-grafana"
  image    = docker_image.this["grafana"].image_id
  restart  = "unless-stopped"
  log_opts = local.log_opts
  env = [
    "GF_SERVER_ROOT_URL=${var.public_url}/grafana/",
    "GF_SERVER_SERVE_FROM_SUB_PATH=true",
    "GF_SECURITY_ADMIN_PASSWORD=${random_password.grafana.result}",
    "GF_AUTH_ANONYMOUS_ENABLED=false",
    "GF_USERS_ALLOW_SIGN_UP=false",
    "GF_ANALYTICS_REPORTING_ENABLED=false",
    "GF_ANALYTICS_CHECK_FOR_UPDATES=false",
  ]
  networks_advanced {
    name    = docker_network.this.id
    aliases = ["grafana"]
  }
  volumes {
    volume_name    = docker_volume.this["grafana"].name
    container_path = "/var/lib/grafana"
  }
  upload {
    file    = "/etc/grafana/provisioning/datasources/prometheus.yaml"
    content = file("${path.module}/../../monitoring/grafana/datasource.yaml")
  }
  upload {
    file    = "/etc/grafana/provisioning/dashboards/lvn.yaml"
    content = file("${path.module}/../../monitoring/grafana/dashboards.yaml")
  }
  upload {
    file    = "/etc/grafana/dashboards/slo.json"
    content = file("${path.module}/../../monitoring/grafana/slo.json")
  }
}

output "grafana_admin_password" {
  value     = random_password.grafana.result
  sensitive = true
}
