#!/usr/bin/env bash
# Setup Prometheus + node_exporter on a remote droplet and return remote exit code.

set -uo pipefail

########################################
# CONFIG – EDIT THESE OR PASS AS ENVS
########################################

DROPLET_IP="${DROPLET_IP:-"146.190.146.191"}"        # set to your droplet IP or export DROPLET_IP
SSH_USER="${SSH_USER:-"amd"}"               # remote user, often "root" on a fresh droplet
SSH_KEY="${SSH_KEY:-"$HOME/.ssh/id_rsa"}"    # private key path

PROM_VERSION="${PROM_VERSION:-"2.55.0"}"     # Prometheus version
NODE_EXPORTER_VERSION="${NODE_EXPORTER_VERSION:-"1.8.2"}"

########################################
# SSH COMMAND HELPER
########################################

ssh_remote() {
  ssh -i "$SSH_KEY" \
      -o StrictHostKeyChecking=accept-new \
      -o UserKnownHostsFile="$HOME/.ssh/known_hosts" \
      "${SSH_USER}@${DROPLET_IP}" "$@"
}

########################################
# MAIN REMOTE INSTALL SCRIPT
########################################

read -r -d '' REMOTE_SCRIPT <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "[remote] Updating apt..."
sudo apt-get update -y

echo "[remote] Installing prerequisites (curl, wget, tar)..."
sudo apt-get install -y curl wget tar

########################################
# INSTALL PROMETHEUS
########################################

PROM_VERSION="__PROM_VERSION__"
PROM_USER="prometheus"
PROM_DIR="/opt/prometheus"
PROM_DATA_DIR="/var/lib/prometheus"

echo "[remote] Creating prometheus user and directories..."
if ! id -u "$PROM_USER" >/dev/null 2>&1; then
  sudo useradd --no-create-home --shell /usr/sbin/nologin "$PROM_USER"
fi

sudo mkdir -p "$PROM_DIR" "$PROM_DATA_DIR"
sudo chown -R "$PROM_USER":"$PROM_USER" "$PROM_DATA_DIR"

PROM_TARBALL="prometheus-${PROM_VERSION}.linux-amd64.tar.gz"
PROM_URL="https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/${PROM_TARBALL}"

echo "[remote] Downloading Prometheus ${PROM_VERSION}..."
cd /tmp
rm -f "$PROM_TARBALL"
wget -q "$PROM_URL"

echo "[remote] Extracting Prometheus..."
tar xf "$PROM_TARBALL"
cd "prometheus-${PROM_VERSION}.linux-amd64"

echo "[remote] Installing Prometheus binaries..."
sudo cp prometheus promtool /usr/local/bin/
sudo chown "$PROM_USER":"$PROM_USER" /usr/local/bin/prometheus /usr/local/bin/promtool

echo "[remote] Installing Prometheus config files..."
sudo mkdir -p "${PROM_DIR}/config"
sudo cp -r consoles console_libraries "${PROM_DIR}/"
sudo tee "${PROM_DIR}/config/prometheus.yml" >/dev/null <<'PROMCONF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node_exporter'
    static_configs:
      - targets: ['localhost:9100']
PROMCONF

sudo chown -R "$PROM_USER":"$PROM_USER" "$PROM_DIR"

echo "[remote] Creating systemd service for Prometheus..."
sudo tee /etc/systemd/system/prometheus.service >/dev/null <<PROMUNIT
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=${PROM_USER}
Group=${PROM_USER}
Type=simple
ExecStart=/usr/local/bin/prometheus \
  --config.file=${PROM_DIR}/config/prometheus.yml \
  --storage.tsdb.path=${PROM_DATA_DIR} \
  --web.listen-address=0.0.0.0:9090 \
  --web.console.templates=${PROM_DIR}/consoles \
  --web.console.libraries=${PROM_DIR}/console_libraries
Restart=on-failure

[Install]
WantedBy=multi-user.target
PROMUNIT

########################################
# INSTALL NODE_EXPORTER
########################################

NODE_EXPORTER_VERSION="__NODE_EXPORTER_VERSION__"
NODE_EXPORTER_USER="node_exporter"

echo "[remote] Creating node_exporter user..."
if ! id -u "$NODE_EXPORTER_USER" >/dev/null 2>&1; then
  sudo useradd --no-create-home --shell /usr/sbin/nologin "$NODE_EXPORTER_USER"
fi

NODE_EXPORTER_TARBALL="node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
NODE_EXPORTER_URL="https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/${NODE_EXPORTER_TARBALL}"

echo "[remote] Downloading node_exporter ${NODE_EXPORTER_VERSION}..."
cd /tmp
rm -f "$NODE_EXPORTER_TARBALL"
wget -q "$NODE_EXPORTER_URL"

echo "[remote] Extracting node_exporter..."
tar xf "$NODE_EXPORTER_TARBALL"
cd "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64"

echo "[remote] Installing node_exporter binary..."
sudo cp node_exporter /usr/local/bin/
sudo chown "$NODE_EXPORTER_USER":"$NODE_EXPORTER_USER" /usr/local/bin/node_exporter

echo "[remote] Creating systemd service for node_exporter..."
sudo tee /etc/systemd/system/node_exporter.service >/dev/null <<NODEUNIT
[Unit]
Description=Prometheus Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=${NODE_EXPORTER_USER}
Group=${NODE_EXPORTER_USER}
Type=simple
ExecStart=/usr/local/bin/node_exporter
Restart=on-failure

[Install]
WantedBy=multi-user.target
NODEUNIT

########################################
# ENABLE & START SERVICES
########################################

echo "[remote] Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "[remote] Enabling and starting node_exporter..."
sudo systemctl enable --now node_exporter

echo "[remote] Enabling and starting Prometheus..."
sudo systemctl enable --now prometheus

echo "[remote] Checking service status..."
sudo systemctl --no-pager --full status prometheus || true
sudo systemctl --no-pager --full status node_exporter || true

echo "[remote] Done. Prometheus on :9090, node_exporter on :9100"
EOF

########################################
# SUBSTITUTE VERSIONS INTO REMOTE SCRIPT
########################################

REMOTE_SCRIPT="${REMOTE_SCRIPT/__PROM_VERSION__/${PROM_VERSION}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT/__NODE_EXPORTER_VERSION__/${NODE_EXPORTER_VERSION}}"

########################################
# RUN REMOTE SCRIPT OVER SSH
########################################

echo "[local] Connecting to ${SSH_USER}@${DROPLET_IP} to install Prometheus + node_exporter..."

ssh_remote 'bash -s' <<EOF
${REMOTE_SCRIPT}
EOF

REMOTE_EXIT_CODE=$?

echo "[local] Remote script exit code: ${REMOTE_EXIT_CODE}"
exit "${REMOTE_EXIT_CODE}"

