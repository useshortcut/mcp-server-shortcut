#!/bin/bash

echo "Before Install -----"
docker image rm -f 048776562964.dkr.ecr.us-east-1.amazonaws.com/shortcut/mcp-server || true
docker system prune -f
exit 0