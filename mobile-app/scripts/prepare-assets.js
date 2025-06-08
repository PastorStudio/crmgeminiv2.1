const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Create basic placeholder images if they don't exist
const createPlaceholderImage = (name, size, backgroundColor = '#10b981') => {
  const filePath = path.join(assetsDir, name);
  
  if (!fs.existsSync(filePath)) {
    // Create a simple SVG as placeholder
    const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${backgroundColor}"/>
  <text x="50%" y="50%" text-anchor="middle" dy="0.3em" fill="white" font-family="Arial" font-size="${size/8}">CRM</text>
</svg>`;
    
    // For now, create a simple text file as placeholder
    fs.writeFileSync(filePath.replace('.png', '.svg'), svg);
    console.log(`Created placeholder: ${name.replace('.png', '.svg')}`);
  }
};

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create placeholder assets
createPlaceholderImage('icon.png', 1024);
createPlaceholderImage('adaptive-icon.png', 1024);
createPlaceholderImage('splash.png', 1284);
createPlaceholderImage('favicon.png', 48);

console.log('Asset preparation completed!');
console.log('Note: Replace SVG placeholders with actual PNG images for production.');