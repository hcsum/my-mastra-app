import { Mastra } from '@mastra/core/mastra';
import { PgVector } from '@mastra/pg';
import { createLogger } from '@mastra/core/logger';
import { researchAgent } from './agents/research-agent';
import { weatherAgent } from './agents/weather';

// Initialize vector store
const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

// Initialize Mastra instance
export const mastra = new Mastra({
  agents: { researchAgent, weatherAgent },
  vectors: { pgVector },
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
