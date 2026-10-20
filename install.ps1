# Windows PowerShell 5.1+ / PowerShell 7. Docker Desktop must use Linux containers.
[CmdletBinding()]
param([switch]$ConfigureOnly)
$ErrorActionPreference = 'Stop'

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed (exit $LASTEXITCODE). Setup stopped." }
}

Push-Location $PSScriptRoot
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Install Docker Desktop and start it with Linux containers, then retry.'
    }
    Invoke-Docker compose version
    Invoke-Docker info --format '{{.OSType}}'
    $osType = & docker info --format '{{.OSType}}'
    if ($osType -ne 'linux') { throw 'Switch Docker Desktop to Linux containers.' }
    $config = Join-Path $PSScriptRoot 'deploy/docker-compose.local.yml'
    if (-not (Test-Path -LiteralPath $config)) {
        & docker volume inspect autoops_postgres-data *> $null
        if ($LASTEXITCODE -eq 0) {
            throw 'Existing AutoOps database detected. Use docs/DEPLOYMENT.md; do not generate new secrets for existing data.'
        }
        Invoke-Docker build -t autoops-installer:local -f deploy/installer/Dockerfile deploy/installer
        $mount = "type=bind,source=$(Join-Path $PSScriptRoot 'deploy'),target=/deploy"
        Invoke-Docker run --rm -it --mount $mount autoops-installer:local
    }
    $compose = @('compose', '-f', 'deploy/docker-compose.local.yml')
    Invoke-Docker @compose config --quiet
    if ($ConfigureOnly) { Write-Host 'Configuration ready; no application containers started.'; return }
    Invoke-Docker @compose -f deploy/docker-compose.build.yml pull postgres
    Invoke-Docker @compose -f deploy/docker-compose.build.yml build
    Invoke-Docker @compose up -d --pull never --wait --wait-timeout 300
    Invoke-Docker @compose ps
    Write-Host 'Ready. Trust deploy/tls/ca.crt, then open your configured HTTPS address.'
    Write-Host 'Manage this installation with: docker compose -f deploy/docker-compose.local.yml ...'
} finally { Pop-Location }
