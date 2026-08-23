const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const toolsDir = path.join(__dirname, 'tools');
const jsDir = path.join(__dirname, 'js');

if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir);
}

// Read all files in tools/
const files = fs.readdirSync(toolsDir);

files.forEach(file => {
  if (file.endsWith('.html')) {
    const filePath = path.join(toolsDir, file);
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Match <script>...</script> (including attributes, ignoring scripts that already have src)
    const scriptRegex = /<script\b(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/i;
    const match = html.match(scriptRegex);
    
    if (match && match[1].trim()) {
      const jsCode = match[1];
      const jsFileName = file.replace('.html', '.js');
      const jsFilePath = path.join(jsDir, jsFileName);
      
      // Write the extracted JS to the js/ directory
      fs.writeFileSync(jsFilePath, jsCode, 'utf8');
      
      // Replace the inline script with a src reference
      const updatedHtml = html.replace(scriptRegex, `<script src="../js/${jsFileName}" defer></script>`);
      fs.writeFileSync(filePath, updatedHtml, 'utf8');
      
      console.log(`Extracted: ${file} -> js/${jsFileName}`);
    }
  }
});

console.log('Running obfuscator on js/ directory...');
execSync('npx -y javascript-obfuscator js/ --output js/', { stdio: 'inherit' });
console.log('Obfuscation completed successfully!');
