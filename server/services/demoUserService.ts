import { db } from '../db';
import { demoUsers, users } from '@shared/schema';
import { eq, max } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export class DemoUserService {
  private static readonly PASSWORD = 'demo123456';
  private static readonly EXPIRY_DAYS = 3;

  // Generate next sequential demo number
  private static async getNextDemoNumber(): Promise<string> {
    try {
      // Get the highest demo number currently in use
      const result = await db
        .select({ maxId: max(demoUsers.demoNumber) })
        .from(demoUsers);
      
      const highestNumber = result[0]?.maxId || 0;
      const nextNumber = highestNumber + 1;
      
      // Format as 5-digit number with leading zeros
      return nextNumber.toString().padStart(5, '0');
    } catch (error) {
      console.error('Error getting next demo number:', error);
      return '00001'; // Default to first number if error
    }
  }

  // Generate demo username with sequential number
  private static generateDemoUsername(name: string, demoNumber: string): string {
    // Clean the name: remove spaces, special chars, convert to lowercase
    const cleanName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    return `demo_${cleanName}_${demoNumber}`;
  }

  // Create new demo user with sequential numbering
  static async createDemoUser(customerName: string): Promise<{ username: string; password: string; demoUser: any }> {
    try {
      const demoNumber = await this.getNextDemoNumber();
      const username = this.generateDemoUsername(customerName, demoNumber);
      const hashedPassword = await bcrypt.hash(this.PASSWORD, 10);
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.EXPIRY_DAYS);

      // Create demo user
      const [demoUser] = await db
        .insert(demoUsers)
        .values({
          username,
          customerName,
          password: hashedPassword,
          demoNumber: parseInt(demoNumber),
          expiresAt,
          status: 'active',
          loginCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Also create in users table for compatibility
      await db
        .insert(users)
        .values({
          username,
          email: `${username}@demo.local`,
          password: hashedPassword,
          firstName: customerName.split(' ')[0] || customerName,
          lastName: customerName.split(' ').slice(1).join(' ') || '',
          role: 'demo',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

      console.log(`✅ Created demo user: ${username} (Demo #${demoNumber})`);

      return {
        username,
        password: this.PASSWORD,
        demoUser
      };
    } catch (error) {
      console.error('Error creating demo user:', error);
      throw new Error('Failed to create demo user');
    }
  }

  // Create multiple demo users for testing
  static async createMultipleDemoUsers(names: string[]): Promise<any[]> {
    const results = [];
    
    for (const name of names) {
      try {
        const result = await this.createDemoUser(name);
        results.push(result);
      } catch (error) {
        console.error(`Failed to create demo user for ${name}:`, error);
      }
    }
    
    return results;
  }

  // Get all active demo users
  static async getActiveDemoUsers(): Promise<any[]> {
    return await db
      .select()
      .from(demoUsers)
      .where(eq(demoUsers.status, 'active'))
      .orderBy(demoUsers.demoNumber);
  }

  // Check if demo user exists by username
  static async getDemoUserByUsername(username: string): Promise<any | null> {
    const [user] = await db
      .select()
      .from(demoUsers)
      .where(eq(demoUsers.username, username));
    
    return user || null;
  }

  // Authenticate demo user
  static async authenticateDemoUser(username: string, password: string): Promise<any | null> {
    try {
      const demoUser = await this.getDemoUserByUsername(username);
      
      if (!demoUser) {
        return null;
      }

      // Check if expired
      if (new Date() > new Date(demoUser.expiresAt)) {
        return null;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, demoUser.password);
      if (!isPasswordValid) {
        return null;
      }

      // Update login stats
      await db
        .update(demoUsers)
        .set({
          lastLoginAt: new Date(),
          loginCount: demoUser.loginCount + 1,
          updatedAt: new Date()
        })
        .where(eq(demoUsers.id, demoUser.id));

      return demoUser;
    } catch (error) {
      console.error('Error authenticating demo user:', error);
      return null;
    }
  }
}