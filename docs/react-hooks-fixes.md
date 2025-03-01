# React Hooks Usage Best Practices

This document outlines the best practices for using React hooks in the ChatSheetAI application, along with details about the fixes that were implemented to address inconsistent hook usage.

## Background

The application was experiencing the "Rendered more hooks than during the previous render" error, which occurs when the number of hooks called during a render changes between renders. This typically happens when hooks are called conditionally or in loops, which violates the Rules of Hooks.

## Issues Identified

1. **Inconsistent Hook Usage Patterns**

   - Some components used direct hook imports (`useState`, `useEffect`)
   - Other components used the React namespace (`React.useState`, `React.useEffect`)
   - Some components mixed both patterns

2. **Conditional Hook Calls**

   - Some components had hooks that were only called under certain conditions
   - This violates the Rules of Hooks and can lead to unpredictable behavior

3. **Hook Order Issues**
   - In some cases, hooks were not called in the same order on every render
   - This can cause state to become misaligned with the component's expectations

## Fixes Implemented

1. **Standardized Hook Usage Patterns**

   - All components now use a consistent pattern for hook calls
   - We standardized on using the React namespace (`React.useEffect`, `React.useState`, etc.)
   - This makes the code more consistent and easier to maintain

2. **Fixed Conditional Hook Calls**

   - Moved all hook calls to the top level of the component
   - Ensured hooks are called unconditionally
   - Used early returns or conditional rendering instead of conditional hook calls

3. **Created a Hook Checking Tool**
   - Implemented a script (`scripts/fix-react-hooks.js`) to automatically detect and fix inconsistent hook usage
   - This tool can be run periodically to ensure consistent hook usage across the codebase

## Best Practices for React Hooks

1. **Always Call Hooks at the Top Level**

   - Don't call hooks inside loops, conditions, or nested functions
   - This ensures that hooks are called in the same order on every render

   ```jsx
   // ❌ Bad: Conditional hook call
   if (condition) {
     useEffect(() => {
       // ...
     }, []);
   }

   // ✅ Good: Conditional effect inside the hook
   useEffect(() => {
     if (condition) {
       // ...
     }
   }, [condition]);
   ```

2. **Use a Consistent Pattern for Hook Calls**

   - Stick to either direct imports or the React namespace throughout the codebase
   - In this project, we standardized on using the React namespace

   ```jsx
   // Our standard approach
   React.useEffect(() => {
     // ...
   }, []);

   // Instead of
   useEffect(() => {
     // ...
   }, []);
   ```

3. **Always Include All Dependencies in the Dependency Array**

   - For `useEffect`, `useCallback`, and `useMemo`, include all values from the component scope that are used inside the hook
   - This prevents stale closures and ensures the hook updates when its dependencies change

   ```jsx
   // ✅ Good: All dependencies included
   React.useEffect(() => {
     fetchData(userId, filters);
   }, [userId, filters, fetchData]);
   ```

4. **Use Custom Hooks to Encapsulate Complex Logic**

   - Extract complex hook logic into custom hooks
   - This improves readability and reusability

   ```jsx
   // Custom hook example
   function useSheetData(sheetId) {
     const [data, setData] = React.useState(null);
     const [isLoading, setIsLoading] = React.useState(true);
     const [error, setError] = React.useState(null);

     React.useEffect(() => {
       // Fetch data logic
     }, [sheetId]);

     return { data, isLoading, error };
   }
   ```

5. **Use the Hook Checking Tool**
   - Run `node scripts/fix-react-hooks.js` to check for inconsistent hook usage
   - Fix any issues reported by the tool

## Components Fixed

1. **SheetViewer Component**

   - Standardized on using `React.useEffect` and `React.useCallback`
   - Fixed inconsistent hook usage in the `ResizableHeader` component

2. **Sidebar Component**

   - Ensured consistent use of React namespace for hooks

3. **Carousel Component**
   - Already had consistent hook usage with React namespace

## Conclusion

By implementing these fixes and following the best practices outlined in this document, we've addressed the "Rendered more hooks than during the previous render" error and improved the overall stability of the application. Consistent hook usage patterns make the code more maintainable and reduce the likelihood of hook-related bugs in the future.
