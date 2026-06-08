import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target source directories relative to the script location (inside final simp/SIMP web/SIMP-PROJECT-main)
const ROOT_DIR = path.resolve(__dirname, '..');
const DIRECTORIES = [
  path.join(ROOT_DIR, 'pages', 'admin_pages', 'html_files'),
  path.join(ROOT_DIR, 'pages', 'installer_pages', 'html_files'),
  path.join(ROOT_DIR, 'pages', 'customer_pages', 'html_files')
];

console.log(`Starting breakpoint unification in ROOT: ${ROOT_DIR}`);

let processedCount = 0;
let modifiedCount = 0;

function walkDir(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return;
  }
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (stat.isFile() && filePath.endsWith('.html')) {
      processedCount++;
      let content = fs.readFileSync(filePath, 'utf8');
      let original = content;
      
      // Replace media queries and JS matchMedia declarations
      // 1) Replace screen width queries
      content = content.replace(/max-width:\s*980px/gi, 'max-width: 1024px');
      content = content.replace(/max-width:\s*768px/gi, 'max-width: 1024px');
      
      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedCount++;
        console.log(`[UPDATED] Unified breakpoints in: ${path.relative(ROOT_DIR, filePath)}`);
      }
    }
  }
}

for (const dir of DIRECTORIES) {
  walkDir(dir);
}

console.log(`\nBreakpoint Unification Finished!`);
console.log(`Processed: ${processedCount} HTML files.`);
console.log(`Modified: ${modifiedCount} HTML files.`);
