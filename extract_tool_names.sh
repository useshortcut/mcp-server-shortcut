#!/bin/bash

echo "=== Extracting tool names from source files ==="
find src/tools -name "*.ts" -exec grep -A 3 "server.tool(" {} \; | grep -E '^\s*"[^"]*"' | sort | uniq
