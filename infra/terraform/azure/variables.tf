variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, or prod."
  }
}

variable "location" {
  description = "Azure region for all PolicyPulse resources."
  type        = string
  default     = "centralindia"
}

variable "workload_name" {
  description = "Short workload identifier used for naming."
  type        = string
  default     = "policypulse"
}

variable "image_tag" {
  description = "Container image tag pushed to ACR for @hexa/web."
  type        = string
  default     = "0.2.0"
}

variable "app_url" {
  description = "Public HTTPS origin for the deployed application (no trailing slash)."
  type        = string
}

variable "postgres_admin_login" {
  description = "PostgreSQL Flexible Server administrator username."
  type        = string
  default     = "policypulseadmin"
}

variable "postgres_admin_password" {
  description = "PostgreSQL Flexible Server administrator password."
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
  description = "32-byte AES-256-GCM key for OAuth token encryption at rest."
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Server-side Gemini API key (optional)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "ingestion_source_urls" {
  description = "Comma-separated public regulatory listing/PDF URLs."
  type        = string
  default     = ""
}
