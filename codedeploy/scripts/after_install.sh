#!/bin/bash

echo "After Install -----"
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 048776562964.dkr.ecr.us-east-1.amazonaws.com
docker pull 048776562964.dkr.ecr.us-east-1.amazonaws.com/shortcut/mcp-server