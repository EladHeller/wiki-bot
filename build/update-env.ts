/* eslint-disable import/no-extraneous-dependencies */
import {
  CloudFormation, Parameter, Capability,
  waitUntilStackUpdateComplete, waitUntilStackCreateComplete,
} from '@aws-sdk/client-cloudformation';
import fs from 'fs/promises';
import { $ } from 'zx';
import updateS3 from './update-s3';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const cf = new CloudFormation({ region });

async function runTemplate(
  templatePath: string,
  name: string,
  parameters?: Parameter[],
  capabilities?: Capability[],
): Promise<void> {
  let newStack = false;
  try {
    await cf.describeStacks({ StackName: name });
  } catch (e: any) {
    if (e.name === 'ValidationError' && e.message.includes('does not exist')) {
      newStack = true;
    } else {
      throw e;
    }
  }

  const template = await fs.readFile(templatePath, 'utf-8');
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
    } catch (e: any) {
      if (e.message === 'No updates are to be performed.') {
        console.log(`template ${name} No updates are to be performed.`);
        return;
      }
      throw e;
    }
  }

  console.log(`Waiting for ${newStack ? 'creation' : 'update'} of ${name}...`);
  const waiter = newStack ? waitUntilStackCreateComplete : waitUntilStackUpdateComplete;
  const { state, reason } = await waiter(
    { client: cf, maxWaitTime: 1000 * 60 * 30 },
    { StackName: name },
  );

  if (state !== 'SUCCESS') {
    console.log(state, reason);
    throw new Error(`${newStack ? 'Creation' : 'Update'} failed`);
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
  console.log('randomString', randomString);
  await $`sh ./build/docker-build.sh`;
  console.log('finnish docker-build!');
  await $`sh ./build/build.sh`;
  console.log('finnish build!');

  const { distVersion } = await updateS3();
  console.log('finnish deploy!');

  await runTemplate(
    './build/t01.cf.yaml',
    'wiki-bot',
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
      ParameterKey: 'OpenAPIKey',
      ParameterValue: process.env.OPENAI_API_KEY,
    }, {
      ParameterKey: 'VectorStoreID',
      ParameterValue: process.env.VECTOR_STORE_ID,
    }, {
      ParameterKey: 'ImageVersion',
      ParameterValue: randomString,
    }, {
      ParameterKey: 'DistCodeVersionId',
      ParameterValue: distVersion,
    }],
    ['CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
  );
}

main().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
