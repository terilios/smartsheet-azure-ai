# Carousel Component Hooks Fix

## Issue

The React hooks check script is reporting inconsistent hook usage in the `client/src/components/ui/carousel.tsx` file:

```
client/src/components/ui/carousel.tsx
  Hooks used: useState (2), useEffect (2), useCallback (4), useContext (1), React.useState (2), React.useEffect (2), React.useCallback (4), React.useContext (1)
  Issues:
    - Inconsistent hook usage (3): Inconsistent hook usage (mixing useState and React.useState)
```

However, upon inspection of the file, all React hooks are consistently using the namespace prefix (`React.useState`, `React.useEffect`, `React.useCallback`, `React.useContext`). The issue appears to be related to how the hooks check script is detecting hooks.

## Analysis

The carousel.tsx file imports React with the namespace:

```typescript
import * as React from "react";
```

And it also imports a custom hook directly:

```typescript
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
```

The hooks check script is likely detecting both:

1. The direct hook calls from the embla-carousel-react library (`useEmblaCarousel`)
2. The namespace-prefixed hook calls from React (`React.useState`, etc.)

This is causing the script to report inconsistent hook usage, even though the React hooks are being used consistently.

## Solution

There are two approaches to fix this issue:

### Option 1: Update the Hooks Check Script (Recommended)

The hooks check script should be updated to distinguish between React hooks and third-party hooks. It should only check for consistency among React hooks, not between React hooks and third-party hooks.

Here's a suggested modification to the script:

```javascript
// In scripts/check-react-hooks.js

// Add a list of known third-party hooks to exclude from the consistency check
const thirdPartyHooks = [
  "useEmblaCarousel",
  // Add other third-party hooks as needed
];

// When checking for inconsistent hook usage, exclude third-party hooks
const isReactHook = (hookName) => {
  return (
    !thirdPartyHooks.includes(hookName) &&
    (hookName.startsWith("use") || hookName.startsWith("React.use"))
  );
};

// Only compare hooks that are React hooks
const reactHooks = allHooks.filter(isReactHook);
// Check for inconsistency only among React hooks
```

### Option 2: Modify the Carousel Component

If updating the script is not an option, you can modify the carousel component to use a consistent style for all hooks, including the third-party hook:

```typescript
import * as React from "react";
import * as EmblaCarousel from "embla-carousel-react";

// Then use it with namespace prefix
const [carouselRef, api] = EmblaCarousel.useEmblaCarousel(
  {
    ...opts,
    axis: orientation === "horizontal" ? "x" : "y",
  },
  plugins
);
```

Or alternatively, import all hooks directly:

```typescript
import {
  useState,
  useEffect,
  useCallback,
  useContext,
  createContext,
  forwardRef,
} from "react";
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";

// Then use direct hook calls
const [canScrollPrev, setCanScrollPrev] = useState(false);
const [canScrollNext, setCanScrollNext] = useState(false);

const onSelect = useCallback((api: CarouselApi) => {
  // ...
}, []);
```

## Recommendation

Option 1 is recommended because:

1. The carousel component is already using a consistent style for all React hooks
2. The issue is with the detection in the hooks check script, not with the actual code
3. Modifying the script to handle third-party hooks correctly is a more general solution that will benefit other components as well

If Option 1 is not feasible, Option 2 can be implemented, but it would require more changes to the component code.

## Implementation Steps for Option 1

1. Open the `scripts/check-react-hooks.js` file
2. Add logic to distinguish between React hooks and third-party hooks
3. Update the inconsistency detection to only check among React hooks
4. Run the script again to verify that the issue is resolved

## Implementation Steps for Option 2

1. Choose one style (either all namespace-prefixed or all direct)
2. Update all hook imports and calls to use the chosen style
3. Run the hooks check script again to verify that the issue is resolved

## Conclusion

The issue reported by the hooks check script is a false positive due to the script not distinguishing between React hooks and third-party hooks. The carousel component is already using React hooks consistently with the namespace prefix. The recommended solution is to update the hooks check script to handle third-party hooks correctly.
