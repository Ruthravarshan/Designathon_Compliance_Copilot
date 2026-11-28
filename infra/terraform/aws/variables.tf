variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "Primary AWS region."
  type        = string
  default     = "ap-south-1"
}

variable "workload_name" {
  description = "Short workload identifier."
  type        = string
  default     = "policypulse"
}

variable "image_tag" {
  description = "Container image tag in Amazon ECR for @hexa/web."
  type        = string
  default     = "0.2.0"
}

variable "app_url" {
  description = "Public HTTPS origin for PolicyPulse (no trailing slash)."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM TLS certificate attached to the HTTPS ALB listener."
  type        = string
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "policypulseadmin"
}

variable "db_password" {
  description = "PostgreSQL master password."
  type        = string
  sensitive   = true
}

variable "auth_secret" {
  description = "32-byte base64 HMAC secret for gated demo sessions."
  type        = string
  sensitive   = true
}

variable "cron_secret" {
  description = "Bearer secret protecting /api/cron/* endpoints."
  type        = string
  sensitive   = true
}

variable "token_encryption_key" {
  description = "32-byte AES-256-GCM key for OAuth token encryption."
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Server-side Gemini API key (optional)."
  type        = string
  sensitive   = true
  default     = ""
}
