#!/usr/bin/env bash
set -e

# --- EDIT THESE IF NEEDED ---
USERNAME="amd"
PROJECT_DIR="/home/amd/vllm_chat"
ROOT_DIR="/home/amd"
VENV_DIR="$ROOT_DIR/.venv"
SERVICE_FILE="vllm.service"
# ----------------------------

echo "Creating $SERVICE_FILE ..."

cat << EOF > $SERVICE_FILE
[Unit]
Description=vLLM OpenAI-compatible API Server
After=network.target

[Service]
Type=simple
User=$USERNAME
Group=$USERNAME
WorkingDirectory=$PROJECT_DIR
# Allow lots of open files/sockets
LimitNOFILE=1048576
LimitNPROC=131072

# Optional: lock memory (prevents some paging issues)
LimitMEMLOCK=infinity

# Give vLLM time to download/load model
TimeoutStartSec=900
Restart=on-failure
RestartSec=3

# Nice-to-have for performance
TasksMax=infinity

Environment="PATH=$VENV_DIR/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

ExecStart=$VENV_DIR/bin/python -m vllm.entrypoints.openai.api_server \\
  --model tinyllama/tinyllama-1.1b-chat-v1.0 \\
  --host 127.0.0.1 \\
  --port 9000

Restart=always
RestartSec=5
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "Done! Wrote $SERVICE_FILE"
