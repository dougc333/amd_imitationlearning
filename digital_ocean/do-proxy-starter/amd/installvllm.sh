#!/bin/bash
set -e

# Install uv
echo "Installing uv"
curl -fsSL https://astral.sh/uv/install.sh | sh

echo "home is $HOME"

source $HOME/.local/bin/env

# Install venv
echo "creating virtual environment .venv with python 3.12"
uv venv --python 3.12 --seed

echo "activating virtual environment .venv"
source .venv/bin/activate

echo "updating apt"
# need fix still restarts services
#sudo apt-get update -y
sudo apt-get install -y gcc-12 g++-12 libnuma-dev python3-dev
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-12 10 --slave /usr/bin/g++ g++ /usr/bin/g++-12


echo "cloning vllm from dougc333 fork"
git clone https://github.com/dougc333/vllm.git
cd vllm

echo "installing vllm dependencies"

uv pip install -r requirements/cpu-build.txt --index-strategy unsafe-best-match
uv pip install -r requirements/cpu.txt --index-strategy unsafe-best-match

echo "building vllm in noneditable mode. static install"
VLLM_TARGET_DEVICE=cpu uv pip install . --no-build-isolation

# --- Verification Step ---
echo "=== Verifying vLLM installation ==="
# We use python (which points to the .venv python) to check the import and version
python -c "import vllm; print(f'Success! vLLM version: {vllm.__version__}')"
