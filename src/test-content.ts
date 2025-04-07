import { mastra } from "./mastra";

async function main() {
  const agent = mastra.getAgent('wegicAgent');

  // Test content creation with different topics
  const topics = [
    "Write an SEO-optimized article about 'How AI is Revolutionizing Website Creation' focusing on Wegic's capabilities",
    
    "Create a blog post about 'The Future of No-Code Website Building' highlighting Wegic's innovative approach",
    
    "Write a comprehensive guide on 'Building a Multilingual Business Website in Minutes' showcasing Wegic's features",
    
    "Create an article about 'Why AI-Powered Website Management is the Future' focusing on Wegic's AI Manager",
    
    "Write a case study style article about 'How Small Businesses are Saving Time and Money with AI Website Builders'",
  ];

  for (const topic of topics) {
    console.log("\n" + "=".repeat(100));
    console.log("TOPIC:", topic);
    console.log("-".repeat(100));
    
    try {
      const response = await agent.generate(topic);
      console.log("\nGENERATED CONTENT:\n");
      console.log(response.text);
    } catch (error) {
      console.error("Error generating content:", error);
    }
  }
}

main().catch(console.error); 