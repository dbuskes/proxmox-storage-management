# Proxmox Storage Management - Easy Deployer
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Proxmox Storage Management Installer" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$proxmoxIP = Read-Host "Enter Proxmox server IP address (e.g., 192.168.1.13)"
$proxmoxUser = Read-Host "Enter Proxmox username (default: root)"
if ([string]::IsNullOrWhiteSpace($proxmoxUser)) { $proxmoxUser = "root" }

Write-Host ""
Write-Host "Connecting to $proxmoxUser@$proxmoxIP..." -ForegroundColor Yellow

# Skipping preflight SSH test to avoid redirection parsing issues in PowerShell

# Pick newest installer
Write-Host "Preparing installer transfer..." -ForegroundColor Yellow
$installers = Get-ChildItem -Path $PSScriptRoot -Filter "install-standalone*.sh" -File | Sort-Object LastWriteTime -Descending
if (-not $installers) { Write-Error "No installer found in $PSScriptRoot (install-standalone*.sh)"; exit 1 }
$installer = $installers[0].FullName
Write-Host ("Using installer: " + (Split-Path $installer -Leaf)) -ForegroundColor Yellow

# Upload and install (two-step). To avoid double prompts, set up SSH keys.
Write-Host "Uploading installer..." -ForegroundColor Yellow
scp $installer "${proxmoxUser}@${proxmoxIP}:/tmp/pxstor-install.sh"

Write-Host "Running installer on $proxmoxUser@$proxmoxIP ..." -ForegroundColor Yellow
ssh "${proxmoxUser}@${proxmoxIP}" "chmod +x /tmp/pxstor-install.sh; bash /tmp/pxstor-install.sh"

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
$url = "http://${proxmoxIP}:8087"
Write-Host ("Open in browser: " + $url) -ForegroundColor Cyan

$openBrowser = Read-Host "Open browser now? (y/n)"
if ($openBrowser -eq "y") { Start-Process $url }
