/**
 * Standalone demo user authentication service
 * This bypasses the complex routing issues in the main server
 */

import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function authenticateDemoUser(username, password) {
  console.log('🔐 Demo auth service - Processing login for:', username);
  
  try {
    // Query for demo user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND role = $2 AND status = $3',
      [username, 'demo', 'active']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Demo user not found:', username);
      return { success: false, message: 'Credenciales inválidas' };
    }

    const user = userResult.rows[0];
    console.log('✅ Demo user found, verifying password...');

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔐 Password verification result:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Invalid password for demo user:', username);
      return { success: false, message: 'Credenciales inválidas' };
    }

    console.log('✅ Demo user authenticated successfully:', username);

    // Create auth response
    const authUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName || 'Demo User',
      email: user.email,
      role: user.role,
      isDemoUser: true
    };

    const token = `demo-token-${user.username}-${Date.now()}`;

    return {
      success: true,
      user: authUser,
      token: token,
      message: 'Demo login successful'
    };

  } catch (error) {
    console.error('❌ Demo auth service error:', error);
    return { success: false, message: 'Credenciales inválidas' };
  }
}