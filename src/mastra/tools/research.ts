import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { MDocument } from '@mastra/rag';
import { PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';

// Initialize vector store
const vectorStore = new PgVector(process.env.POSTGRES_CONNECTION_STRING || '');

// Tool to add a document to the knowledge base
export const addDocumentTool = createTool({
  id: 'add-document',
  description: 'Add a document to the research knowledge base',
  inputSchema: z.object({
    content: z.string().describe('Document content to add'),
    title: z.string().describe('Title of the document'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Create document
      const doc = MDocument.fromText(context.content, {
        metadata: { title: context.title }
      });

      // Create chunks
      const chunks = await doc.chunk({
        strategy: "recursive",
        size: 512,
        overlap: 50,
      });

      // Generate embeddings
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: chunks.map(chunk => chunk.text),
      });

      // Store in vector database
      await vectorStore.upsert({
        indexName: "research_embeddings",
        vectors: embeddings,
        metadata: chunks.map(chunk => ({ 
          title: context.title,
          text: chunk.text 
        })),
      });

      return {
        success: true,
        message: `Successfully added document: ${context.title}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Tool to search the knowledge base
export const searchKnowledgeBaseTool = createTool({
  id: 'search-knowledge',
  description: 'Search the research knowledge base for relevant information',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().default(3).describe('Number of results to return'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      text: z.string(),
      title: z.string(),
      similarity: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    try {
      // Generate query embedding
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: [context.query],
      });
      const queryVector = embeddings[0];

      // Search vector database
      const results = await vectorStore.query({
        indexName: "research_embeddings",
        queryVector,
        topK: context.limit,
      });

      return {
        results: results.map(result => ({
          text: result.metadata?.text || '',
          title: result.metadata?.title || '',
          similarity: result.score,
        })),
      };
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
}); 