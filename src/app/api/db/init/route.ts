/**
 * Database Initialization Endpoint
 * Creates all required tables in PostgreSQL
 */

import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/postgres-db';

export async function GET() {
  try {
    console.log('🚀 Initializing database...');
    
    await initializeDatabase();
    
    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      tables: ['nav_history', 'funds'],
    });
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
