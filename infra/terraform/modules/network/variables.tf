variable "name" {
  description = "Prefix for every resource name, e.g. lvn-sandbox"
  type        = string
}

variable "cidr_block" {
  description = "VPC address range"
  type        = string
  default     = "10.20.0.0/16"
}

variable "nat_gateways" {
  description = "NAT gateways for private-subnet egress: 0 (tasks in public subnets, cheapest), 1 (sandbox), 2 (production)"
  type        = number
  default     = 1
  validation {
    condition     = var.nat_gateways >= 0 && var.nat_gateways <= 2
    error_message = "nat_gateways must be 0, 1 or 2."
  }
}
