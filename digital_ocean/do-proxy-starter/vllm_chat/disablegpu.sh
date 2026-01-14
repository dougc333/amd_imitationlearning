#!/bin/bash
set -e

export VLLM_USE_NO_CUDA=1
export VLLM_USE_DISABLE_ROCM=1
export VLLM_TARGET_DEVICE=cpu
export VLLM_CPU_Kernels=ON

echo "VLLM_USE_NO_CUDA is set to $VLLM_USE_NO_CUDA"
echo "VLLM_USE_DISABLE_ROCM is set to $VLLM_USE_DISABLE_ROCM"
echo "VLLM_TARGET_DEVICE is set to $VLLM_TARGET_DEVICE"


