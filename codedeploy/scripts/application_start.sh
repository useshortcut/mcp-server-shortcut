#!/bin/bash
echo "Application Start -----"

docker run \
 --name shortcut-mcp \
 --rm -d -p 9292:9292 \
 --log-driver=awslogs \
 --log-opt awslogs-region=us-east-1 \
 --log-opt awslogs-group="shortcut/${DEPLOYMENT_GROUP}/${APPLICATION_NAME}" \
 --log-opt awslogs-create-stream=true \
 048776562964.dkr.ecr.us-east-1.amazonaws.com/shortcut/mcp-server