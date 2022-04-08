#!/usr/bin/env bash

set -e
source ./env.sh

npm run build --prefix functions/api
# npm run build --prefix cdk

echo "Build successful"
