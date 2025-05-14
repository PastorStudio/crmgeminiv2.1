/**
 * Configuración avanzada para Puppeteer que funciona en entornos restrictivos como Replit
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Importar puppeteer-extra y plugins
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Registrar plugin de stealth para evitar detección de automatización
puppeteer.use(StealthPlugin());

// Directorio para almacenar datos temporales
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Detectar si estamos en Replit
const isReplit = process.env.REPL_ID && process.env.REPL_OWNER;

/**
 * Crea una configuración de puppeteer optimizada para el entorno actual
 */
export async function createBrowser() {
  try {
    console.log('Inicializando navegador para WhatsApp Web...');
    
    // Configuración común para todos los entornos
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,720',
        '--disable-features=Translate',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--disable-default-apps',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-first-run',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-ipc-flooding-protection',
        '--password-store=basic'
      ],
      ignoreHTTPSErrors: true,
      userDataDir: path.join(TEMP_DIR, 'puppeteer_profile')
    };
    
    if (isReplit) {
      console.log('Detectado entorno Replit, usando configuración especial...');
      
      // En Replit, usamos puppeteer-core con opciones especiales
      const { default: puppeteerCore } = await import('puppeteer-core');
      
      // Verifica si hay un ejecutable de Chrome en la ruta estándar de Replit
      const possiblePaths = [
        '/nix/store/f14i5yyg6mq6d7nqnby1v6jyj1naz9cp-chromium-unwrapped-117.0.5938.132/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
      ];
      
      let executablePath = '';
      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          executablePath = path;
          console.log(`Encontrado Chrome en: ${path}`);
          break;
        }
      }
      
      if (!executablePath) {
        console.log('No se encontró Chrome, intentando usar playwright...');
        // Intentar usar playwright como alternativa
        try {
          const { chromium } = await import('playwright-core');
          const browserType = chromium;
          return await browserType.launch({
            headless: true,
            args: launchOptions.args
          });
        } catch (e) {
          console.error('Error al iniciar navegador con playwright:', e);
          throw new Error('No se pudo iniciar el navegador con Playwright');
        }
      }
      
      return await puppeteerCore.launch({
        ...launchOptions,
        executablePath,
      });
    } else {
      // En otros entornos, usamos puppeteer normal
      return await puppeteer.launch(launchOptions);
    }
  } catch (error) {
    console.error('Error al inicializar navegador:', error);
    throw error;
  }
}

export default {
  createBrowser
};