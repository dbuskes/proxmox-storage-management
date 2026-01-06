# PSM - Proxmox Storage Management

A modern, web-based storage management interface for Proxmox VE. Simplify ISO, VM template, and backup management across your Proxmox infrastructure.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## ☕ Support This Project

**Enjoying PSM?** If this tool saves you time and makes your Proxmox life easier, consider buying me a coffee! ☕

[![Buy Me A Coffee](https://img.shields.io/badge/Revolut-Support%20Me-0075EB?style=for-the-badge&logo=revolut&logoColor=white)](https://revolut.me/thebuckie)

**[💙 Support via Revolut](https://revolut.me/thebuckie)**

Your support helps keep this project alive and enables new features!

---

## ✨ Features

- **🎯 Unified Interface** - Manage all storage types (ISO, templates, backups) from one clean UI
- **📊 Live System Stats** - Real-time CPU, memory, and storage monitoring with adaptive units (GiB/TiB)
- **🔄 File Operations** - Copy, move, and delete files across different storage locations
- **⬆️ Upload Support** - Direct upload of ISOs and templates with progress tracking
- **⬇️ Download Manager** - Download files directly from your browser
- **🔍 Search & Filter** - Quick search and sort capabilities for large file collections
- **🎨 Modern UI** - Clean, responsive interface with the Proxmox look and feel

## 🚀 Quick Start

### Prerequisites

- Proxmox VE server (tested on 7.x and 8.x)
- Root SSH access to your Proxmox server
- Windows machine with PowerShell (for automated deployment)

### Installation

#### Option 1: Automated Deployment (Windows)

1. Download both files from this repository:
   - `deploy.ps1`
   - `install-standalone-PSM-FINAL.sh`

2. Place them in the same folder

3. Run PowerShell as Administrator and execute:
   ```powershell
   .\deploy.ps1
   ```

4. Enter your Proxmox server IP and credentials when prompted

5. Access PSM at `http://YOUR-PROXMOX-IP:8087`

#### Option 2: Direct Install from Proxmox Shell

SSH into your Proxmox server and run this single command:

```bash
curl -L https://github.com/dbuskes/proxmox-storage-management/releases/latest/download/install-standalone-PSM-FINAL.sh -o /tmp/psm-install.sh && bash /tmp/psm-install.sh
```

Or using wget:
```bash
wget -O /tmp/psm-install.sh https://github.com/dbuskes/proxmox-storage-management/releases/latest/download/install-standalone-PSM-FINAL.sh && bash /tmp/psm-install.sh
```

Then access PSM at `http://YOUR-PROXMOX-IP:8087`

#### Option 3: Manual Installation (Linux/Mac)

1. Download `install-standalone-PSM-FINAL.sh` to your local machine

2. Copy to your Proxmox server:
   ```bash
   scp install-standalone-PSM-FINAL.sh root@YOUR-PROXMOX-IP:/tmp/
   ```

3. SSH into your Proxmox server:
   ```bash
   ssh root@YOUR-PROXMOX-IP
   ```

4. Run the installer:
   ```bash
   bash /tmp/install-standalone-PSM-FINAL.sh
   ```

5. Access PSM at `http://YOUR-PROXMOX-IP:8087`

## 🔧 What Gets Installed

PSM is a complete, self-contained application that installs:

- **Go Backend Agent** (port 8086) - Handles storage operations and system stats
- **Web Coordinator** (port 8087) - Serves the UI and proxies API requests
- **React Frontend** - Modern, responsive web interface
- **Systemd Services** - Auto-start on boot with `pxstor-agent` and `pxstor-coordinator`
- **Configuration** - Secure token-based authentication

All components are installed to `/opt/pxstor/` with source code included.

## 📖 Usage

### Accessing PSM

Open your web browser and navigate to:
```
http://YOUR-PROXMOX-IP:8087
```

The interface will automatically connect to your Proxmox server and display:
- Available storage locations in the sidebar
- System statistics (CPU, Memory, Storage) in the header
- File browser for ISOs, Templates, and Backups

### Managing Files

1. **Select a Storage** - Click on any storage in the left sidebar
2. **Browse Content** - Switch between ISO, Templates, and Backup tabs
3. **Upload Files** - Click "Upload File" and select your file
4. **Select Files** - Use checkboxes to select multiple files
5. **Perform Operations** - Use Copy, Move, or Delete buttons
6. **Download** - Click Download button on any file

### Storage Units

PSM intelligently displays storage capacity:
- **Under 1 TiB**: Displays in GiB (e.g., `850.00 GiB`)
- **1 TiB or more**: Displays in TiB (e.g., `6.20 TiB`)

## 🛠️ Advanced Configuration

### Change the Authentication Token

1. Edit the config file:
   ```bash
   nano /etc/pxstor/config.yml
   ```

2. Change the `token` value to your own secure token

3. Restart services:
   ```bash
   systemctl restart pxstor-agent pxstor-coordinator
   ```

### Service Management

Check service status:
```bash
systemctl status pxstor-agent
systemctl status pxstor-coordinator
```

View logs:
```bash
journalctl -u pxstor-agent -f
journalctl -u pxstor-coordinator -f
```

## 🗑️ Uninstallation

### Option 1: Direct from Proxmox Shell

SSH into your Proxmox server and run:

```bash
curl -L https://github.com/dbuskes/proxmox-storage-management/releases/latest/download/uninstall.sh -o /tmp/psm-uninstall.sh && bash /tmp/psm-uninstall.sh
```

Or using wget:
```bash
wget -O /tmp/psm-uninstall.sh https://github.com/dbuskes/proxmox-storage-management/releases/latest/download/uninstall.sh && bash /tmp/psm-uninstall.sh
```

### Option 2: Using Windows PowerShell

If you have the `uninstall.ps1` script:
```powershell
.\uninstall.ps1
```

### Option 3: Manual Removal

SSH into your Proxmox server and run these commands:

```bash
systemctl stop pxstor-agent pxstor-coordinator
systemctl disable pxstor-agent pxstor-coordinator
rm /etc/systemd/system/pxstor-*.service
rm -rf /opt/pxstor
rm -rf /etc/pxstor
systemctl daemon-reload
```

## 🔐 Security & Transparency

### About the Standalone Installer

The `install-standalone-PSM-FINAL.sh` is a self-contained installer that includes base64-encoded binaries for convenience. **We understand this may raise security concerns.**

### Build from Source (Recommended for Security-Conscious Users)

If you prefer to build from source and verify the code yourself:

```bash
# 1. Clone the repository
git clone https://github.com/dbuskes/proxmox-storage-management.git
cd proxmox-storage-management

# 2. Install dependencies (Go 1.20+, Node.js 18+)
apt update && apt install -y golang-go nodejs npm

# 3. Build the agent
cd src/agent
go build -o /opt/pxstor/bin/pxstor-agent .

# 4. Build the coordinator
cd ../coordinator
go build -o /opt/pxstor/bin/pxstor-coordinator .

# 5. Build the UI
cd ../ui
npm install
npm run build
mkdir -p /opt/pxstor/ui
cp -r dist/* /opt/pxstor/ui/

# 6. Set up configuration (see installation docs)
```

**Note:** Full source code is available in the repository for review. The standalone installer is generated from the same source using our build script.

### Security Features

- PSM uses token-based authentication for API access
- The default token is randomly generated during installation
- PSM runs on localhost ports and should be accessed through your Proxmox server's IP
- For production use, consider placing PSM behind a reverse proxy with HTTPS
- Firewall rules: Ensure ports 8086 and 8087 are accessible from your network

### Verify the Installer

Check the SHA256 checksum of your downloaded installer:
```bash
sha256sum install-standalone-PSM-FINAL.sh
```

Compare with the checksum published in the release notes.

## 🤝 Contributing

This project is actively maintained. If you encounter issues or have suggestions:

1. Open an issue with detailed information
2. Include your Proxmox version and PSM logs
3. Describe expected vs actual behavior

## 📝 License

MIT License - feel free to use and modify for your needs.

## 🙏 Acknowledgments

Built for the Proxmox VE community to simplify storage management workflows.

## 📞 Support

- Check the logs: `journalctl -u pxstor-agent -f`
- Verify services are running: `systemctl status pxstor-*`
- Ensure your Proxmox storage is properly configured in `/etc/pve/storage.cfg`

---

**Made with ❤️ for Proxmox administrators**

