# Smartsheet Azure AI Integration

## Overview

This project is a full-stack application that integrates Smartsheet with Azure AI. It combines a feature-rich chat interface and robust Smartsheet interaction capabilities to deliver real-time data insights and AI-powered responses. The project leverages modern web technologies with a React-based client and a Node.js/TypeScript backend.

## Features

- **Chat Interface:** Interact with an AI-powered chat built with React.
- **Smartsheet Integration:** View, update, and manage Smartsheet data directly through the application.
- **Azure OpenAI Integration:** Utilize Azure OpenAI for generating intelligent responses.
- **Responsive Design:** A custom-built UI library with components such as modals, accordions, dialogs, and more.
- **Full-Stack Architecture:** A clear separation between the client-side (React, Vite) and server-side (Node.js, Express/TypeScript) components.
- **Configuration Flexibility:** Environment variables support for API keys and tokens.

## File Structure

- **Root Files:**
  - `.gitignore` – Specifies files and directories to be ignored by Git.
  - `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `drizzle.config.ts`, `theme.json` – Configuration files for TypeScript, Vite, Tailwind CSS, PostCSS, and application theming.
- **Client:** Located in the `client/` directory.
  - `index.html` – The main HTML entry point.
  - `src/` – Contains the React application.
    - `App.tsx` – The root React component.
    - `main.tsx` – Entry point for the React application.
    - `components/` – Houses various UI components including chat and Smartsheet-specific components.
    - `hooks/`, `lib/`, and `pages/` – Custom React hooks, library functions, and different page components.
- **Server:** Located in the `server/` directory.
  - `index.ts`, `routes.ts` – Entry point and route definitions for the backend.
  - `db.ts`, `storage.ts` – Database and storage configuration.
  - `tools/smartsheet.ts` – Backend tools for handling Smartsheet integration.
  - `vite.ts` – Server-side Vite configuration.
- **Shared:** Located in the `shared/` directory.
  - `schema.ts` – Shared schema definitions and utility types.
- **Attached Assets:** The `attached_assets/` directory includes various example guides and assets related to integration and debugging.

## Installation

1. **Clone the Repository**

   ```
   git clone <repository-url>
   ```

2. **Navigate to the Project Directory**

   ```
   cd /Users/timothydriscoll/Documents/GitHub/smartsheet-azure-ai
   ```

3. **Install Dependencies**
   ```
   npm install
   ```

## Running the Application

- **Development Mode:**

  ```
  npm run dev
  ```

  Runs both the client and server with live reload capabilities.

- **Production Build:**
  ```
  npm run build
  ```
  Builds the client for production deployment. Make sure to properly configure environment variables before building.

## Environment Variables

Create a `.env` file in the project root to define environment-specific variables. For example:

```
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
SMARTSHEET_API_TOKEN=your-smartsheet-api-token
```

## Contributing

Contributions are welcome! Please create an issue or submit a pull request for improvements, bug fixes, or new features.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
