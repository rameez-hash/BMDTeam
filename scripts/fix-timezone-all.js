const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(full);
    }
  });
  return results;
}

let totalFixes = 0;

// Fix server-side API routes
const apiFiles = walk('app/api');
apiFiles.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  // Fix .toISOString().slice(0, 10) → formatDate(x) 
  // and .toISOString().split('T')[0] → formatDate(x)
  const isoSliceRegex = /(\w+(?:\.\w+)*)\.toISOString\(\)\.slice\(0,\s*10\)/g;
  const isoSplitRegex = /(\w+(?:\.\w+)*)\.toISOString\(\)\.split\('T'\)\[0\]/g;
  
  // Only fix if not already importing formatDate, add import if needed
  if (isoSliceRegex.test(content) || isoSplitRegex.test(content)) {
    // Add formatDate import if not present
    if (!content.includes('formatDate') && !content.includes("from '@/lib/utils'")) {
      content = content.replace(
        /^(export const dynamic[^\n]*\n\n)/m,
        "$1import { formatDate } from '@/lib/utils';\n"
      );
    } else if (!content.includes('formatDate') && content.includes("from '@/lib/utils'")) {
      content = content.replace(
        /import \{([^}]+)\} from '@\/lib\/utils'/,
        (match, imports) => `import {${imports}, formatDate } from '@/lib/utils'`
      );
    }
    
    content = content.replace(isoSliceRegex, 'formatDate($1)');
    content = content.replace(isoSplitRegex, 'formatDate($1)');
    changed = true;
  }

  // Fix new Date(stringVar) for date-only params → parseDateUTC
  // Only for known date param variables, not for new Date() or new Date(existingDateObj)
  const dateParamVars = ['startDate', 'endDate', 'date'];
  dateParamVars.forEach(v => {
    const regex = new RegExp(`new Date\\(${v}\\)`, 'g');
    if (regex.test(content) && !content.includes('parseDateUTC')) {
      // Add parseDateUTC import
      if (!content.includes("from '@/lib/utils'")) {
        content = content.replace(
          /^(export const dynamic[^\n]*\n\n)/m,
          "$1import { parseDateUTC } from '@/lib/utils';\n"
        );
      } else if (!content.includes('parseDateUTC')) {
        content = content.replace(
          /import \{([^}]+)\} from '@\/lib\/utils'/,
          (match, imports) => `import {${imports}, parseDateUTC } from '@/lib/utils'`
        );
      }
    }
    const regex2 = new RegExp(`new Date\\(${v}\\)`, 'g');
    if (regex2.test(content)) {
      content = content.replace(regex2, `parseDateUTC(${v})`);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(f, content);
    totalFixes++;
    console.log('Fixed API:', f);
  }
});

// Fix client-side dashboard files
const dashFiles = walk('app/dashboard');
dashFiles.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  // Fix .toISOString().split('T')[0] for new Date()
  const newDateIsoSplit = /new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g;
  if (newDateIsoSplit.test(content)) {
    // Replace with local date helper inline
    content = content.replace(newDateIsoSplit, 
      '(() => { const _d = new Date(); return `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,\'0\')}-${String(_d.getDate()).padStart(2,\'0\')}`; })()');
    changed = true;
  }

  // Fix .toISOString().slice(0, 10) for new Date()
  const newDateIsoSlice = /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/g;
  if (newDateIsoSlice.test(content)) {
    content = content.replace(newDateIsoSlice,
      '(() => { const _d = new Date(); return `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,\'0\')}-${String(_d.getDate()).padStart(2,\'0\')}`; })()');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(f, content);
    totalFixes++;
    console.log('Fixed Client:', f);
  }
});

// Fix lib/utils.ts specific patterns  
const utilsFile = 'lib/utils.ts';
if (fs.existsSync(utilsFile)) {
  let content = fs.readFileSync(utilsFile, 'utf8');
  // No changes needed - already fixed parseDateUTC
}

console.log('\nTotal files fixed:', totalFixes);
