import { mastra } from "./mastra";

async function main() {
  const agent = mastra.getAgent('wegicAgent');

  // Test queries covering different aspects of Wegic
  const queries = [
    // Basic product understanding
    "What is Wegic and what are its main features?",
    
    // Specific feature questions
    "How does Wegic's AI Manager work?",
    "Explain the multilingual support in Wegic",
    
    // Technical capabilities
    "What technologies does Wegic use for website creation?",
    "How does Wegic handle website responsiveness?",
    
    // Use cases and examples
    "Can you give me some examples of websites built with Wegic?",
    "What types of businesses is Wegic best suited for?",
    
    // Recent updates (from blog)
    "What are some recent updates or new features in Wegic?",
    
    // Detailed process questions
    "Walk me through the process of creating and publishing a website with Wegic",
  ];

  for (const query of queries) {
    console.log("\n" + "=".repeat(80));
    console.log("QUERY:", query);
    console.log("-".repeat(80));
    
    try {
      const response = await agent.generate(query);
      console.log("RESPONSE:", response.text);
    } catch (error) {
      console.error("Error getting response:", error);
    }
  }
}

main().catch(console.error); 