variable "name" {
  type = string
}

variable "names" {
  description = "Which variables are secrets, e.g. DATABASE_URL, JWT_PRIVATE_KEY (keys of `values`)"
  type        = list(string)
}

variable "values" {
  description = "Secret value by variable name"
  type        = map(string)
  sensitive   = true
}

variable "recovery_window_days" {
  type    = number
  default = 7
}
