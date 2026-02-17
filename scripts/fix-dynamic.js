const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(walk(full));
    } else if (file === 'route.ts') {
      results.push(full);
    }
  });
  return results;
}

const files = walk('app/api');
let fixed = 0;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (!content.includes("export const dynamic")) {
    fs.writeFileSync(f, "export const dynamic = 'force-dynamic';\n\n" + content);
    fixed++;
    console.log('Fixed:', f);
  }
});

console.log('\nDone: ' + fixed + '/' + files.length + ' files fixed');
