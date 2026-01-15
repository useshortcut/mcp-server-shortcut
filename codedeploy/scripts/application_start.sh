#!/bin/bash
echo "Application Start -----"

echo "Get deployment SHA from the filename"
deployment_json=$(aws deploy get-deployment --deployment-id "$DEPLOYMENT_ID")
key=$(echo "$deployment_json" | jq -r '.deploymentInfo.revision.s3Location.key')
sha=$(echo "$key" | sed -E 's/.*-([0-9a-f]{7,40})\.tgz/\1/')

docker run \
 --name shortcut-mcp \
 --rm -d -p 9292:9292 \
 --log-driver=awslogs \
 --log-opt awslogs-region=us-east-1 \
 --log-opt awslogs-group="/shortcut/${DEPLOYMENT_GROUP_NAME}/${APPLICATION_NAME}" \
 "048776562964.dkr.ecr.us-east-1.amazonaws.com/shortcut/mcp-server:sha-$sha"