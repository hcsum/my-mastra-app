import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
import { mastra } from "./mastra";
import { openai } from './mastra/agents/wegic-agent';
import * as fs from 'fs/promises';
import * as path from 'path';

// Function to sanitize strings for PostgreSQL
function sanitizeForPg(str: string): string {
  // Replace all non-alphanumeric characters with underscores
  return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase();
}

async function processDirectory(dirName: string, indexName: string) {
  try {
    const dirPath = path.join(process.cwd(), dirName);
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      console.log(`Processing ${file}...`);
      const filepath = path.join(dirPath, file);
      const fileContent = await fs.readFile(filepath, 'utf-8');
      const { path: contentPath, content, type } = JSON.parse(fileContent);

      // Create document and chunk it
      const doc = MDocument.fromText(content);
      const chunks = await doc.chunk({
        strategy: 'recursive',
        size: 512,
        overlap: 50,
        separator: '\n',
      });

      console.log(`Number of chunks for ${contentPath}:`, chunks.length);

      // Generate embeddings
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: chunks.map(chunk => chunk.text),
      });

      // Get the vector store instance from Mastra
      const vectorStore = mastra.getVector('pgVector');

      // Store embeddings with sanitized paths
      await vectorStore.upsert({
        indexName: sanitizeForPg(indexName),
        vectors: embeddings,
        metadata: chunks.map(chunk => ({
          text: chunk.text,
          source: sanitizeForPg(contentPath),
          original_path: contentPath, // Keep original path for reference
          type: sanitizeForPg(type),
          timestamp: new Date().toISOString(),
        })),
      });

      console.log(`Completed processing ${file}`);
    }
  } catch (error) {
    console.error(`Error processing directory ${dirName}:`, error);
  }
}

async function main() {
  try {
    // Get the vector store instance from Mastra
    const vectorStore = mastra.getVector('pgVector');

    // Create indices for both docs and blog content
    const indexName = 'wegic_knowledge';
    try {
      await vectorStore.createIndex({
        indexName,
        dimension: 1536,
      });
    } catch (error: any) {
      console.log('Index might already exist:', error.message);
    }

    // Process documentation
    console.log('\nProcessing documentation...');
    await processDirectory('wegic-docs', indexName);

    // Process blog posts
    console.log('\nProcessing blog posts...');
    await processDirectory('wegic-blog', indexName);

    console.log("\nSuccessfully added all Wegic content to vector database");
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error); 