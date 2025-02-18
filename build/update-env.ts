/* eslint-disable import/no-extraneous-dependencies */
import {
  CloudFormation, Parameter, Capability,
  waitUntilStackUpdateComplete, waitUntilStackCreateComplete,
} from '@aws-sdk/client-cloudformation';
import 'dotenv/config';
import fs from 'fs/promises';
import { $ } from 'zx';
import updateS3 from './update-s3';
import updateLambda from './update-lambda';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const cf = new CloudFormation({ region });

async function runTemplate(
  templatePath: string,
  name: string,
  parameters?: Parameter[],
  capabilities?: Capability[],
): Promise<void> {
  const stack = await cf.describeStacks({
    StackName: name,
  });
  const template = await fs.readFile(templatePath, 'utf-8');
  const newStack = stack.Stacks != null && stack.Stacks.length < 1;
  if (newStack) {
    await cf.createStack({
      StackName: name,
      TemplateBody: template,
      Capabilities: capabilities,
      Parameters: parameters,
    });
  } else {
    try {
      await cf.updateStack({
        StackName: name,
        TemplateBody: template,
        Capabilities: capabilities,
        Parameters: parameters,
      });
    } catch (e) {
      if (e.message === 'No updates are to be performed.') {
        console.log(`template ${name} No updates are to be performed.`);
        return;
      }
      throw e;
    }
  }

  const { state, reason } = await Promise.race([
    waitUntilStackCreateComplete({ client: cf, maxWaitTime: 1000 * 60 * 30 }, { StackName: name }),
    waitUntilStackUpdateComplete({ client: cf, maxWaitTime: 1000 * 60 * 30 }, { StackName: name }),
  ]);
  if (['ABORTED', 'FAILURE', 'TIMEOUT'].includes(state)) {
    console.log(state, reason);
    throw new Error('Creation failed');
  }
  console.log(`template ${name} ${newStack ? 'created' : 'updated'}.`);
}

async function main() {
  await runTemplate('./build/t00.cf.yaml', 'Market-value-code-bucket', [{
    ParameterKey: 'BucketCodeName',
    ParameterValue: bucketCodeName,
  }]);
  const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  process.env.IMAGE_VERSION = randomString;
  await $`sh ./build/docker-build.sh`;
  await $`sh ./build/build.sh`;

  await updateS3();
  console.log('finnish deploy!');

  await runTemplate(
    './build/t01.cf.yaml',
    'Market-value',
    [{
      ParameterKey: 'BucketCodeName',
      ParameterValue: bucketCodeName,
    }, {
      ParameterKey: 'WikiUserName',
      ParameterValue: process.env.USER_NAME,
    }, {
      ParameterKey: 'WikiPassword',
      ParameterValue: process.env.PASSWORD,
    }, {
      ParameterKey: 'WikiProtectUserName',
      ParameterValue: process.env.PROTECT_USER_NAME,
    }, {
      ParameterKey: 'WikiProtectPassword',
      ParameterValue: process.env.PROTECT_PASSWORD,
    },
    {
      ParameterKey: 'WikiDeleteUserName',
      ParameterValue: process.env.DELETE_USER_NAME,
    }, {
      ParameterKey: 'WikiDeletePassword',
      ParameterValue: process.env.DELETE_PASSWORD,
    }, {
      ParameterKey: 'ImageVersion',
      ParameterValue: randomString,
    }],
    ['CAPABILITY_NAMED_IAM'],
  );

  await updateLambda();
}

main().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
