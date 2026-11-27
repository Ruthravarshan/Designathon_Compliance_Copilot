targetScope = 'resourceGroup'

@description('Deployment environment name.')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'prod'

@description('Primary Azure region for all resources.')
param location string = resourceGroup().location

@description('Workload prefix used in resource naming.')
@minLength(3)
@maxLength(16)
param workloadName string = 'policypulse'

@description('Container image tag for @hexa/web deployed to Azure Container Apps.')
param imageTag string = '0.2.0'

@description('Public application origin (no trailing slash).')
param appUrl string

@description('PostgreSQL administrator login name.')
param postgresAdminLogin string = 'policypulseadmin'

@secure()
@description('PostgreSQL administrator password (supplied at deploy time, never committed).')
param postgresAdminPassword string

@secure()
@description('HMAC signing key for gated demo sessions (32+ bytes base64).')
param authSecret string

@secure()
@description('Shared bearer secret protecting /api/cron/* endpoints.')
param cronSecret string

@secure()
@description('32-byte AES-256-GCM key encrypting OAuth tokens at rest.')
param tokenEncryptionKey string

@secure()
@description('Google Gemini API key (server-side only).')
param geminiApiKey string = ''

@secure()
@description('Microsoft Graph client secret for SharePoint primary storage.')
param msftGraphClientSecret string = ''

@description('Optional Microsoft Entra tenant ID for SharePoint Graph.')
param msftGraphTenantId string = ''

@description('Optional Microsoft Graph client ID for SharePoint Graph.')
param msftGraphClientId string = ''

@description('Optional comma-separated regulatory ingestion source URLs.')
param ingestionSourceUrls string = ''

@description('Enable zone-redundant HA for PostgreSQL Flexible Server in production.')
param enableHighAvailability bool = environment == 'prod'

@description('Minimum replica count for the web Container App.')
@minValue(1)
@maxValue(10)
param minReplicas int = environment == 'prod' ? 2 : 1

@description('Maximum replica count for the web Container App.')
@minValue(2)
@maxValue(30)
param maxReplicas int = environment == 'prod' ? 10 : 3

var suffix = uniqueString(resourceGroup().id, workloadName, environment)
var tags = {
  workload: workloadName
  environment: environment
  managedBy: 'bicep'
  brand: 'hexaware'
}

module network 'modules/network.bicep' = {
  name: '${workloadName}-${environment}-network'
  params: {
    location: location
    workloadName: workloadName
    environment: environment
    tags: tags
  }
}

module security 'modules/security.bicep' = {
  name: '${workloadName}-${environment}-security'
  params: {
    location: location
    workloadName: workloadName
    environment: environment
    suffix: suffix
    tags: tags
    authSecret: authSecret
    cronSecret: cronSecret
    tokenEncryptionKey: tokenEncryptionKey
    geminiApiKey: geminiApiKey
    msftGraphClientSecret: msftGraphClientSecret
  }
}

module data 'modules/data.bicep' = {
  name: '${workloadName}-${environment}-data'
  params: {
    location: location
    workloadName: workloadName
    environment: environment
    suffix: suffix
    tags: tags
    postgresSubnetId: network.outputs.postgresSubnetId
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    vnetId: network.outputs.vnetId
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    enableHighAvailability: enableHighAvailability
    keyVaultName: security.outputs.keyVaultName
    identityPrincipalId: security.outputs.identityPrincipalId
  }
}

module app 'modules/app.bicep' = {
  name: '${workloadName}-${environment}-app'
  params: {
    location: location
    workloadName: workloadName
    environment: environment
    suffix: suffix
    tags: tags
    imageTag: imageTag
    appUrl: appUrl
    appSubnetId: network.outputs.appSubnetId
    identityId: security.outputs.identityId
    identityPrincipalId: security.outputs.identityPrincipalId
    keyVaultUri: security.outputs.keyVaultUri
    databaseUrlSecretUri: data.outputs.databaseUrlSecretUri
    redisUrlSecretUri: data.outputs.redisUrlSecretUri
    authSecretUri: security.outputs.authSecretUri
    cronSecretUri: security.outputs.cronSecretUri
    tokenEncryptionKeyUri: security.outputs.tokenEncryptionKeyUri
    geminiApiKeyUri: security.outputs.geminiApiKeyUri
    msftGraphClientSecretUri: security.outputs.msftGraphClientSecretUri
    msftGraphTenantId: msftGraphTenantId
    msftGraphClientId: msftGraphClientId
    ingestionSourceUrls: ingestionSourceUrls
    storageAccountName: data.outputs.storageAccountName
    minReplicas: minReplicas
    maxReplicas: maxReplicas
  }
}

output containerAppFqdn string = app.outputs.fqdn
output containerRegistryLoginServer string = app.outputs.acrLoginServer
output keyVaultUri string = security.outputs.keyVaultUri
output postgresHost string = data.outputs.postgresFqdn
output storageAccountName string = data.outputs.storageAccountName
output logAnalyticsWorkspaceId string = app.outputs.logAnalyticsWorkspaceId
