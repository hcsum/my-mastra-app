import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { createVectorQueryTool } from '@mastra/rag';
import axios from 'axios';

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    };

    const response = await axios.post(input.toString(), init?.body, {
      headers,
      responseType: "arraybuffer",
      proxy: {
        host: "127.0.0.1",
        port: 7890,
        protocol: "http",
      },
    });
    return new Response(response.data, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as HeadersInit,
    });
  },
});

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'papers',
  model: openai.embedding('text-embedding-3-small'),
});

export const researchAgent = new Agent({
  name: 'Research Assistant',
  instructions: `
    You are a helpful research assistant that analyzes academic papers and technical documents.
    Use the provided vector query tool to find relevant information from your knowledge base, 
    and provide accurate, well-supported answers based on the retrieved content.
    
    When responding:
    - Focus on the specific content available in the tool
    - Acknowledge if you cannot find sufficient information to answer a question
    - Base your responses only on the content provided, not on general knowledge
    - Cite specific sections or quotes when possible
    - Maintain academic tone and precision
    - Highlight any limitations in the available information
    
    For technical questions:
    - Provide detailed explanations of concepts
    - Include relevant equations or formulas if available
    - Explain the practical implications of findings
    - Compare different approaches when mentioned
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
  },
}); 