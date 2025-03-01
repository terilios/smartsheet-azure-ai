import { pool } from '../server/db';

async function verifySchema() {
  try {
    // Connect to the database
    const client = await pool.connect();
    
    try {
      // Query to get column information for chat_sessions table
      const result = await client.query(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'chat_sessions'
        ORDER BY ordinal_position;
      `);
      
      console.log('\nChat Sessions Table Schema:');
      console.log('---------------------------');
      result.rows.forEach(column => {
        console.log(`Column: ${column.column_name}`);
        console.log(`Type: ${column.data_type}`);
        console.log(`Default: ${column.column_default || 'none'}`);
        console.log(`Nullable: ${column.is_nullable}`);
        console.log('---------------------------');
      });
      
      // Specifically check for the state column
      const stateColumn = result.rows.find(col => col.column_name === 'state');
      if (stateColumn) {
        console.log('\n✅ State column exists with the following properties:');
        console.log(`Type: ${stateColumn.data_type}`);
        console.log(`Default: ${stateColumn.column_default || 'none'}`);
        console.log(`Nullable: ${stateColumn.is_nullable}`);
      } else {
        console.log('\n❌ State column not found in chat_sessions table!');
      }
      
      // Check for the error column
      const errorColumn = result.rows.find(col => col.column_name === 'error');
      if (errorColumn) {
        console.log('\n✅ Error column exists with the following properties:');
        console.log(`Type: ${errorColumn.data_type}`);
        console.log(`Default: ${errorColumn.column_default || 'none'}`);
        console.log(`Nullable: ${errorColumn.is_nullable}`);
      } else {
        console.log('\n❌ Error column not found in chat_sessions table!');
      }
      
    } finally {
      // Release the client back to the pool
      client.release();
    }
    
    // Close the pool
    await pool.end();
    
  } catch (error) {
    console.error('Error verifying schema:', error);
    process.exit(1);
  }
}

// Run the verification
verifySchema().catch(console.error);