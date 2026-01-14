#!/bin/bash
set -e


IFS='@' read -r user ip <<< "$1"

echo "user: $user"
echo "ip: $ip"

