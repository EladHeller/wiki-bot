#!/usr/bin/env node
import { CloudFormationClient, ValidateTemplateCommand } from '@aws-sdk/client-cloudformation';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const templates = [
  'build/t00.cf.yaml',
  'build/t01.cf.yaml',
];

const validateTemplate = async (templatePath: string): Promise<void> => {
  const fullPath = resolve(templatePath);
  const templateBody = readFileSync(fullPath, 'utf-8');

  console.log(`\nValidating ${templatePath}...`);

  const client = new CloudFormationClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  try {
    const command = new ValidateTemplateCommand({
      TemplateBody: templateBody,
    });

    const response = await client.send(command);
    console.log(`✓ ${templatePath} is valid`);

    if (response.Parameters && response.Parameters.length > 0) {
      console.log(`  Parameters: ${response.Parameters.map((p) => p.ParameterKey).join(', ')}`);
    }
  } catch (error) {
    console.error(`✗ ${templatePath} validation failed:`);
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
    throw error;
  }
};

const main = async (): Promise<void> => {
  console.log('CloudFormation Template Validation');
  console.log('===================================');

  let hasErrors = false;

  for (const template of templates) {
    try {
      await validateTemplate(template);
    } catch {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('\n❌ CloudFormation validation failed');
    process.exit(1);
  } else {
    console.log('\n✅ All CloudFormation templates are valid');
  }
};

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
