#!/usr/bin/env node

/**
 * Script to fix React hooks usage patterns in the codebase
 * 
 * This script standardizes React hook usage patterns to prevent the
 * "Rendered more hooks than during the previous render" error.
 * 
 * Usage:
 *   node scripts/fix-react-hooks.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// ANSI color codes for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Fix React hooks in a file
 * @param {string} filePath - Path to the file to fix
 * @param {boolean} dryRun - If true, don't actually modify the file
 * @returns {Object} - Statistics about the fixes
 */
function fixReactHooksInFile(filePath, dryRun = false) {
  console.log(`${colors.bright}Analyzing ${filePath}${colors.reset}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Track statistics
  const stats = {
    reactUseEffectCount: 0,
    reactUseStateCount: 0,
    reactUseCallbackCount: 0,
    reactUseMemoCount: 0,
    useEffectCount: 0,
    useStateCount: 0,
    useCallbackCount: 0,
    useMemoCount: 0,
    fixedCount: 0
  };
  
  // Count occurrences before fixing
  stats.reactUseEffectCount = (content.match(/React\.useEffect/g) || []).length;
  stats.reactUseStateCount = (content.match(/React\.useState/g) || []).length;
  stats.reactUseCallbackCount = (content.match(/React\.useCallback/g) || []).length;
  stats.reactUseMemoCount = (content.match(/React\.useMemo/g) || []).length;
  
  stats.useEffectCount = (content.match(/\buseEffect\b/g) || []).length - stats.reactUseEffectCount;
  stats.useStateCount = (content.match(/\buseState\b/g) || []).length - stats.reactUseStateCount;
  stats.useCallbackCount = (content.match(/\buseCallback\b/g) || []).length - stats.reactUseCallbackCount;
  stats.useMemoCount = (content.match(/\buseMemo\b/g) || []).length - stats.reactUseMemoCount;
  
  // Determine the dominant pattern
  const reactNamespaceCount = stats.reactUseEffectCount + stats.reactUseStateCount + 
                             stats.reactUseCallbackCount + stats.reactUseMemoCount;
  
  const importedHooksCount = stats.useEffectCount + stats.useStateCount + 
                            stats.useCallbackCount + stats.useMemoCount;
  
  // If the file has a mix of patterns, standardize on the dominant one
  if (reactNamespaceCount > 0 && importedHooksCount > 0) {
    if (reactNamespaceCount >= importedHooksCount) {
      // Standardize on React namespace pattern
      console.log(`${colors.yellow}Standardizing on React namespace pattern${colors.reset}`);
      
      // Check if hooks are imported
      const hasImportedUseEffect = content.includes('import { useEffect') || content.includes('import {useEffect');
      const hasImportedUseState = content.includes('import { useState') || content.includes('import {useState');
      const hasImportedUseCallback = content.includes('import { useCallback') || content.includes('import {useCallback');
      const hasImportedUseMemo = content.includes('import { useMemo') || content.includes('import {useMemo');
      
      // Replace direct hook calls with React namespace calls
      if (hasImportedUseEffect) {
        content = content.replace(/\buseEffect\(/g, 'useEffect(');
        stats.fixedCount += stats.useEffectCount;
      }
      
      if (hasImportedUseState) {
        content = content.replace(/\buseState\(/g, 'useState(');
        stats.fixedCount += stats.useStateCount;
      }
      
      if (hasImportedUseCallback) {
        content = content.replace(/\buseCallback\(/g, 'useCallback(');
        stats.fixedCount += stats.useCallbackCount;
      }
      
      if (hasImportedUseMemo) {
        content = content.replace(/\buseMemo\(/g, 'useMemo(');
        stats.fixedCount += stats.useMemoCount;
      }
      
      // Update imports if needed
      content = content.replace(/import\s*{([^}]*)useEffect([^}]*)}/, 'import {$1$2}');
      content = content.replace(/import\s*{([^}]*)useState([^}]*)}/, 'import {$1$2}');
      content = content.replace(/import\s*{([^}]*)useCallback([^}]*)}/, 'import {$1$2}');
      content = content.replace(/import\s*{([^}]*)useMemo([^}]*)}/, 'import {$1$2}');
      
      // Clean up empty imports
      content = content.replace(/import\s*{\s*}\s*from\s*['"]react['"];?/, '');
      
      // Ensure React is imported
      if (!content.includes('import React')) {
        content = content.replace(/import\s+{([^}]*)}\s+from\s+['"]react['"];?/, 'import React, { $1, useEffect, useState, useCallback, useMemo } from "react";');
        if (!content.includes('import React')) {
          content = 'import React from "react";\n' + content;
        }
      }
    } else {
      // Standardize on imported hooks pattern
      console.log(`${colors.yellow}Standardizing on imported hooks pattern${colors.reset}`);
      
      // Replace React namespace calls with direct hook calls
      content = content.replace(/React\.useEffect\(/g, 'useEffect(');
      content = content.replace(/React\.useState\(/g, 'useState(');
      content = content.replace(/React\.useCallback\(/g, 'useCallback(');
      content = content.replace(/React\.useMemo\(/g, 'useMemo(');
      
      stats.fixedCount += stats.reactUseEffectCount + stats.reactUseStateCount + 
                         stats.reactUseCallbackCount + stats.reactUseMemoCount;
      
      // Update imports if needed
      const hasUseEffect = content.includes('useEffect(');
      const hasUseState = content.includes('useState(');
      const hasUseCallback = content.includes('useCallback(');
      const hasUseMemo = content.includes('useMemo(');
      
      // Check if React is imported
      const reactImportMatch = content.match(/import\s+React\s*,?\s*{?([^}]*)}?\s+from\s+['"]react['"];?/);
      
      if (reactImportMatch) {
        let importedHooks = reactImportMatch[1] || '';
        
        // Add missing hooks to import
        if (hasUseEffect && !importedHooks.includes('useEffect')) {
          importedHooks += importedHooks ? ', useEffect' : 'useEffect';
        }
        
        if (hasUseState && !importedHooks.includes('useState')) {
          importedHooks += importedHooks ? ', useState' : 'useState';
        }
        
        if (hasUseCallback && !importedHooks.includes('useCallback')) {
          importedHooks += importedHooks ? ', useCallback' : 'useCallback';
        }
        
        if (hasUseMemo && !importedHooks.includes('useMemo')) {
          importedHooks += importedHooks ? ', useMemo' : 'useMemo';
        }
        
        // Update the import statement
        if (importedHooks) {
          content = content.replace(
            /import\s+React\s*,?\s*{?([^}]*)}?\s+from\s+['"]react['"];?/,
            `import React, { ${importedHooks} } from "react";`
          );
        }
      } else if (content.includes('import React from "react"')) {
        // React is imported without destructuring
        let hooksToImport = [];
        
        if (hasUseEffect) hooksToImport.push('useEffect');
        if (hasUseState) hooksToImport.push('useState');
        if (hasUseCallback) hooksToImport.push('useCallback');
        if (hasUseMemo) hooksToImport.push('useMemo');
        
        if (hooksToImport.length > 0) {
          content = content.replace(
            /import\s+React\s+from\s+['"]react['"];?/,
            `import React, { ${hooksToImport.join(', ')} } from "react";`
          );
        }
      }
    }
  }
  
  // Write the changes if content was modified and not in dry run mode
  if (content !== originalContent && !dryRun) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${colors.green}✓ Fixed React hooks in ${filePath}${colors.reset}`);
  } else if (content !== originalContent) {
    console.log(`${colors.yellow}Would fix React hooks in ${filePath} (dry run)${colors.reset}`);
  } else {
    console.log(`${colors.dim}No changes needed in ${filePath}${colors.reset}`);
  }
  
  return stats;
}

/**
 * Find and fix React hooks in all TypeScript and JavaScript files in a directory
 * @param {string} dir - Directory to search
 * @param {boolean} dryRun - If true, don't actually modify files
 * @returns {Object} - Statistics about the fixes
 */
function findAndFixReactHooks(dir, dryRun = false) {
  const stats = {
    filesAnalyzed: 0,
    filesFixed: 0,
    totalFixedCount: 0
  };
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .git directories
      if (file !== 'node_modules' && file !== '.git') {
        const subStats = findAndFixReactHooks(filePath, dryRun);
        stats.filesAnalyzed += subStats.filesAnalyzed;
        stats.filesFixed += subStats.filesFixed;
        stats.totalFixedCount += subStats.totalFixedCount;
      }
    } else if (
      (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.js')) &&
      !file.endsWith('.d.ts')
    ) {
      stats.filesAnalyzed++;
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Only process files that contain React hooks
        if (
          fileContent.includes('useEffect') ||
          fileContent.includes('useState') ||
          fileContent.includes('useCallback') ||
          fileContent.includes('useMemo')
        ) {
          const fileStats = fixReactHooksInFile(filePath, dryRun);
          
          if (fileStats.fixedCount > 0) {
            stats.filesFixed++;
            stats.totalFixedCount += fileStats.fixedCount;
          }
        }
      } catch (error) {
        console.error(`${colors.red}Error processing ${filePath}:${colors.reset}`, error);
      }
    }
  }
  
  return stats;
}

// Main execution
console.log(`${colors.bright}${colors.cyan}=== React Hooks Standardization Tool ====${colors.reset}\n`);

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

if (dryRun) {
  console.log(`${colors.yellow}Running in dry run mode - no files will be modified${colors.reset}\n`);
}

// Start the analysis
console.log(`${colors.bright}Analyzing React hooks usage in ${rootDir}${colors.reset}\n`);

const startTime = Date.now();
const stats = findAndFixReactHooks(rootDir, dryRun);
const endTime = Date.now();

// Print summary
console.log(`\n${colors.bright}${colors.cyan}=== Summary ====${colors.reset}`);
console.log(`${colors.bright}Files analyzed:${colors.reset} ${stats.filesAnalyzed}`);
console.log(`${colors.bright}Files fixed:${colors.reset} ${stats.filesFixed}`);
console.log(`${colors.bright}Total hooks standardized:${colors.reset} ${stats.totalFixedCount}`);
console.log(`${colors.bright}Time taken:${colors.reset} ${(endTime - startTime) / 1000}s`);

if (stats.filesFixed > 0) {
  console.log(`\n${colors.green}✓ Successfully standardized React hooks usage in ${stats.filesFixed} files${colors.reset}`);
} else {
  console.log(`\n${colors.yellow}No files needed fixing${colors.reset}`);
}

// Provide next steps
console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
console.log(`1. Run tests to verify that the changes didn't break anything`);
console.log(`2. Check for any remaining React hooks issues manually`);
console.log(`3. Consider adding a linting rule to enforce consistent hook usage`);