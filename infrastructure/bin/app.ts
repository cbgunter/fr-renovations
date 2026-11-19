#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FrRenovationsStack } from '../lib/fr-stack';

const app = new cdk.App();

new FrRenovationsStack(app, 'FrRenovationsStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  description: 'First Responders Renovations - public site + admin suite (leads, estimator, calendar)',
});

// Cost allocation tag: lets the AWS Budget track this project on its own.
cdk.Tags.of(app).add('project', 'fr-renovations');
