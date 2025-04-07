import { mastra } from "./mastra";

async function main() {
  const agent = mastra.getAgent('researchAgent');

  // Basic query about concepts
  const query1 = "What problems does sequence modeling face with neural networks?";
  const response1 = await agent.generate(query1);
  console.log("\nQuery:", query1);
  console.log("Response:", response1.text);

  // Query about specific findings
  const query2 = "What improvements were achieved in translation quality?";
  const response2 = await agent.generate(query2);
  console.log("\nQuery:", query2);
  console.log("Response:", response2.text);
}

main().catch(console.error); 