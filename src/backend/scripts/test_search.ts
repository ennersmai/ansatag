import { SupabaseRAG } from '../lib/supabase-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSearch() {
  try {
    const rag = new SupabaseRAG();
    
    // Test queries
    const queries = [
      "What is Gelida's phone number?",
      "What kind of company is Gelida?",
      "Where is Gelida located?"
    ];

    for (const query of queries) {
      console.log(`\nSearching for: "${query}"`);
      const results = await rag.search(query);
      
      console.log('Results:');
      results.forEach((doc, i) => {
        console.log(`\n${i + 1}. Match (similarity: ${doc.similarity?.toFixed(3)})`);
        console.log('Content:', doc.content);
        console.log('Metadata:', doc.metadata);
      });
    }

  } catch (error) {
    console.error('Error testing search:', error);
  }
}

testSearch().catch(console.error); 