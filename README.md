# ChatSheetAI

A chat interface for interacting with Smartsheet data using Azure OpenAI.

## Database Setup

The application uses PostgreSQL for persistent storage of chat sessions and messages. Follow these steps to set up the database:

1. Ensure you have PostgreSQL installed and running locally.

2. Set up the environment files:

### Server Configuration (`server/.env`)

Create a `server/.env` file with your configuration (see `server/.env.example` for template):

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/chatsheetai
TEST_DATABASE_URL=postgresql://username:password@localhost:5432/chatsheetai_test

# Azure OpenAI Configuration
AZURE_OPENAI_API_BASE=your_azure_openai_base_url
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_DEPLOYMENT=your_deployment_name
AZURE_OPENAI_MODEL=your_model_name

# LiteLLM Proxy Configuration (Recommended for production)
LITELLM_API_BASE=http://localhost:8000
LITELLM_MODEL=gpt-4

# Smartsheet Configuration
SMARTSHEET_ACCESS_TOKEN=your_smartsheet_access_token
SMARTSHEET_WEBHOOK_SECRET=your_webhook_secret
```

> **Important**: The Smartsheet access token is required for the application to function properly. You can generate a new access token from the [Smartsheet Developer Tools](https://app.smartsheet.com/b/home?lx=pOG4v9lfJFh-aB21-QZ_rg) page. Go to "Personal Settings" > "API Access" to generate a new token.

### Client Configuration (`client/.env`)

Create a `client/.env` file with frontend configuration (see `client/.env.example` for template):

```env
# Frontend Environment Variables
VITE_API_URL=http://localhost:3000
```

3. Create the database:

```bash
createdb chatsheetai
```

4. Generate and run migrations:

```bash
# Generate the SQL migration from the Drizzle schema
npm run generate

# Apply migrations to the database
npm run migrate
```

### Migration Commands

- `npm run generate` - Generates new migrations based on schema changes
- `npm run migrate` - Applies pending migrations to the database
- `npm run db:generate` - Generates Drizzle migration files only (without running them)
- `npm run db:push` - Push schema changes directly to the database (development only)

### Database Schema

The database consists of two main tables:

#### Sessions Table

- `id` (text, primary key) - Unique session identifier
- `sheetId` (text) - Associated Smartsheet ID
- `createdAt` (timestamp) - Session creation timestamp
- `updatedAt` (timestamp) - Last update timestamp

#### Messages Table

- `id` (text, primary key) - Unique message identifier
- `sessionId` (text, foreign key) - Reference to sessions table
- `role` (text) - Message role (system/user/assistant)
- `content` (text) - Message content
- `timestamp` (timestamp) - Message timestamp
- `metadata` (jsonb) - Additional message metadata

Messages are automatically deleted when their associated session is deleted (ON DELETE CASCADE).

### Development

The application uses:

- [Drizzle ORM](https://orm.drizzle.team/) for database operations
- [PostgreSQL](https://www.postgresql.org/) as the database
- Local storage for client-side session persistence
- WebSocket for real-time updates

### Sheet Initialization Flow

The application follows a specific initialization sequence for Smartsheet interaction:

1. When first loaded, the application shows a full-screen modal requesting a Smartsheet ID
2. Upon entering a valid sheet ID:
   - A new session is created
   - The sheet data is loaded and cached
   - The chat interface becomes available
3. The LLM system message is initialized in two stages:
   - Basic capabilities are described first
   - Sheet-specific information (columns, structure) is added once available
4. Real-time updates are established through WebSocket connections
5. The sheet viewer refreshes automatically when changes occur

This sequence ensures proper context initialization and maintains data consistency throughout the chat session.

For local development:

1. Start PostgreSQL
2. Set up environment variables
3. Run migrations
4. Start the development server:

```bash
npm run dev
```

### Testing

The project uses Jest for testing, with separate configurations for client and server tests:

```bash
# Run all tests
npm test

# Run client tests only
npm run test:client

# Run server tests only
npm run test:server

# Run server tests in watch mode
npm run test:server:watch

# Run tests with coverage report
npm run test:coverage
```

#### Database Tests

Server tests that interact with the database require a PostgreSQL connection. To set up the test database:

1. Run the setup script:

```bash
npm run setup:test-db
```

This will:

- Create a test database (`chatsheetai_test`)
- Add `TEST_DATABASE_URL` to your `server/.env` file if not already present
- Configure the test database URL based on your existing `DATABASE_URL`

You can also manually configure the test database by adding to your `server/.env`:

```env
TEST_DATABASE_URL=postgresql://username:password@localhost:5432/chatsheetai_test
```

Note: All database-related environment variables should be in the server's environment file.

The test suite will:

- Automatically run migrations before tests
- Use a clean database state for each test
- Clean up test data after completion

Note: The test database is separate from your development database to prevent test data from interfering with development data.

To clean up the test database:

```bash
npm run cleanup:test-db
```

This will:

- Drop the test database if it exists
- Remove TEST_DATABASE_URL from your server/.env file

## Smartsheet Integration

The application integrates with the Smartsheet API to access and manipulate sheet data. This integration requires proper configuration and permissions.

### Smartsheet API Configuration

1. Generate an access token from the [Smartsheet Developer Tools](https://app.smartsheet.com/b/home?lx=pOG4v9lfJFh-aB21-QZ_rg) page:

   - Go to "Personal Settings" > "API Access"
   - Click "Generate new access token"
   - Copy the token (it will only be shown once)

2. Add the token to your `server/.env` file:

   ```env
   SMARTSHEET_ACCESS_TOKEN=your_generated_token
   ```

3. Set up a webhook secret (used for verifying webhook requests):
   ```env
   SMARTSHEET_WEBHOOK_SECRET=your_webhook_secret
   ```
   This can be any secure random string.

### Testing Your Smartsheet Token

The project includes a script to test your Smartsheet access token:

```bash
node scripts/test-smartsheet-token.js
```

This script will:

- Verify that your token is valid
- Check that it has the necessary permissions
- List available sheets
- Test access to a sheet

### Troubleshooting Smartsheet API Issues

If you encounter issues with the Smartsheet API:

1. **Invalid Sheet ID Error**:

   - Verify that the Sheet ID is correct
   - Check that the Sheet ID is numeric
   - Ensure you have access to the sheet with your account

2. **Authentication Issues**:

   - Verify your access token is valid using the test script
   - Check if the token has expired (tokens expire after 1 year)
   - Generate a new token if necessary

3. **Permission Issues**:

   - Ensure your Smartsheet account has access to the sheet
   - Check if the sheet requires special permissions
   - Verify that your token has the necessary scopes

4. **API Rate Limiting**:
   - The application includes retry logic for transient failures
   - If you encounter persistent rate limiting, reduce the frequency of requests

For more information about the Smartsheet API, refer to the [Smartsheet API Documentation](https://smartsheet.redoc.ly/).

## Azure OpenAI Integration

The application uses Azure OpenAI for natural language processing. There are two ways to connect to Azure OpenAI:

1. **Direct Connection** (Development only): Connect directly to Azure OpenAI API
2. **LiteLLM Proxy** (Recommended for production): Use a proxy server that handles connections to Azure OpenAI

### Option 1: Direct Connection

Configure your `server/.env` file with Azure OpenAI settings:

```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_BASE=your_azure_openai_base_url
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_DEPLOYMENT=your_deployment_name
AZURE_OPENAI_MODEL=your_model_name
```

### Option 2: LiteLLM Proxy (Recommended for Production)

This approach is recommended for production environments, especially when Azure OpenAI is configured to use private endpoints.

1. Install LiteLLM:

```bash
pip install litellm
```

2. Configure your `server/.env` file:

```env
# LiteLLM Proxy Configuration
LITELLM_API_BASE=http://localhost:8000
LITELLM_MODEL=gpt-4
```

3. Start the LiteLLM proxy:

```bash
npm run start:litellm
```

4. Test the connectivity:

```bash
npm run test:litellm
```

For detailed setup instructions and troubleshooting, see [LiteLLM Setup Guide](docs/litellm-setup.md).

### Troubleshooting Azure OpenAI Issues

If you encounter issues with Azure OpenAI:

1. **Authentication Issues**:

   - Verify your API key is valid
   - Check if the API key has expired
   - Ensure the API key has access to the specified deployment

2. **Private Endpoint Issues**:

   - If using private endpoints, ensure you're running the application in a network that can access them
   - Use the LiteLLM proxy approach for private endpoint access
   - Run the connectivity test script to diagnose issues

3. **Model Configuration Issues**:
   - Verify that the deployment name is correct
   - Check if the model exists in your Azure OpenAI resource
   - Ensure the API version is compatible with your deployment
