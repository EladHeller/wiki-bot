// eslint-disable-next-line import/no-extraneous-dependencies
import {
  CloudFormation, Parameter, Capability,
  waitUntilStackUpdateComplete, waitUntilStackCreateComplete,
} from '@aws-sdk/client-cloudformation';
import 'dotenv/config';
import fs from 'fs/promises';

import { exec } from 'child_process';

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

  await new Promise((resolve, reject) => {
    exec('sh ./build/deploy.sh', (error, stdout, stderr) => {
      console.log(error, stdout, stderr);
      if (error) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });

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
      ParameterKey: 'WikiBaseUserName',
      ParameterValue: process.env.BASE_USER_NAME,
    }, {
      ParameterKey: 'WikiBasePassword',
      ParameterValue: process.env.BASE_PASSWORD,
    },
    {
      ParameterKey: 'WikiDeleteUserName',
      ParameterValue: process.env.DELETE_USER_NAME,
    }, {
      ParameterKey: 'WikiDeletePassword',
      ParameterValue: process.env.DELETE_PASSWORD,
    }],
    ['CAPABILITY_NAMED_IAM'],
  );
}

main().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
