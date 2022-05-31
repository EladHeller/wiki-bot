import { CloudFormation } from 'aws-sdk'; // eslint-disable-line import/no-extraneous-dependencies
import 'dotenv/config';
import fs from 'fs/promises';

import { exec } from 'child_process';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const cf = new CloudFormation({ region });

async function runTemplate(
  templatePath: string,
  name: string,
  parameters?: CloudFormation.Parameters,
  capabilities?: CloudFormation.Capabilities,
) {
  await cf.createStack({
    StackName: name,
    TemplateBody: await fs.readFile(templatePath, 'utf-8'),
    Capabilities: capabilities,
    Parameters: parameters,
  }).promise();

  const { $response: { data, error } } = await Promise.race([
    cf.waitFor('stackCreateComplete', { StackName: name }).promise(),
    cf.waitFor('stackRollbackComplete', { StackName: name }).promise(),
  ]);
  if (error || !data
     || !['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(data.Stacks?.[0]?.StackStatus ?? '')) {
    console.log(error, data);
    throw new Error('Creation failed');
  }

  return data.Stacks?.[0].Outputs;
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
