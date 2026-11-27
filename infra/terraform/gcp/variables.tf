variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "Primary GCP region (e.g. asia-south1)."
  type        = string
  default     = "asia-south1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, or prod."
  }
}

variable "workload_name" {
  description = "Short workload identifier."
  type        = string
  default     = "policypulse"
}

variable "image_tag" {
  description = "Artifact Registry container tag for @hexa/web."
  type        = string
  default     = "0.2.0"
}

variable "app_url" {
  description = "Public HTTPS origin for PolicyPulse (no trailing slash)."
  type        = string
}

variable "db_password" {
  description = "Cloud SQL PostgreSQL password."
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
