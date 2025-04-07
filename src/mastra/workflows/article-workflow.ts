import { Step, Workflow } from '@mastra/core';
import { wegicAgent } from '../agents/wegic-agent';
import { z } from 'zod';
import { Tool } from '@mastra/core';

// Define the section type
interface ArticleSection {
  title: string;
  wordCount: number;
  keyPoints: string[];
  wegicFeatures: string[];
}

// Define the outline type
interface OutlineData {
  seoMetadata: {
    title: string;
    description: string;
    keywords: string[];
  };
  sections: ArticleSection[];
}

// Define the wegicQueryTool schemas
const wegicQueryInputSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
});

type WegicQueryInput = z.infer<typeof wegicQueryInputSchema>;

// Define possible response types
interface WegicResponseItem {
  text?: string;
  content?: string;
  metadata?: {
    source?: string;
  };
}

interface WegicResponseWithMatches {
  matches?: WegicResponseItem[];
  text?: string;
  content?: string;
}

// The response can be any shape, we'll extract what we need
const wegicQueryOutputSchema = z.any();

// Helper function to safely execute wegicQueryTool
async function executeWegicQuery(query: string, limit: number = 5): Promise<string> {
  const queryTool = wegicAgent.tools.wegicQueryTool as Tool<typeof wegicQueryInputSchema>;
  if (!queryTool || !queryTool.execute) {
    throw new Error('Wegic query tool is not available');
  }

  const input: WegicQueryInput = {
    query,
    limit
  };

  const result = await queryTool.execute({
    context: wegicQueryInputSchema.parse(input)
  });

  if (!result) {
    throw new Error('Failed to execute Wegic query');
  }

  // Log the actual response structure for debugging
  console.log('Wegic query response:', JSON.stringify(result, null, 2));

  // Extract text content from the response, handling different possible structures
  let content = '';
  
  try {
    if (Array.isArray(result)) {
      // Handle array response
      content = (result as WegicResponseItem[])
        .map(item => item.text || item.content || '')
        .filter(Boolean)
        .join('\n\n');
    } else if (typeof result === 'object' && result !== null) {
      // Handle object response
      const responseObj = result as WegicResponseWithMatches;
      if (responseObj.text) {
        content = responseObj.text;
      } else if (responseObj.content) {
        content = responseObj.content;
      } else if (responseObj.matches) {
        content = Array.isArray(responseObj.matches)
          ? responseObj.matches
              .map((match: WegicResponseItem) => match.text || match.content || '')
              .filter(Boolean)
              .join('\n\n')
          : '';
      }
    }

    if (!content) {
      // If no content found, try to use the entire result as a fallback
      content = typeof result === 'string' ? result : JSON.stringify(result);
    }

    if (!content) {
      throw new Error(`No usable content found in response for query: ${query}`);
    }

    return content;
  } catch (error: unknown) {
    console.error('Error processing Wegic query response:', error);
    console.error('Raw response:', result);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to process Wegic query response: ${errorMessage}`);
  }
}

// Define steps with proper schemas and execution logic
const researchStep = new Step({
  id: 'research',
  outputSchema: z.object({
    outline: z.object({
      seoMetadata: z.object({
        title: z.string(),
        description: z.string(),
        keywords: z.array(z.string()),
      }),
      sections: z.array(z.object({
        title: z.string(),
        wordCount: z.number(),
        keyPoints: z.array(z.string()),
        wegicFeatures: z.array(z.string()),
      })),
    }),
    wegicReferences: z.array(z.object({
      feature: z.string(),
      source: z.string(),
      content: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { topic } = context.triggerData;
    
    try {
      // First, query the vector database for relevant Wegic information
      console.log('Querying Wegic information for topic:', topic);
      const wegicInfo = await executeWegicQuery(
        `key features and benefits of Wegic related to ${topic}`,
        5
      );
      console.log('Retrieved Wegic information:', wegicInfo);

      const prompt = `Create a detailed outline for a 2000-word promotional SEO article about Wegic's ${topic}.
        Use this Wegic-specific information: ${wegicInfo}
        
        Include:
        1. SEO metadata optimized for Wegic and ${topic}
        2. Main sections highlighting Wegic's unique capabilities
        3. Key points emphasizing Wegic's competitive advantages
        4. Specific Wegic features to showcase in each section
        5. Customer pain points that Wegic solves
        
        Format the outline to focus on Wegic's AI-powered capabilities and benefits.
        
        Return the response as a JSON object with this exact structure:
        {
          "seoMetadata": {
            "title": "string",
            "description": "string",
            "keywords": ["string"]
          },
          "sections": [
            {
              "title": "string",
              "wordCount": number,
              "keyPoints": ["string"],
              "wegicFeatures": ["string"]
            }
          ]
        }`;

      console.log('Generating outline with prompt:', prompt);
      const result = await wegicAgent.generate(prompt);
      console.log('Generated outline result:', result);
      
      let outline: OutlineData;
      try {
        outline = JSON.parse(result.text);
      } catch (error) {
        console.error('Failed to parse outline JSON:', error);
        throw new Error('Failed to generate valid outline structure');
      }

      // Query additional specific features for each section
      console.log('Querying features for each section');
      const wegicReferences = await Promise.all(
        outline.sections.map(async (section: ArticleSection) => {
          try {
            const sectionInfo = await executeWegicQuery(
              `Wegic features and capabilities related to ${section.title}`,
              2
            );

            return {
              feature: section.title,
              source: 'Wegic documentation',
              content: sectionInfo
            };
          } catch (error) {
            console.error(`Error querying section ${section.title}:`, error);
            return {
              feature: section.title,
              source: 'Wegic documentation',
              content: 'Information not available'
            };
          }
        })
      );

      return {
        outline,
        wegicReferences
      };
    } catch (error) {
      console.error('Error in research step:', error);
      throw error;
    }
  },
});

const introductionStep = new Step({
  id: 'introduction',
  outputSchema: z.object({
    content: z.string(),
    wordCount: z.number(),
  }),
  execute: async ({ context }) => {
    const { topic } = context.triggerData;
    const { outline, wegicReferences } = context.getStepResult(researchStep);
    
    // Get relevant Wegic information for the introduction
    const introInfo = await executeWegicQuery(
      `Wegic's main value proposition and unique benefits for ${topic}`,
      2
    );

    const prompt = `Write a compelling 250-300 word introduction for a promotional article about Wegic's ${topic}.
      Use this Wegic-specific information: ${introInfo}
      And this outline for context: ${JSON.stringify(outline)}
      
      The introduction should:
      - Start with a powerful hook about the challenges businesses face
      - Introduce Wegic as the revolutionary AI-powered solution
      - Highlight Wegic's unique approach to ${topic}
      - Preview the main benefits and features
      - Use these key references: ${JSON.stringify(wegicReferences)}
      - End with a clear value proposition`;

    const result = await wegicAgent.generate(prompt);
    return {
      content: result.text,
      wordCount: result.text.split(/\s+/).length,
    };
  },
});

const mainContent1Step = new Step({
  id: 'mainContent1',
  outputSchema: z.object({
    content: z.string(),
    wordCount: z.number(),
  }),
  execute: async ({ context }) => {
    const { topic } = context.triggerData;
    const { outline, wegicReferences } = context.getStepResult(researchStep);
    const intro = context.getStepResult(introductionStep);
    
    const prompt = `Write the first part (600-700 words) of the main content for the promotional article about Wegic's ${topic}.
      Using this outline: ${JSON.stringify(outline)}
      And following this introduction: ${intro.content}
      Reference these Wegic features: ${JSON.stringify(wegicReferences.slice(0, 2))}
      
      Focus on:
      - Detailed explanation of Wegic's AI-powered approach to ${topic}
      - Specific features and capabilities that set Wegic apart
      - Real-world examples of how Wegic solves common challenges
      - Technical advantages and innovation in the platform
      - Integration capabilities and ease of use
      
      Use proper H2 and H3 headings in markdown format.`;

    const result = await wegicAgent.generate(prompt);
    return {
      content: result.text,
      wordCount: result.text.split(/\s+/).length,
    };
  },
});

const mainContent2Step = new Step({
  id: 'mainContent2',
  outputSchema: z.object({
    content: z.string(),
    wordCount: z.number(),
  }),
  execute: async ({ context }) => {
    const { outline, wegicReferences } = context.getStepResult(researchStep);
    const mainContent1 = context.getStepResult(mainContent1Step);
    
    const prompt = `Write the second part (600-700 words) of the main content.
      Using this outline: ${JSON.stringify(outline)}
      Following this content: ${mainContent1.content}
      Reference these Wegic features: ${JSON.stringify(wegicReferences.slice(2))}
      
      Focus on:
      - Customer success stories and case studies with Wegic
      - ROI and business impact metrics
      - Competitive advantages over traditional solutions
      - Future-proof capabilities and scalability
      - Advanced features and customization options
      
      Use proper H2 and H3 headings in markdown format.`;

    const result = await wegicAgent.generate(prompt);
    return {
      content: result.text,
      wordCount: result.text.split(/\s+/).length,
    };
  },
});

const benefitsStep = new Step({
  id: 'benefits',
  outputSchema: z.object({
    content: z.string(),
    wordCount: z.number(),
  }),
  execute: async ({ context }) => {
    const { topic } = context.triggerData;
    const { outline, wegicReferences } = context.getStepResult(researchStep);
    
    const prompt = `Write a detailed benefits and features section (300-400 words) highlighting Wegic's value proposition.
      Using this outline: ${JSON.stringify(outline)}
      Reference these Wegic features: ${JSON.stringify(wegicReferences)}
      
      Include:
      - Key differentiators in Wegic's approach to ${topic}
      - Quantifiable benefits and performance metrics
      - Time and cost savings through AI automation
      - Scalability and future-proofing advantages
      - Enterprise-grade security and reliability
      - Integration capabilities with existing systems
      
      Format as a clear, scannable list of benefits with supporting details.`;

    const result = await wegicAgent.generate(prompt);
    return {
      content: result.text,
      wordCount: result.text.split(/\s+/).length,
    };
  },
});

const conclusionStep = new Step({
  id: 'conclusion',
  outputSchema: z.object({
    content: z.string(),
    wordCount: z.number(),
  }),
  execute: async ({ context }) => {
    const { topic } = context.triggerData;
    const { outline, wegicReferences } = context.getStepResult(researchStep);
    
    const prompt = `Write a powerful conclusion and call-to-action (200-250 words) for the Wegic article.
      Using this outline: ${JSON.stringify(outline)}
      
      Include:
      - Recap of Wegic's unique approach to ${topic}
      - Summary of key benefits and competitive advantages
      - Vision for the future with Wegic
      - Clear next steps for interested readers
      - Compelling call-to-action to try Wegic
      - Link to Wegic's website or contact information
      
      End with a strong statement about Wegic's impact on the industry.`;

    const result = await wegicAgent.generate(prompt);
    return {
      content: result.text,
      wordCount: result.text.split(/\s+/).length,
    };
  },
});

const finalizeStep = new Step({
  id: 'finalize',
  outputSchema: z.object({
    finalArticle: z.string(),
    totalWordCount: z.number(),
    seoScore: z.number(),
    metadata: z.object({
      title: z.string(),
      description: z.string(),
      keywords: z.array(z.string()),
      socialSnippets: z.array(z.string()),
      wegicFeatures: z.array(z.string()),
      callToAction: z.string(),
    }),
  }),
  execute: async ({ context }) => {
    const { topic } = context.triggerData;
    const { outline, wegicReferences } = context.getStepResult(researchStep);
    const intro = context.getStepResult(introductionStep);
    const main1 = context.getStepResult(mainContent1Step);
    const main2 = context.getStepResult(mainContent2Step);
    const benefits = context.getStepResult(benefitsStep);
    const conclusion = context.getStepResult(conclusionStep);
    
    // Extract key Wegic features from references
    const wegicFeatures = wegicReferences.map(ref => ref.feature);
    
    // Create a compelling call to action
    const callToAction = `Experience the future of ${topic} with Wegic. Start your free trial today and see how our AI-powered platform can transform your business. Visit wegic.ai to learn more.`;
    
    // Combine all sections with proper formatting
    const fullArticle = [
      `# ${outline.seoMetadata.title}`,
      '',
      intro.content,
      '',
      main1.content,
      '',
      main2.content,
      '',
      '## Key Benefits of Using Wegic',
      benefits.content,
      '',
      '## Transform Your Business with Wegic',
      conclusion.content,
      '',
      '---',
      callToAction,
    ].join('\n\n');
    
    const totalWords = [intro, main1, main2, benefits, conclusion]
      .reduce((sum, section) => sum + section.wordCount, 0);

    // Generate social media snippets focused on Wegic's value proposition
    const socialSnippets = [
      `🚀 Discover how Wegic's AI-powered platform revolutionizes ${topic}. Learn more in our latest article!`,
      `💡 Transform your ${topic} with Wegic's innovative solutions. See the benefits in our detailed guide.`,
      `🔥 Want to stay ahead in ${topic}? See how Wegic's AI technology gives you the competitive edge.`,
      `⚡️ Wegic makes ${topic} 10x faster and more efficient. Find out how in our new article!`,
    ];

    return {
      finalArticle: fullArticle,
      totalWordCount: totalWords,
      seoScore: 95, // Placeholder - could implement actual SEO scoring
      metadata: {
        title: outline.seoMetadata.title,
        description: outline.seoMetadata.description,
        keywords: outline.seoMetadata.keywords,
        socialSnippets,
        wegicFeatures,
        callToAction,
      },
    };
  },
});

// Create and configure the workflow
export const articleWorkflow = new Workflow({
  name: 'wegic-promotional-article-generator',
  triggerSchema: z.object({
    topic: z.string(),
  }),
});

// Build the workflow with sequential steps
articleWorkflow
  .step(researchStep)
  .then(introductionStep)
  .then(mainContent1Step)
  .then(mainContent2Step)
  .then(benefitsStep)
  .then(conclusionStep)
  .then(finalizeStep)
  .commit();

// Export types for the workflow
export type ArticleWorkflowInput = {
  topic: string;
};

export type ArticleWorkflowOutput = {
  research: {
    outline: OutlineData;
    wegicReferences: Array<{
      feature: string;
      source: string;
      content: string;
    }>;
  };
  introduction: {
    content: string;
    wordCount: number;
  };
  mainContent1: {
    content: string;
    wordCount: number;
  };
  mainContent2: {
    content: string;
    wordCount: number;
  };
  benefits: {
    content: string;
    wordCount: number;
  };
  conclusion: {
    content: string;
    wordCount: number;
  };
  finalize: {
    finalArticle: string;
    totalWordCount: number;
    seoScore: number;
    metadata: {
      title: string;
      description: string;
      keywords: string[];
      socialSnippets: string[];
      wegicFeatures: string[];
      callToAction: string;
    };
  };
}; 