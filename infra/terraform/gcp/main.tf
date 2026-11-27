resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

locals {
  name_prefix = "${var.workload_name}-${var.environment}"
  labels = {
    workload    = var.workload_name
    environment = var.environment
    managed_by  = "terraform"
    brand       = "hexaware"
  }
}

# -----------------------------------------------------------------------------
# Networking (VPC, Private Service Access for Cloud SQL, VPC Connector)
# -----------------------------------------------------------------------------

resource "google_compute_network" "main" {
  name                    = "vpc-${local.name_prefix}"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "app" {
  name                     = "snet-${local.name_prefix}-app"
  ip_cidr_range            = "10.50.0.0/24"
  region                   = var.region
  network                  = google_compute_network.main.id
  private_ip_google_access = true
}

resource "google_compute_global_address" "private_ip" {
  name          = "psa-${local.name_prefix}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip.name]
}

resource "google_vpc_access_connector" "serverless" {
  name          = substr("conn-${local.name_prefix}", 0, 25)
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.50.8.0/28"
}

# -----------------------------------------------------------------------------
# Service Account, Artifact Registry, GCS Evidence Bucket, Secret Manager
# -----------------------------------------------------------------------------

resource "google_service_account" "runtime" {
  account_id   = substr("sa-${local.name_prefix}", 0, 28)
  display_name = "PolicyPulse Cloud Run Runtime Service Account"
}

resource "google_artifact_registry_repository" "web" {
  location      = var.region
  repository_id = "${local.name_prefix}-web"
  description   = "Container images for @hexa/web"
  format        = "DOCKER"
  labels        = local.labels
}

resource "google_storage_bucket" "evidence" {
  name                        = "${var.project_id}-${local.name_prefix}-evidence-${random_string.suffix.result}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  labels                      = local.labels

  versioning {
    enabled = true
  }
}

resource "google_storage_bucket_iam_member" "runtime_storage" {
  bucket = google_storage_bucket.evidence.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime.email}"
}

locals {
  secret_payloads = {
    "database-url"         = "postgresql://policypulseadmin:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/policypulse?sslmode=require"
    "redis-url"            = "rediss://:${google_redis_instance.cache.auth_string}@${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
    "auth-secret"          = var.auth_secret
    "cron-secret"          = var.cron_secret
    "token-encryption-key" = var.token_encryption_key
    "gemini-api-key"       = var.gemini_api_key
  }
}

resource "google_secret_manager_secret" "runtime" {
  for_each  = local.secret_payloads
  secret_id = "${local.name_prefix}-${each.key}"
  labels    = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "runtime" {
  for_each    = local.secret_payloads
  secret      = google_secret_manager_secret.runtime[each.key].id
  secret_data = each.value
}

resource "google_secret_manager_secret_iam_member" "runtime_access" {
  for_each  = google_secret_manager_secret.runtime
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# -----------------------------------------------------------------------------
# Cloud SQL PostgreSQL 16 & Memorystore Redis 7
# -----------------------------------------------------------------------------

resource "google_sql_database_instance" "postgres" {
  name                = "sql-${local.name_prefix}-${random_string.suffix.result}"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = var.environment == "prod"

  settings {
    tier              = var.environment == "prod" ? "db-custom-2-4096" : "db-f1-micro"
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = var.environment == "prod"
      transaction_log_retention_days = 7
    }
  }

  depends_on = [google_service_networking_connection.private_vpc]
}

resource "google_sql_database" "app" {
  name     = "policypulse"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "admin" {
  name     = "policypulseadmin"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

resource "google_redis_instance" "cache" {
  name                    = "redis-${local.name_prefix}"
  region                  = var.region
  tier                    = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  memory_size_gb          = 1
  redis_version           = "REDIS_7_2"
  authorized_network      = google_compute_network.main.id
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  labels                  = local.labels
}

# -----------------------------------------------------------------------------
# Cloud Run v2 Service & Cloud Scheduler Cron Jobs
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "web" {
  name     = "${local.name_prefix}-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = local.labels

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.environment == "prod" ? 1 : 0
      max_instance_count = var.environment == "prod" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.serverless.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.web.repository_id}/hexa-web:${var.image_tag}"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.environment == "prod" ? "2" : "1"
          memory = var.environment == "prod" ? "2Gi" : "1Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "APP_URL"
        value = var.app_url
      }
      env {
        name  = "APP_VERSION"
        value = var.image_tag
      }
      env {
        name  = "TRUST_PROXY_HEADERS"
        value = "true"
      }
      env {
        name  = "DATABASE_POOL_MAX"
        value = "3"
      }
      env {
        name  = "GCS_EVIDENCE_BUCKET"
        value = google_storage_bucket.evidence.name
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["database-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DIRECT_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["database-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["redis-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["auth-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "CRON_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["cron-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "TOKEN_ENCRYPTION_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["token-encryption-key"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["gemini-api-key"].secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        initial_delay_seconds = 10
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  depends_on = [google_secret_manager_secret_iam_member.runtime_access]
}

resource "google_cloud_scheduler_job" "email_drain" {
  name      = "${local.name_prefix}-email-drain"
  region    = var.region
  schedule  = "*/5 * * * *"
  time_zone = "UTC"

  http_target {
    http_method = "GET"
    uri         = "${google_cloud_run_v2_service.web.uri}/api/cron/email"
    headers = {
      Authorization = "Bearer ${var.cron_secret}"
    }
  }
}

resource "google_cloud_scheduler_job" "regulatory_watch" {
  name      = "${local.name_prefix}-regulatory-watch"
  region    = var.region
  schedule  = "0 4 * * 1"
  time_zone = "UTC"

  http_target {
    http_method = "GET"
    uri         = "${google_cloud_run_v2_service.web.uri}/api/cron/watch"
    headers = {
      Authorization = "Bearer ${var.cron_secret}"
    }
  }
}
