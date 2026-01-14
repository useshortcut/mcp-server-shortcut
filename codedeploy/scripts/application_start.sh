#!/bin/bash
echo "Application Start -----"

docker run \
 --name shortcut-mcp \
 --rm -d -p 9292:9292 \
 048776562964.dkr.ecr.us-east-1.amazonaws.com/shortcut/mcp-server