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

#uv pip install -r requirements/cpu.txt --index-strategy unsafe-best-match

# Download the keyring package from NVIDIA's Debian 12 repo
#wget https://developer.download.nvidia.com/compute/cuda/repos/debian12/x86_64/cuda-keyring_1.1-1_all.deb
#sudo dpkg -i cuda-keyring_1.1-1_all.deb
#sudo apt-get update

#sudo apt-get install -y cuda-toolkit-12-8

#echo 'export CUDA_HOME=/usr/local/cuda' >> ~/.bashrc
#echo 'export PATH=$CUDA_HOME/bin:$PATH' >> ~/.bashrc
#echo 'export LD_LIBRARY_PATH=$CUDA_HOME/lib64:${LD_LIBRARY_PATH:-}' >> ~/.bashrc
#source ~/.bashrc

#echo "building vllm in noneditable mode. static install"

#uv pip install \
#  --find-links https://download.pytorch.org/whl/xformers/ \
#  "xformers==0.0.33+5d4b92a5.d20251029"

VLLM_TARGET_DEVICE=cpu uv pip install . --no-build-isolation

#VLLM_TARGET_DEVICE=cuda uv pip install . --no-build-isolation


# --- Verification Step ---which nvcc || true
nvcc --version || true
echo "=== Verifying vLLM installation ==="
# We use python (which points to the .venv python) to check the import and version
python -c "import vllm; print(f'Success! vLLM version: {vllm.__version__}')"
