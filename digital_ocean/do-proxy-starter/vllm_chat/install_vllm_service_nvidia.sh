#!/usr/bin/env bash
set -euo pipefail

# --- EDIT THESE IF NEEDED ---
USERNAME="${USERNAME:-$(id -un)}"
PROJECT_DIR="${PROJECT_DIR:-/home/$USERNAME/vllm_chat}"
ROOT_DIR="${ROOT_DIR:-/home/$USERNAME}"
VENV_DIR="${VENV_DIR:-$ROOT_DIR/.venv}"

SERVICE_NAME="${SERVICE_NAME:-vllm}"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

MODEL="${MODEL:-tinyllama/tinyllama-1.1b-chat-v1.0}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-9000}"
# ----------------------------

echo "Installing systemd unit: $SERVICE_PATH"
echo "  USERNAME    = $USERNAME"
echo "  PROJECT_DIR = $PROJECT_DIR"
echo "  VENV_DIR    = $VENV_DIR"
echo "  MODEL       = $MODEL"
echo "  HOST:PORT   = $HOST:$PORT"

# Basic validations (fail early with clear errors)
if ! id "$USERNAME" >/dev/null 2>&1; then
  echo "ERROR: user '$USERNAME' does not exist." >&2
  exit 1
fi

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "ERROR: PROJECT_DIR '$PROJECT_DIR' does not exist." >&2
  exit 1
fi

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  echo "ERROR: '$VENV_DIR/bin/python' not found or not executable." >&2
  echo "       Create your venv at: $VENV_DIR (e.g. uv venv --python 3.12 --seed)" >&2
  exit 1
fi

sudo tee "$SERVICE_PATH" >/dev/null <<EOF
[Unit]
Description=vLLM OpenAI-compatible API Server
After=network.target

[Service]
Type=simple
User=$USERNAME
Group=$USERNAME
WorkingDirectory=$PROJECT_DIR

# Ensure venv python is used
Environment="PATH=$VENV_DIR/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

# Optional: keep cache in a writable place
Environment="HF_HOME=$ROOT_DIR/.cache/huggingface"
Environment="TRANSFORMERS_CACHE=$ROOT_DIR/.cache/huggingface"
Environment="HF_HUB_ENABLE_HF_TRANSFER=1"

ExecStart=$VENV_DIR/bin/python -m vllm.entrypoints.openai.api_server \\
  --model $MODEL \\
  --host $HOST \\
  --port $PORT

Restart=always
RestartSec=5
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal

# Mild hardening (safe defaults)
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Enabling service..."
sudo systemctl enable "${SERVICE_NAME}.service"

echo "Starting service..."
sudo systemctl restart "${SERVICE_NAME}.service"

echo "Status:"
sudo systemctl status "${SERVICE_NAME}.service" --no-pager -l