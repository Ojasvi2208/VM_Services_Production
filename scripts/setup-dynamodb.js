#!/usr/bin/env node

/**
 * AWS DynamoDB Table Setup Script
 * This script creates the required DynamoDB table for storing customer inquiries
 * 
 * Prerequisites:
 * 1. AWS CLI configured with appropriate permissions
 * 2. Node.js installed
 * 3. AWS SDK packages installed
 * 
 * Usage: node scripts/setup-dynamodb.js
 */

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const tableName = process.env.DYNAMODB_TABLE_NAME || 'vijay-malik-customers';

const tableParams = {
  TableName: tableName,
  KeySchema: [
    {
      AttributeName: 'customerId',
      KeyType: 'HASH' // Partition key
    }
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'customerId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'email',
      AttributeType: 'S'
    },
    {
      AttributeName: 'createdAt',
      AttributeType: 'S'
    }
  ],
  BillingMode: 'PAY_PER_REQUEST', // On-demand pricing
  GlobalSecondaryIndexes: [
    {
      IndexName: 'email-index',
      KeySchema: [
        {
          AttributeName: 'email',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      }
    },
    {
      IndexName: 'created-at-index',
      KeySchema: [
        {
          AttributeName: 'createdAt',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      }
    }
  ],
  Tags: [
    {
      Key: 'Environment',
      Value: 'production'
    },
    {
      Key: 'Application',
      Value: 'vijay-malik-financial-services'
    },
    {
      Key: 'Purpose',
      Value: 'customer-inquiries'
    }
  ]
};

async function checkTableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function createTable() {
  try {
    console.log(`Checking if table '${tableName}' exists...`);
    
    const tableExists = await checkTableExists(tableName);
    
    if (tableExists) {
      console.log(`✅ Table '${tableName}' already exists!`);
      return;
    }
    
    console.log(`Creating table '${tableName}'...`);
    const result = await client.send(new CreateTableCommand(tableParams));
    
    console.log('✅ Table created successfully!');
    console.log(`Table ARN: ${result.TableDescription.TableArn}`);
    console.log(`Table Status: ${result.TableDescription.TableStatus}`);
    console.log('\n📋 Table Schema:');
    console.log('• Primary Key: customerId (String)');
    console.log('• GSI 1: email-index (email)');
    console.log('• GSI 2: created-at-index (createdAt)');
    console.log('• Billing Mode: Pay per request');
    
    console.log('\n⏳ Table is being created. It may take a few minutes to become active.');
    console.log('You can check the status in the AWS Console or use the AWS CLI:');
    console.log(`aws dynamodb describe-table --table-name ${tableName}`);
    
  } catch (error) {
    console.error('❌ Error creating table:', error);
    
    if (error.name === 'ResourceInUseException') {
      console.log(`Table '${tableName}' already exists!`);
    } else {
      process.exit(1);
    }
  }
}

// Environment validation
function validateEnvironment() {
  const required = ['AWS_REGION'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.log('Using default values...');
  }
  
  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`Table Name: ${tableName}`);
  console.log('');
}

// Main execution
async function main() {
  console.log('🚀 Vijay Malik Financial Services - DynamoDB Setup\n');
  
  validateEnvironment();
  await createTable();
  
  console.log('\n✨ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Update your .env.local file with the correct AWS credentials');
  console.log('2. Test the form submission on your website');
  console.log('3. Monitor the DynamoDB table in AWS Console for incoming data');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createTable, checkTableExists };
