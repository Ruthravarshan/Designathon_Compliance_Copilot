output "cloud_run_uri" {
  description = "Cloud Run service URL."
  value       = google_cloud_run_v2_service.web.uri
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository path."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.web.repository_id}"
}

output "cloud_sql_private_ip" {
  description = "Private IP address of Cloud SQL PostgreSQL 16."
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "evidence_bucket" {
  description = "GCS bucket for archived compliance circulars."
  value       = google_storage_bucket.evidence.name
}
