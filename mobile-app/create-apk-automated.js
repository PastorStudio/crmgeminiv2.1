#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando generación automática de APK...');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
    console.error('❌ Error: Ejecutar desde la carpeta mobile-app');
    process.exit(1);
}

// Create .easrc file for authentication
const easrc = {
    "cli": {
        "appVersionSource": "remote"
    }
};

fs.writeFileSync('.easrc', JSON.stringify(easrc, null, 2));

// Ensure all dependencies are installed
console.log('📦 Verificando dependencias...');
try {
    execSync('npm install', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ Error instalando dependencias:', error.message);
    process.exit(1);
}

// Generate the APK using expo build (legacy but works without login)
console.log('🔨 Generando APK usando Expo Build...');
console.log('⏱️  Este proceso puede tomar 15-20 minutos...');

try {
    // Use expo build:android for APK generation without EAS login requirement
    execSync('npx expo build:android --type apk --no-wait', { stdio: 'inherit' });
    
    console.log('✅ Proceso de construcción iniciado exitosamente!');
    console.log('📧 Recibirás un email con el enlace de descarga cuando esté listo');
    console.log('🔗 También puedes verificar el estado en: https://expo.dev');
    
} catch (error) {
    console.log('⚠️  El método automatizado requiere una cuenta Expo.');
    console.log('📋 Pasos para generar el APK manualmente:');
    console.log('');
    console.log('1. Crear cuenta gratuita en: https://expo.dev');
    console.log('2. Ejecutar: npx eas login');
    console.log('3. Ejecutar: npx eas build --platform android --profile preview');
    console.log('');
    console.log('💡 Alternativamente, usar Expo Go para probar la app:');
    console.log('   - Descargar Expo Go desde Play Store');
    console.log('   - Ejecutar: npm start');
    console.log('   - Escanear código QR con Expo Go');
}

console.log('');
console.log('📱 Una vez tengas el APK:');
console.log('   1. Transferir al dispositivo Android');
console.log('   2. Permitir instalación desde fuentes desconocidas');
console.log('   3. Instalar y disfrutar tu app CRM móvil!');