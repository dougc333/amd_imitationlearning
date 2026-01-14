#!/usr/bin/env bash
set -e


#sudo cp /home/amd/vllm_chat/vllm.service /etc/systemd/system/vllm.service
# modify for gcp. 
sudo cp vllm.service /etc/systemd/system/vllm.service
sudo chmod 644 /etc/systemd/system/vllm.service
sudo systemctl daemon-reload
sudo systemctl enable vllm.service
sudo systemctl start vllm.service

echo "vLLM is listening on 127.0.0.1:9000 for /v1/chat/completions"
