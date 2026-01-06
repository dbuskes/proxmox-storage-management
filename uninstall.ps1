$ErrorActionPreference = 'Stop'
# Proxmox Storage Management - Uninstaller
Write-Host "======================================" -ForegroundColor Red
Write-Host "Proxmox Storage Management Uninstaller" -ForegroundColor Red
Write-Host "======================================" -ForegroundColor Red
Write-Host ""

$proxmoxIP = Read-Host "Enter Proxmox server IP address"
$proxmoxUser = Read-Host "Enter username (default: root)"
if ([string]::IsNullOrWhiteSpace($proxmoxUser)) { $proxmoxUser = "root" }

Write-Host ""
Write-Host "WARNING: This will completely remove Proxmox Storage Management from $proxmoxUser@$proxmoxIP" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Type YES to continue"
if ($confirm -ne "YES") { Write-Host "Uninstall cancelled." -ForegroundColor Green; exit }

Write-Host "Uninstalling on $proxmoxUser@$proxmoxIP ..." -ForegroundColor Yellow

$remote = @'
set -e
systemctl stop pxstor-agent pxstor-coordinator 2>/dev/null || true
systemctl disable pxstor-agent pxstor-coordinator 2>/dev/null || true
rm -f /etc/systemd/system/pxstor-agent.service /etc/systemd/system/pxstor-coordinator.service
systemctl daemon-reload || true
rm -rf /opt/pxstor /etc/pxstor
userdel pxstor 2>/dev/null || true
echo "Uninstalled"
'@

ssh "$($proxmoxUser)@$($proxmoxIP)" "$remote"

Write-Host ""
Write-Host "Uninstall Complete." -ForegroundColor Green
