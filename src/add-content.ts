import { addWebsite, addText } from './store';

async function main() {
  // Example 1: Add a website
  console.log("Adding website content...");
  await addWebsite("https://example.com", "example-website");

  // Example 2: Add some text content
  console.log("\nAdding text content...");
  await addText(
    `This is a sample text that will be added to the vector database.
    It can contain multiple paragraphs and will be automatically chunked.
    
    The content can be anything you want, such as:
    - Articles
    - Documentation
    - Notes
    - Research papers
    - Code snippets
    - And more...`,
    "sample-text"
  );

  console.log("\nDone! You can now query this content using the research agent.");
}

main().catch(console.error); 