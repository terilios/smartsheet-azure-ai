/**
 * Check React Hooks consistency across files.
 * This script has been enhanced to scan a specific file ("client/src/components/ui/carousel.tsx")
 * for hook usage and then filter out known third‑party hooks (like "useEmblaCarousel") when checking for inconsistencies.
 */

import fs from 'fs';
import path from 'path';

// Simple function to scan a file for hook calls using a regex.
function scanFileForHooks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Regex matches both React namespace and direct hooks, e.g., "React.useState" or "useState"
  const hookRegex = /\b(?:React\.|)use[A-Z][A-Za-z0-9_]*/g;
  const matches = content.match(hookRegex) || [];
  // Deduplicate the matches.
  return Array.from(new Set(matches));
}

// Scan the carousel component file for hooks.
const carouselPath = path.join(process.cwd(), "client/src/components/ui/carousel.tsx");
const scannedHooks = scanFileForHooks(carouselPath);
console.log("Scanned hooks from carousel.tsx:", scannedHooks);

// For demonstration, use the scanned hooks as our allHooks array.
let allHooks = scannedHooks;

// --- New Code Patch to Ignore Third-Party Hooks ---
const thirdPartyHooks = ["useEmblaCarousel"]; // Add other third-party hooks here if needed

function isStandardReactHook(hookName) {
  if (thirdPartyHooks.includes(hookName)) return false;
  // Consider hooks starting with "use" or "React.use" as standard React hooks
  return hookName.startsWith("use") || hookName.startsWith("React.use");
}

// Filter only the standard React hooks for consistency check
const reactHooksFound = allHooks.filter(isStandardReactHook);

// Proceed with consistency checks using reactHooksFound instead of allHooks
console.log("Standard React Hooks found:", reactHooksFound);

// ... Rest of the script that would perform further validation.
