#!/bin/bash
set -e

echo "activating venv"

source $HOME/.venv/bin/activate

echo "adding .venv/bin and .local/bin to PATH"
export PATH=$PATH:$HOME/.venv/bin:$HOME/.local/bin


echo "installing fastapi and uvicorn"
pip install fastapi uvicorn




echo "---------------------------"
echo "installing vllm_api.sh"
echo "---------------------------"
source /home/amd/vllm_chat/vllm_api.sh


echo "---------------------------"
echo "installing vllm_html.sh"
echo "---------------------------"
source /home/amd/vllm_chat/vllm_html.sh



echo "---------------------------"
echo "installing vllm_write_fastapi.sh"
echo "---------------------------"
source /home/amd/vllm_chat/vllm_write_fastapi.sh


echo "---------------------------"
echo "installing vllm_write_service.sh"
echo "---------------------------"
source /home/amd/vllm_chat/vllm_write_service.sh


echo "---------------------------"
echo "installing vllm_service_startstop.sh"
echo "---------------------------"
source /home/amd/vllm_chat/vllm_service_startstop.sh


echo "---------------------------"
echo "installing vllm_service_fastapi_startstop.sh"
echo "---------------------------"
source /home/amd/vllm_chat/vllm_service_fastapi_startstop.sh

echo "---------------------------"
echo "done"
echo "---------------------------"



