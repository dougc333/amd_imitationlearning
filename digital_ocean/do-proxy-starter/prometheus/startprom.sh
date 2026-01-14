#!/bin/bash
set -e


echo "starting prometheus"
./prometheus --config.file=prometheus.yml

echo "prometheus is running on http://localhost:9090"


