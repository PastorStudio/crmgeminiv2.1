/**
 * Fix WhatsApp connections and clean up session data
 */

import { db } from './server/db.js';
import { whatsappAccounts } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function fixWhatsAppConnections() {
  console.log('Fixing WhatsApp connections...');

  try {
    // Clean up all session directories
    const dirsToClean = [
      '.wwebjs_cache',
      'temp/whatsapp-accounts'
    ];

    for (const dir of dirsToClean) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`Cleaned: ${dir}`);
      }
    }

    // Create fresh directories
    fs.mkdirSync('temp/whatsapp-accounts', { recursive: true });
    fs.mkdirSync('.wwebjs_cache', { recursive: true });

    // Reset database session data
    await db.update(whatsappAccounts)
      .set({
        sessiondata: null,
        autoresponseenabled: false,
        lastactiveat: null,
        status: 'disconnected'
      })
      .where(eq(whatsappAccounts.user_id, 3));

    console.log('Database session data reset');
    console.log('WhatsApp connections are now ready for fresh authentication');

    return true;
  } catch (error) {
    console.error('Error fixing WhatsApp connections:', error);
    return false;
  }
}

fixWhatsAppConnections().then(success => {
  process.exit(success ? 0 : 1);
});