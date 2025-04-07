import { Mastra } from '@mastra/core/mastra';
import { PgVector } from '@mastra/pg';
import { createLogger } from '@mastra/core/logger';
import { wegicAgent } from './agents/wegic-agent';
import { articleWorkflow } from './workflows/article-workflow';
import { weatherAgent } from './agents/weather';
// Initialize vector store with correct port
const pgVector = new PgVector('postgresql://postgres:postgres@localhost:5439/postgres');

// Initialize Mastra instance
export const mastra = new Mastra({
  agents: { wegicAgent, weatherAgent },
  vectors: { pgVector },
  workflows: { articleWorkflow },
  logger: createLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
