terraform {
  required_version = ">= 1.9"
  required_providers {
    docker = { source = "kreuzwerker/docker", version = "~> 4.6" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
    tls    = { source = "hashicorp/tls", version = "~> 4.0" }
  }
  # State stays in the VM, at the path run.sh passes: this environment has no state bucket (ADR-0036).
  backend "local" {}
}

# The VM's Docker engine: Terraform runs inside the VM (infra/scripts/deploy-local.sh).
provider "docker" {}
