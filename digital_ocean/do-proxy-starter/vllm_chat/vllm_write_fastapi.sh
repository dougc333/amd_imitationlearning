#!/usr/bin/env bash
set -e

# --- CHANGE THESE VALUES IF NEEDED ---
USERNAME="amd"
#damned chatgpt replaced underscore with dash in the project directory name
PROJECT_DIR="/home/amd/vllm_chat"
ROOT_DIR="/home/amd"
VENV_DIR="$ROOT_DIR/.venv"
# -------------------------------------

OUTPUT_FILE="fastapi.service"

echo "Writing $OUTPUT_FILE ..."

cat << EOF > $OUTPUT_FILE
[Unit]
Description=FastAPI Uvicorn server for vLLM chat
After=network.target

[Service]
Type=simple
User=$USERNAME
Group=$USERNAME

# Directory where api.py lives
WorkingDirectory=$PROJECT_DIR

# Virtual environment PATH
Environment="PATH=$VENV_DIR/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

# Uvicorn launch command
ExecStart=$VENV_DIR/bin/uvicorn api:app --host 0.0.0.0 --port 8000

Restart=always
RestartSec=5
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "Done. Created $OUTPUT_FILE"
