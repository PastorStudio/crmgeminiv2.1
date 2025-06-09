const fs = require('fs');
const path = require('path');

// Create simple base64 PNG images for the app icons
const createBasePngIcon = (size) => {
  // This is a minimal 1x1 transparent PNG in base64
  const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAKzSQ8gAAAABJRU5ErkJggg==';
  return Buffer.from(transparentPng, 'base64');
};

const assetsDir = path.join(__dirname, 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create the required PNG files
const iconFiles = [
  'icon.png',
  'adaptive-icon.png', 
  'splash.png',
  'favicon.png'
];

iconFiles.forEach(filename => {
  const filepath = path.join(assetsDir, filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, createBasePngIcon());
    console.log(`Created: ${filename}`);
  }
});

console.log('PNG icon generation completed!');