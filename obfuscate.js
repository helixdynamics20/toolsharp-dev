const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const toolsDir = path.join(__dirname, 'tools');
const jsDir = path.join(__dirname, 'js');

if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir);
}

// 1. Process files in tools/
const files = fs.readdirSync(toolsDir);
files.forEach(file => {
  if (file.endsWith('.html')) {
    const filePath = path.join(toolsDir, file);
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Match inline script if it exists
    const scriptRegex = /<script\b(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/i;
    const match = html.match(scriptRegex);
    
    if (match && match[1].trim()) {
      const jsCode = match[1];
      const jsFileName = file.replace('.html', '.js');
      const jsFilePath = path.join(jsDir, jsFileName);
      
      fs.writeFileSync(jsFilePath, jsCode, 'utf8');
      html = html.replace(scriptRegex, `<script src="../js/${jsFileName}" defer></script>`);
    }

    // Encrypt the entire HTML document using Base64
    const base64Html = Buffer.from(html).toString('base64');
    const loaderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script>
const bin = atob("${base64Html}");
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) {
  bytes[i] = bin.charCodeAt(i);
}
document.write(new TextDecoder("utf-8").decode(bytes));
</script>
</head>
<body></body>
</html>`;
    
    fs.writeFileSync(filePath, loaderHtml, 'utf8');
    console.log(`Encrypted HTML: tools/${file}`);
  }
});

// 2. Process index.html in the root
const indexPath = path.join(__dirname, 'index.html');
if (fs.existsSync(indexPath)) {
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  const base64Index = Buffer.from(indexHtml).toString('base64');
  const indexLoader = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script>
const bin = atob("${base64Index}");
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) {
  bytes[i] = bin.charCodeAt(i);
}
document.write(new TextDecoder("utf-8").decode(bytes));
</script>
</head>
<body></body>
</html>`;
  
  fs.writeFileSync(indexPath, indexLoader, 'utf8');
  console.log(`Encrypted HTML: index.html`);
}

// 3. Process 404.html in the root
const path404 = path.join(__dirname, '404.html');
if (fs.existsSync(path404)) {
  let html404 = fs.readFileSync(path404, 'utf8');
  const base64_404 = Buffer.from(html404).toString('base64');
  const loader404 = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script>
const bin = atob("${base64_404}");
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) {
  bytes[i] = bin.charCodeAt(i);
}
document.write(new TextDecoder("utf-8").decode(bytes));
</script>
</head>
<body></body>
</html>`;
  
  fs.writeFileSync(path404, loader404, 'utf8');
  console.log(`Encrypted HTML: 404.html`);
}

console.log('Running obfuscator on js/ directory...');
execSync('npx -y javascript-obfuscator js/ --output js/', { stdio: 'inherit' });

// Move nested files back and clean up
try {
  execSync('Move-Item -Path js\\js\\* -Destination js -Force; Remove-Item -Path js\\js -Recurse -Force', { shell: 'powershell', stdio: 'ignore' });
} catch (e) {
  // Catch silent error if already in root
}

console.log('Obfuscation and Encryption completed successfully!');
