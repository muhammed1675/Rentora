const systemPrompt = `You are a helpful customer support assistant for Rentora, a student housing platform in Nigeria. 
Your role is to guide visitors and answer questions about:
- How to find and book properties on Rentora
- Rent payment and pricing information
- Property features and amenities
- How agents can list properties
- Account and profile management
- Payment methods and transaction support
- Inspections and property viewings
- General FAQ about the platform

Be friendly, professional, and helpful. Keep responses concise and clear. If a question is outside your scope or requires immediate human support, direct the user to contact support@rentora.com.ng or call our support team.

Always maintain a supportive tone and help users get the most out of the Rentora platform.`;

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Dynamic imports avoid the ESM/CommonJS conflict that happens when
    // this file is compiled to CommonJS by Vercel's build but these
    // packages only ship ESM builds.
    const { generateText } = await import('ai');
    const { google } = await import('@ai-sdk/google');

    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    // Talk to Google's Gemini API directly using the free-tier key
    // (GOOGLE_GENERATIVE_AI_API_KEY set in Vercel's environment variables)
    const response = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: messages,
      temperature: 0.7,
      maxOutputTokens: 500,
    });

    return res.status(200).json({
      content: response.text,
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      },
    });
  } catch (error) {
    console.error('[chat API] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate response',
      message: error.message,
    });
  }
}