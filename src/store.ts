import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
import { mastra } from "./mastra";
import { openai } from './mastra/agents/research-agent';

async function addContentToVectorDB(content: string, source: string, indexName: string = 'papers') {
  // Create document and chunk it
  const doc = MDocument.fromText(content);
  const chunks = await doc.chunk({
    strategy: 'recursive',
    size: 512,
    overlap: 50,
    separator: '\n',
  });

  console.log(`Number of chunks for ${source}:`, chunks.length);

  // Generate embeddings
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: chunks.map(chunk => chunk.text),
  });

  // Get the vector store instance from Mastra
  const vectorStore = mastra.getVector('pgVector');

  // Create an index if it doesn't exist
  try {
    await vectorStore.createIndex({
      indexName,
      dimension: 1536,
    });
  } catch (error: any) {
    // Index might already exist, that's okay
    console.log('Index might already exist:', error.message);
  }

  // Store embeddings
  await vectorStore.upsert({
    indexName,
    vectors: embeddings,
    metadata: chunks.map(chunk => ({
      text: chunk.text,
      source,
      timestamp: new Date().toISOString(),
    })),
  });

  console.log(`Successfully added content from ${source} to vector database`);
}

// Function to add content from a website
export async function addWebsite(url: string, source: string) {
  try {
    const response = await fetch(url);
    const content = await response.text();
    await addContentToVectorDB(content, source);
  } catch (error) {
    console.error(`Error adding website ${url}:`, error);
  }
}

// Function to add plain text content
export async function addText(text: string, source: string) {
  await addContentToVectorDB(text, source);
}

// Function to add content with custom index
export async function addContentWithIndex(content: string, source: string, indexName: string) {
  await addContentToVectorDB(content, source, indexName);
}

// Example usage:
// await addWebsite("https://example.com", "example-website");
// await addText("Your text content here...", "custom-text");
// await addContentToVectorDB("More content...", "another-source", "custom-index"); 