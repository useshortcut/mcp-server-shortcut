#!/bin/bash

echo "After Install -----"

echo "Get deployment SHA from the filename"
deployment_json=$(aws deploy get-deployment --deployment-id "$DEPLOYMENT_ID")
key=$(echo "$deployment_json" | jq -r '.deploymentInfo.revision.s3Location.key')
sha=$(echo "$key" | sed -E 's/.*-([0-9a-f]{7,40})\.tgz/\1/')

echo "Login to ECR"
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 048776562964.dkr.ecr.us-east-1.amazonaws.com

echo "Pull image"
docker pull "048776562964.dkr.ecr.us-east-1.amazonaws.com/shortcut/mcp-server:sha-$sha"
exit 0
