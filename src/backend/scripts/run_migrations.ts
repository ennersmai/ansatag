import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not found in environment variables');
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseKey
  );

  try {
    console.log('Running migrations...');
    
    // Read and execute the migration SQL
    const migrationPath = path.join(__dirname, '..', 'migrations', 'create_knowledge_base.sql');
    console.log('Migration path:', migrationPath);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (const statement of statements) {
      console.log('Executing statement:', statement.substring(0, 100) + '...');
      try {
        const { error } = await supabase.rpc('run_sql', { sql: statement });
        if (error) {
          console.error('Error executing statement:', error);
          throw error;
        }
      } catch (error) {
        console.error('Failed to execute statement:', error);
        throw error;
      }
    }

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations().catch(console.error); 