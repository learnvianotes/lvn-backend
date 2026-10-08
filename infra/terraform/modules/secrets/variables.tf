variable "name" {
  type = string
}

variable "names" {
  description = "Variable names held as secrets, e.g. DATABASE_URL, JWT_PRIVATE_KEY"
  type        = list(string)
}

variable "recovery_window_days" {
  type    = number
  default = 7
}
