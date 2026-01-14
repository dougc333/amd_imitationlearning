#!/usr/bin/env bash
set -e



echo "Copying fastapi.service to /etc/systemd/system/"
sudo cp fastapi.service /etc/systemd/system/fastapi.service

echo "== 10) Reload systemd, enable and start services =="

sudo systemctl daemon-reload

sudo systemctl enable fastapi.service

sudo systemctl start fastapi.service

echo
echo "== Services status =="
sudo systemctl status fastapi.service --no-pager || true
echo "--------------------------------------------------"

echo
echo "== Done! =="
echo "FastAPI chat UI should be available at:"
echo "  http://<your-droplet-ip>:8000/"
echo
