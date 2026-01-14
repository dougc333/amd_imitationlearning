#!/bin/bash
set -e


scp install.sh amd@164.92.68.116:/home/amd/install.sh
ssh amd@164.92.68.116 "chmod +x /home/amd/install.sh"
ssh amd@164.92.68.116 "source /home/amd/install.sh"
