// Load environment variables for tests
import 'dotenv/config';

// Set test database URL if not already set
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
}

// Add any other server-specific test setup here
beforeAll(() => {
  // Setup code that runs before all tests
});

afterAll(() => {
  // Cleanup code that runs after all tests
});
