import { articleWorkflow } from './mastra/workflows/article-workflow';
import type { ArticleWorkflowOutput } from './mastra/workflows/article-workflow';

async function main() {
  try {
    // Create a workflow run
    const run = articleWorkflow.createRun();

    // Watch the workflow progress
    run.watch((state) => {
      console.log('\nWorkflow state update:');
      console.log('Current step:', state.value);
      if (state.context?.steps) {
        const steps = state.context.steps;
        Object.entries(steps).forEach(([stepId, stepData]) => {
          if (stepData.status === 'success') {
            console.log(`\nCompleted step: ${stepId}`);
            const result = stepData as unknown as { result: { wordCount?: number } };
            if (result.result?.wordCount) {
              console.log(`Word count: ${result.result.wordCount}`);
            }
          }
        });
      }
    });

    // Start the workflow with a test topic
    const result = await run.start({
      triggerData: {
        topic: "How AI is Revolutionizing Website Creation with Wegic",
      },
    });

    // Get the finalize step results
    const finalizeStep = result.results.finalize;
    if (finalizeStep.status === 'success') {
      const finalizeResult = finalizeStep as unknown as { result: ArticleWorkflowOutput['finalize'] };

      // Log the final results
      console.log('\nWorkflow completed!');
      console.log('Total word count:', finalizeResult.result.totalWordCount);
      console.log('\nFinal article:');
      console.log(finalizeResult.result.finalArticle);
      console.log('\nSEO Metadata:');
      console.log(finalizeResult.result.metadata);
    } else {
      console.error('Finalize step did not complete successfully');
    }

  } catch (error) {
    console.error('Error running workflow:', error);
  }
}

main().catch(console.error); 