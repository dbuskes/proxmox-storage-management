#!/bin/bash
#
# PSM - Proxmox Storage Management Uninstaller
# This script completely removes PSM from your Proxmox server
#

set -e

echo "========================================"
echo "  PSM Uninstaller"
echo "========================================"
echo ""
echo "⚠️  WARNING: This will completely remove PSM from this server"
echo ""
echo "This will remove:"
echo "  - All PSM services (pxstor-agent, pxstor-coordinator)"
echo "  - All PSM files (/opt/pxstor, /etc/pxstor)"
echo "  - All PSM configuration"
echo ""
read -p "Type YES to continue: " confirm

if [ "$confirm" != "YES" ]; then
    echo "❌ Uninstall cancelled."
    exit 0
fi

echo ""
echo "🗑️  Uninstalling PSM..."

# Stop and disable services
echo "→ Stopping services..."
systemctl stop pxstor-agent pxstor-coordinator 2>/dev/null || true
systemctl disable pxstor-agent pxstor-coordinator 2>/dev/null || true

# Remove service files
echo "→ Removing service files..."
rm -f /etc/systemd/system/pxstor-agent.service
rm -f /etc/systemd/system/pxstor-coordinator.service
systemctl daemon-reload

# Remove application files
echo "→ Removing application files..."
rm -rf /opt/pxstor
rm -rf /etc/pxstor

# Remove user (if created)
if id pxstor &>/dev/null; then
    echo "→ Removing pxstor user..."
    userdel pxstor 2>/dev/null || true
fi

echo ""
echo "✅ PSM has been completely uninstalled"
echo ""
echo "Your Proxmox storage configuration (/etc/pve/storage.cfg) was not modified."
echo ""
