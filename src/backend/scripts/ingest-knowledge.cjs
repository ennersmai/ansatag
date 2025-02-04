require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the built version
const { SupabaseRAG } = require('../dist/lib/supabase-client.js');

async function ingestKnowledgeBase() {
  const rag = new SupabaseRAG();
  const knowledgeDir = path.join(__dirname, '../knowledge/gelida');
  
  console.log('Starting knowledge base ingestion from:', knowledgeDir);
  
  try {
    const files = fs.readdirSync(knowledgeDir);
    
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      
      console.log(`Processing ${file}...`);
      const filePath = path.join(knowledgeDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Skip empty files
      if (!content.trim()) {
        console.log(`Skipping empty file: ${file}`);
        continue;
      }
      
      const metadata = {
        source: file,
        type: 'markdown',
        category: 'gelida',
        created_at: new Date().toISOString()
      };
      
      try {
        const docId = await rag.addDocument(content, metadata);
        console.log(`Successfully added ${file} with ID: ${docId}`);
      } catch (error) {
        console.error(`Error adding ${file}:`, error);
      }
    }
    
    console.log('Knowledge base ingestion complete!');
  } catch (error) {
    console.error('Error during ingestion:', error);
    process.exit(1);
  }
}

// Run the ingestion
ingestKnowledgeBase().catch(console.error); 