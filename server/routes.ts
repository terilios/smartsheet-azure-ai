// Example routes file

import { Router } from 'express';
const router = Router();

// Define your routes here
router.get('/', (req, res) => {
  res.send('Hello from routes!');
});

// ... other route definitions

export { router };
export default router;
