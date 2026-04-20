import { groq } from "../routes/aiGenRoutes";

// src/services/ai.ts
export async function getCodeReviewCompletion(language: string, code: string) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a senior ${language} code reviewer.

Review the code carefully for bugs, security issues, performance problems, and style violations.

Return ONLY a valid, raw JSON object. Do NOT wrap the JSON in Markdown formatting (like \\\`\\\`\\\`json). Just return the plain JSON object directly:

{
  "summary": "Brief overall assessment",   
      "category" : "bug" | "security" | "performance" | "style",
      "severity": 'critical' | 'warning' | 'info',
      "location": "(Line number) and snippet",
      "description": "Detailed explanation",
      "recommendation": "How to fix it",
      "NewCodeVersion":{
    "code":"Provide the better code snippit in strictly \\"JSON format\\""
  }
}`,
      },
      {
        role: "user",
        content: `Review this ${language} code:\n\n${code}`,
      },
    ],
    stream: true,
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    // NO response_format here — incompatible with streaming
  });
}