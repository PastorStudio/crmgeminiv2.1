#!/usr/bin/env node

/**
 * Script de validación para el despliegue en Hostinger
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Validando configuración de despliegue...\n');

// Verificar archivos esenciales
const requiredFiles = [
  'package.json',
  'vite.config.ts',
  'drizzle.config.ts',
  'server/index.ts',
  'client/src/App.tsx',
  'shared/schema.ts'
];

console.log('📁 Verificando archivos esenciales:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - FALTANTE`);
  }
});

// Verificar dependencias de producción
console.log('\n📦 Verificando package.json:');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const productionDeps = [
    'express',
    'drizzle-orm',
    '@neondatabase/serverless',
    'vite',
    'react',
    'react-dom'
  ];
  
  productionDeps.forEach(dep => {
    if (pkg.dependencies && pkg.dependencies[dep]) {
      console.log(`  ✅ ${dep}: ${pkg.dependencies[dep]}`);
    } else {
      console.log(`  ❌ ${dep} - NO ENCONTRADO`);
    }
  });
} catch (error) {
  console.log('  ❌ Error leyendo package.json');
}

// Verificar scripts de despliegue
console.log('\n🚀 Verificando scripts de despliegue:');
const deploymentFiles = [
  'deploy-hostinger.sh',
  'HOSTINGER_DEPLOYMENT_GUIDE.md',
  'HOSTINGER_QUICKSTART.md'
];

deploymentFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - FALTANTE`);
  }
});

// Verificar configuración móvil
console.log('\n📱 Verificando configuración móvil:');
const mobileFiles = [
  'mobile-app/package.json',
  'mobile-app/app.json',
  'mobile-app/eas.json',
  'mobile-app/src/services/ApiService.js'
];

mobileFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - FALTANTE`);
  }
});

console.log('\n✅ Validación completada');
console.log('\n📋 Próximos pasos para Hostinger:');
console.log('1. Ejecutar: ./deploy-hostinger.sh');
console.log('2. Subir whatsapp-crm-hostinger.tar.gz a Hostinger');
console.log('3. Configurar base de datos PostgreSQL');
console.log('4. Configurar Node.js App en panel de Hostinger');
console.log('5. Actualizar mobile app con dominio de producción');