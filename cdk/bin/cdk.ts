#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkStack } from '../lib/cdk-stack';
import { Utils } from '../lib/utils';

const app = new cdk.App();
const stackName = Utils.getEnv('STACK_NAME');
const stackAccount = Utils.getEnv('STACK_ACCOUNT');
const stackRegion = Utils.getEnv('STACK_REGION');
const stackProps = { env: { region: stackRegion, account: stackAccount } };

new CdkStack(app, stackName, stackProps);
