import { config } from 'dotenv';
import { SupabaseRAG } from '../lib/supabase-client.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

async function loadKnowledge() {
  try {
    const rag = new SupabaseRAG();
    
    // Read the about.md file using the correct path
    const aboutPath = path.join(process.cwd(), '..', 'knowledge for gelida', 'about.md');
    console.log('Reading from:', aboutPath);
    
    const aboutContent = fs.readFileSync(aboutPath, 'utf-8');
    
    // Extract company information
    const companyInfo = {
      description: aboutContent.split('## About Gelida:')[1].split('email:')[0].trim(),
      contact: {
        email: 'info@gelida.co.uk',
        website: 'gelida.co.uk',
        phone: '0330 056 2431',
        location: 'Lound Hall, The Lound Hall Estate, Bothamsall, Nr Retford, Nottinghamshire'
      }
    };

    console.log('Extracted company info:', companyInfo);

    // Add main description
    console.log('Adding company description...');
    await rag.addDocument(
      companyInfo.description,
      {
        type: 'company',
        category: 'about',
        source: 'about.md'
      }
    );

    // Add contact information
    console.log('Adding contact information...');
    await rag.addDocument(
      `Gelida's contact information: Email: ${companyInfo.contact.email}, Website: ${companyInfo.contact.website}, Phone: ${companyInfo.contact.phone}, Location: ${companyInfo.contact.location}`,
      {
        type: 'company',
        category: 'contact',
        source: 'about.md'
      }
    );

    console.log('✅ Successfully loaded Gelida company information into knowledge base');
  } catch (error) {
    console.error('❌ Error loading knowledge:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
  }
}

loadKnowledge(); 