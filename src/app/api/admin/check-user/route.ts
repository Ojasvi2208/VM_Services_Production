import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/postgres-db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, created_at, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        exists: false, 
        message: 'User not found' 
      });
    }
    
    const user = result.rows[0];
    return NextResponse.json({
      exists: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        createdAt: user.created_at,
        isActive: user.is_active
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
