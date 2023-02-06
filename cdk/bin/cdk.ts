/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkStack, CdkStackProps } from '../lib/cdk-stack';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new cdk.App();
// const stackName = "MultiCDNMonitorStack";
const stackName = "CloudFrontMonitoringStackv1";

const cfMonitorStack = new CdkStack(app, stackName, {
  env: { account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION },
  terminationProtection: true,
  // hostedZoneId: process.env.HOSTEDZONE_ID,
  // domainName: process.env.DOMAIN_NAME,
  monitorDomainName: process.env.MONITOR_DOMAIN_NAME,
  // deployStaging: process.env.DEPLOY_STAGING == "TRUE" ? true : false,
  // deployMultiCDN: process.env.DEPLOY_MULTICDN == "TRUE" ? true : false,
} as CdkStackProps);

cdk.Tags.of(cfMonitorStack).add('createdBy', stackName);
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))