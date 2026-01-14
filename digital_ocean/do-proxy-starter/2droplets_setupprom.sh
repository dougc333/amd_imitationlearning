#!/usr/bin/env bash
# Install Prometheus on one droplet and node_exporter on another.
# Returns exit codes from each remote script.

set -uo pipefail

#############################################
# CONFIG – EDIT OR PASS AS ENV VARIABLES
#############################################

# Droplet running Prometheus server
PROM_DROPLET_IP="${PROM_DROPLET_IP:-"1.1.1.1"}"

# Droplet running vLLM
VLLM_DROPLET_IP="${VLLM_DROPLET_IP:-"2.2.2.2"}"

SSH_USER="${SSH_USER:-"root"}"
SSH_KEY="${SSH_KEY:-"$HOME/.ssh/id_rsa"}"

PROM_VERSION="${PROM_VERSION:-"2.55.0"}"
NODE_EXPORTER_VERSION="${NODE_EXPORTER_VERSION:-"1.8.2"}"

#############################################
# SSH HELPERS
#############################################

ssh_remote() {
  local IP="$1"
  shift
  ssh -i "$SSH_KEY" \
      -o StrictHostKeyChecking=accept-new \
      -o UserKnownHostsFile="$HOME/.ssh/known_hosts" \
      "${SSH_USER}@${IP}" "$@"
}

#############################################
# REMOTE SCRIPT: INSTALL NODE_EXPORTER ONLY
#############################################
read -r -d '' REMOTE_NODE_EXPORTER <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

NODE_EXPORTER_VERSION="__NODE_EXPORTER_VERSION__"
NODE_EXPORTER_USER="node_exporter"

echo "[remote] Installing node_exporter only..."

sudo apt-get update -y
sudo apt-get install -y wget tar

if ! id -u "$NODE_EXPORTER_USER" >/dev/null 2>&1; then
  sudo useradd --no-create-home --shell /usr/sbin/nologin "$NODE_EXPORTER_USER"
fi

cd /tmp
TAR="node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
URL="https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/${TAR}"

wget -q "$URL"
tar xf "$TAR"
cd "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64"

sudo cp node_exporter /usr/local/bin/
sudo chown "$NODE_EXPORTER_USER":"$NODE_EXPORTER_USER" /usr/local/bin/node_exporter

sudo tee /etc/systemd/system/node_exporter.service >/dev/null <<NODEUNIT
[Unit]
Description=Prometheus Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
ExecStart=/usr/local/bin/node_exporter
Restart=on-failure

[Install]
WantedBy=multi-user.target
NODEUNIT

sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter

echo "[remote] node_exporter installed and started on :9100"
EOF

#############################################
# REMOTE SCRIPT: INSTALL PROMETHEUS SERVER
#############################################
read -r -d '' REMOTE_PROMETHEUS <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

PROM_VERSION="__PROM_VERSION__"
NODE_EXPORTER_VERSION="__NODE_EXPORTER_VERSION__"
PROM_USER="prometheus"
PROM_DIR="/opt/prometheus"
PROM_DATA_DIR="/var/lib/prometheus"

# These get replaced from the shell script
VLLM_TARGET="__VLLM_TARGET__"

sudo apt-get update -y
sudo apt-get install -y wget curl tar

echo "[remote] Installing Prometheus..."

if ! id -u "$PROM_USER" >/dev/null 2>&1; then
  sudo useradd --no-create-home --shell /usr/sbin/nologin "$PROM_USER"
fi

sudo mkdir -p "$PROM_DIR" "$PROM_DATA_DIR"
sudo chown -R "$PROM_USER":"$PROM_USER" "$PROM_DATA_DIR"

cd /tmp
TAR="prometheus-${PROM_VERSION}.linux-amd64.tar.gz"
URL="https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/${TAR}"

wget -q "$URL"
tar xf "$TAR"
cd "prometheus-${PROM_VERSION}.linux-amd64"

sudo cp prometheus promtool /usr/local/bin/
sudo chown "$PROM_USER":"$PROM_USER" /usr/local/bin/prometheus /usr/local/bin/promtool

sudo cp -r consoles console_libraries "$PROM_DIR"

##############################
# Prometheus config includes BOTH DROPLETS
##############################
sudo tee "${PROM_DIR}/prometheus.yml" >/dev/null <<PROMCONF
global:
  scrape_interval: 15s

scrape_configs:

  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "node_exporter_this_droplet"
    static_configs:
      - targets: ["localhost:9100"]

  - job_name: "node_exporter_vllm"
    static_configs:
      - targets: ["${VLLM_TARGET}:9100"]
PROMCONF

sudo tee /etc/systemd/system/prometheus.service >/dev/null <<PROMUNIT
[Unit]
Description=Prometheus
After=network-online.target

[Service]
User=${PROM_USER}
ExecStart=/usr/local/bin/prometheus \
  --config.file=${PROM_DIR}/prometheus.yml \
  --storage.tsdb.path=${PROM_DATA_DIR} \
  --web.listen-address=:9090
Restart=always

[Install]
WantedBy=multi-user.target
PROMUNIT

sudo systemctl daemon-reload
sudo systemctl enable --now prometheus

echo "[remote] Prometheus installed and running on :9090"
EOF

#############################################
# SUBSTITUTE VARIABLES INTO REMOTE SCRIPTS
#############################################

REMOTE_NODE_EXPORTER="${REMOTE_NODE_EXPORTER/__NODE_EXPORTER_VERSION__/${NODE_EXPORTER_VERSION}}"

REMOTE_PROMETHEUS="${REMOTE_PROMETHEUS/__PROM_VERSION__/${PROM_VERSION}}"
REMOTE_PROMETHEUS="${REMOTE_PROMETHEUS/__NODE_EXPORTER_VERSION__/${NODE_EXPORTER_VERSION}}"
REMOTE_PROMETHEUS="${REMOTE_PROMETHEUS/__VLLM_TARGET__/${VLLM_DROPLET_IP}}"

#############################################
# EXECUTE REMOTE INSTALLS
#############################################

echo "=== Installing node_exporter on vLLM droplet (${VLLM_DROPLET_IP}) ==="
ssh_remote "$VLLM_DROPLET_IP" 'bash -s' <<< "$REMOTE_NODE_EXPORTER"
VLLM_EXIT=$?

echo "=== Installing Prometheus + node_exporter on Prom droplet (${PROM_DROPLET_IP}) ==="
ssh_remote "$PROM_DROPLET_IP" 'bash -s' <<< "$REMOTE_PROMETHEUS"
PROM_EXIT=$?

echo "--- Exit Codes ---"
echo "vLLM droplet:     $VLLM_EXIT"
echo "Prometheus droplet: $PROM_EXIT"

# Fail if either fails
if [[ $VLLM_EXIT -ne 0 || $PROM_EXIT -ne 0 ]]; then
  exit 1
fi

exit 0

