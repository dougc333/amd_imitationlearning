#!/bin/bash
set -euo pipefail

#sudo apt-get update
echo "there is a 60s sleep to allow apt system to settle down after system initialization"
echo "without this delay apt install will fail with 'E: Could not get lock /var/lib/dpkg/lock-frontend - open (11: Resource temporarily unavailable)' error"

sleep 60

# Install uv
echo "Installing uv"
/usr/bin/curl -fsSL https://astral.sh/uv/install.sh | sh

echo "home is $HOME"

# shellcheck disable=SC1090
source "$HOME/.local/bin/env"

# Install venv
echo "creating virtual environment .venv with python 3.12"
uv venv --python 3.12 --seed

echo "activating virtual environment .venv"
# shellcheck disable=SC1091
source .venv/bin/activate

#echo "Ensuring build dependencies exist"
#ensure_packages gcc-12 g++-12 libnuma-dev python3-dev

# echo "Checking for /usr/bin/gcc-12"
# if [ ! -x /usr/bin/gcc-12 ]; then
#   echo "ERROR: /usr/bin/gcc-12 not found even after installation. Aborting."
#   exit 1
# fi
sudo DEBIAN_FRONTEND=noninteractive \
     apt-get -o Dpkg::Options::=--force-confnew \
             -o Dpkg::Options::=--force-confdef \
             install -y gcc-12 g++-12 libnuma-dev python3-dev
#sudo apt-get install -y gcc-12 g++-12 libnuma-dev python3-dev

echo "setting gcc-12/g++-12 as default via update-alternatives"
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-12 10 --slave /usr/bin/g++ g++ /usr/bin/g++-12

echo "cloning vllm from dougc333 fork"
if [ ! -d "$HOME/vllm" ]; then
  git clone https://github.com/dougc333/vllm.git "$HOME/vllm"
else
  echo "vllm directory already exists, reusing."
fi

cd "$HOME/vllm"

echo "installing vllm dependencies"
uv pip install -r requirements/cpu-build.txt --index-strategy unsafe-best-match
uv pip install -r requirements/cpu.txt --index-strategy unsafe-best-match

echo "building vllm in noneditable mode. static install"
VLLM_TARGET_DEVICE=cpu uv pip install . --no-build-isolation

echo "=== Verifying vLLM installation ==="
python -c "import vllm; print(f'Success! vLLM version: {vllm.__version__}')"
