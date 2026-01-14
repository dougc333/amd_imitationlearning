!#/bin/bash


 python -m vllm.entrypoints.openai.api_server   --model tinyllama/tinyllama-1.1b-chat-v1.0   --host 0.0.0.0   --port 8000