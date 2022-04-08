#!/usr/bin/env bash

set -e
source ./env.sh

echo "this will run npm install in all relevant sub-folders, build the project, and install the CDK toolkit"

npm install --prefix functions/api
./build.sh

npm run cdk --prefix cdk -- bootstrap