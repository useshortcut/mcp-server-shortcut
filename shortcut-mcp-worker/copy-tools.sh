#!/bin/bash

# Create the needed directories
mkdir -p src/tools/utils

# Copy base tools
cp ../src/tools/base.ts src/tools/
cp ../src/tools/epics.ts src/tools/
cp ../src/tools/iterations.ts src/tools/
cp ../src/tools/objectives.ts src/tools/
cp ../src/tools/stories.ts src/tools/
cp ../src/tools/teams.ts src/tools/
cp ../src/tools/user.ts src/tools/
cp ../src/tools/workflows.ts src/tools/

# Copy utils
cp ../src/tools/utils/format.ts src/tools/utils/
cp ../src/tools/utils/search.ts src/tools/utils/
cp ../src/tools/utils/validation.ts src/tools/utils/

# Make the script executable
chmod +x copy-tools.sh

echo "Tools copied successfully!"