import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  goal: string;
  message?: string;
  consent: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: CustomerData = await request.json();
    
    // Validate required fields
    if (!body.name || !body.email || !body.phone || !body.consent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone format (Indian phone numbers)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(body.phone.replace(/[\s\-\(\)]/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Generate unique customer ID
    const customerId = uuidv4();
    const timestamp = new Date().toISOString();

    // Prepare data for DynamoDB
    const customerData = {
      customerId,
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      phone: body.phone.replace(/[\s\-\(\)]/g, ''),
      goal: body.goal,
      message: body.message?.trim() || '',
      consent: body.consent,
      status: 'new',
      createdAt: timestamp,
      updatedAt: timestamp,
      source: 'website_form'
    };

    // Save to DynamoDB
    const command = new PutCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'vijay-malik-customers',
      Item: customerData,
    });

    await docClient.send(command);

    // Send email notification (optional - you can integrate with SES)
    // await sendNotificationEmail(customerData);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Thank you! We will contact you within 24 hours.',
        customerId 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error saving customer data:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET method to retrieve customer data (for admin use)
export async function GET() {
  // This would be for admin dashboard - implement authentication
  return NextResponse.json({ message: 'GET method not implemented' }, { status: 405 });
}
