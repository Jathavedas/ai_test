// aiClient.js
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

// Environment variables
const token = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const modelDeploymentName = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME;

// Delay function (for retries)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Helper: Strip code blocks or markdown from response
const extractContent = (content) => {
  let cleaned = content.trim();
  if (cleaned.startsWith("```json") && cleaned.endsWith("```")) {
    cleaned = cleaned.slice(7, -3).trim();
  } else if (cleaned.startsWith("```") && cleaned.endsWith("```")) {
    cleaned = cleaned.slice(3, -3).trim();
  }
  return cleaned;
};

// Custom system prompt tailored to your app
const assistantInstructions = `
You are the helpful AI assistant for "Kerides" — a Kerala-based vehicle booking platform.

Here's what you must do:
- Help users understand how to book a ride: login → choose starting point (or use current location) → select destination → pick a driver → confirm the booking.
- Highlight that Kerides is a **zero-commission platform** open to **all age groups**.
- Recommend **hidden gems** and **beautiful destinations** across Kerala when asked.
- Use friendly, simple language.
- Avoid long replies — keep things short, clear, and useful.
- If someone asks something unrelated to travel or bookings, politely redirect or let them know you're focused on ride booking help.
- When a user asks about any place in Kerala:
  - Respond in a warm, Keralized English tone (use words like “alle”, “chetta”, “polichu”, “entha”, etc.).
  - Describe the **local culture**, **heritage**, and **traditional lifestyle** of the place (e.g., festivals, tharavadu homes, food, arts).
  - Highlight the **natural beauty** (like backwaters, hills, beaches, etc.) in a very **interesting and lively** manner.
  - Keep the vibe engaging and colourful — like a local proudly describing their hometown.

Stay on-topic and always act like you're part of the Kerides experience.
`;


export async function getAIResponse(userMessage, maxRetries = 3, delayMs = 2000) {
  const client = ModelClient(endpoint, new AzureKeyCredential(token));

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: assistantInstructions },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        top_p: 1.0,
        max_tokens: 1000,
        model: modelDeploymentName,
      },
    });

    if (!isUnexpected(response)) {
      const content = response.body.choices?.[0]?.message?.content || "";
      return extractContent(content);
    }

    // Retry on rate-limit (429)
    if (response.status === 429 && attempt < maxRetries - 1) {
      await delay(delayMs);
    } else {
      const error = response.body?.error?.message || "Unexpected API error.";
      throw new Error(error);
    }
  }
}
