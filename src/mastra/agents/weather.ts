import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { weatherTool } from '../tools/get-weather';
import axios from 'axios';

const openai = createOpenAI({
  fetch: async (url, options) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    };

    const response = await axios.post(url as string, options?.body, {
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

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn’t in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.
`,
  // model: ollama('llama3'),
  model: openai('gpt-4o-mini'),
  tools: { weatherTool },
});
