/**
 * Configuración avanzada para Puppeteer que funciona en entornos restrictivos como Replit
 */
const puppeteer = require('puppeteer-extra');
const { Browser } = require('puppeteer-core');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

// Importar Playwright solo si está disponible
let chromium;
try {
  const playwright = require('playwright');
  chromium = playwright.chromium;
} catch (error) {
  console.log("Playwright no está disponible:", error.message);
  chromium = null;
}

// Añadir plugins de Puppeteer
puppeteer.use(StealthPlugin());

// Detectar el entorno de Replit
const IS_REPLIT = process.env.REPLIT_OWNER !== undefined;
console.log("Detectado entorno Replit, usando configuración especial...");

// Encontrar la ruta del ejecutable de Chromium
function findChromiumPath() {
  try {
    // Verificar si chromium está instalado usando which
    const chromiumPath = child_process.execSync('which chromium').toString().trim();
    if (chromiumPath && fs.existsSync(chromiumPath)) {
      console.log(`Chromium encontrado en: ${chromiumPath}`);
      return chromiumPath;
    }
  } catch (error) {
    console.log("No se encontró chromium usando 'which chromium'");
  }
  
  // Rutas comunes donde se puede encontrar chromium
  const possiblePaths = [
    '/nix/store/chromium/bin/chromium',
    '/nix/store/*/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/nix/store/*/chromium/bin/chromium'
  ];
  
  for (const pattern of possiblePaths) {
    try {
      if (pattern.includes('*')) {
        // Para patrones con comodín, usamos find
        const findCommand = `find ${pattern.split('*')[0]} -path "${pattern}" -type f 2>/dev/null | head -1`;
        const foundPath = child_process.execSync(findCommand).toString().trim();
        if (foundPath && fs.existsSync(foundPath)) {
          console.log(`Chromium encontrado en: ${foundPath}`);
          return foundPath;
        }
      } else if (fs.existsSync(pattern)) {
        console.log(`Chromium encontrado en: ${pattern}`);
        return pattern;
      }
    } catch (error) {
      // Ignorar errores al buscar
    }
  }
  
  // Buscar en todo el sistema usando 'find'
  try {
    const findCommand = 'find /nix/store -name "chromium" -type f -executable 2>/dev/null | head -1';
    const foundPath = child_process.execSync(findCommand).toString().trim();
    if (foundPath && fs.existsSync(foundPath)) {
      console.log(`Chromium encontrado en: ${foundPath}`);
      return foundPath;
    }
  } catch (error) {
    console.log("No se pudo encontrar chromium usando búsqueda en /nix/store");
  }
  
  return null;
}

// Obtener la ruta de Chromium
const chromiumPath = findChromiumPath();

// Opciones para Puppeteer en entorno Replit
const PUPPETEER_OPTIONS = {
  headless: true,
  executablePath: chromiumPath,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1280,720',
  ],
  ignoreHTTPSErrors: true,
  defaultViewport: {
    width: 1280,
    height: 720
  }
};

// Opciones para Playwright en entorno Replit
const PLAYWRIGHT_OPTIONS = {
  headless: true,
  ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
  ]
};

/**
 * Crea una configuración de puppeteer optimizada para el entorno actual
 */
export async function createBrowser() {
  console.log("Intentando iniciar navegador con la siguiente configuración:", {
    chromiumPath,
    isPuppeteerAvailable: !!puppeteer,
    isPlaywrightAvailable: !!chromium,
  });

  try {
    // Intentar iniciar Puppeteer con la ruta de chromium encontrada
    try {
      if (!chromiumPath) {
        console.log("No se encontró una ruta válida para Chromium. Verificando instalación...");
        // Mostrar información sobre Chromium instalado
        try {
          const chromiumVersion = child_process.execSync('chromium --version').toString().trim();
          console.log(`Versión de Chromium instalada: ${chromiumVersion}`);
        } catch (e) {
          console.log("No se pudo obtener la versión de Chromium");
        }
      }
      
      console.log("Iniciando Puppeteer con las siguientes opciones:", JSON.stringify(PUPPETEER_OPTIONS));
      const browser = await puppeteer.launch(PUPPETEER_OPTIONS);
      console.log("Navegador iniciado correctamente con puppeteer-extra");
      return browser;
    } catch (puppeteerError) {
      console.error("Error al iniciar navegador con puppeteer-extra:", puppeteerError);
      console.log("Intentando alternativa con puppeteer regular...");
      
      try {
        // Importar puppeteer regular si falla puppeteer-extra
        const regularPuppeteer = require('puppeteer');
        const browser = await regularPuppeteer.launch(PUPPETEER_OPTIONS);
        console.log("Navegador iniciado con puppeteer regular");
        return browser;
      } catch (regularPuppeteerError) {
        console.error("Error al iniciar navegador con puppeteer regular:", regularPuppeteerError);
        throw new Error("No se pudo iniciar el navegador con Puppeteer");
      }
    }
  } catch (error) {
    console.log("Fallaron todos los intentos con Puppeteer, intentando usar playwright...");
    
    try {
      // Intentar usar Playwright si todo lo anterior falla
      console.log("Iniciando Playwright con las siguientes opciones:", JSON.stringify(PLAYWRIGHT_OPTIONS));
      const browser = await chromium.launch(PLAYWRIGHT_OPTIONS);
      console.log("Navegador iniciado correctamente con playwright");
      // Devolver un proxy que convierte la API de Playwright a la API de Puppeteer
      return {
        newPage: async () => {
          const page = await browser.newPage();
          // Agregar métodos de compatibilidad
          return {
            ...page,
            goto: page.goto.bind(page),
            waitForSelector: page.waitForSelector.bind(page),
            $: page.$.bind(page),
            $$: page.$$.bind(page),
            evaluate: page.evaluate.bind(page),
            screenshot: page.screenshot.bind(page),
            close: page.close.bind(page),
            // Más métodos según sea necesario
          };
        },
        close: async () => {
          await browser.close();
        },
        // Otros métodos necesarios
      };
    } catch (playwrightError) {
      console.error("Error al iniciar navegador con playwright:", playwrightError);
      
      // Mostrar información de depuración adicional
      console.log("Información de depuración adicional:");
      try {
        const which = child_process.execSync('which chromium').toString().trim();
        console.log(`which chromium: ${which}`);
      } catch (e) {
        console.log("which chromium: No encontrado");
      }
      
      try {
        const ls = child_process.execSync('ls -l /nix/store/*chromium*/bin/chromium 2>/dev/null || echo "No encontrado"').toString();
        console.log(`Chromium en /nix/store: ${ls}`);
      } catch (e) {
        console.log("Error al buscar en /nix/store");
      }
      
      throw new Error("No se pudo iniciar el navegador con ningún método");
    }
  }
}