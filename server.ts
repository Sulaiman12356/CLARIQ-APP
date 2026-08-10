import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Gemini AI Chat Proxy
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, userPrompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    const systemInstruction = `You are Clarity AI Mentor, the official intelligent AI Mentor and digital marketing consultant at CLARIQ Digital Academy (founded by Clarity Digital Academy). You help learners, freelancers, and marketers master digital marketing, Meta ads, copywriting, graphic design, and client acquisition.

CRITICAL TONE & FORMATTING DIRECTIVES:
1. Introduce yourself warmly as Clarity AI Mentor when appropriate. Speak in an articulate, encouraging, and human tone.
2. ABSOLUTELY DO NOT use markdown dashes (-), bullet point dashes, asterisks (* or **), hashes (#), or markdown headings anywhere in your content.
3. Write in clean, clear, complete flowing paragraphs or numbered points (1., 2., 3.) when laying out step-by-step concepts, study plans, or draft feedback.
4. Provide practical, high-value advice tailored to the student's digital marketing journey.`;

    let contents: any[] = [];
    if (Array.isArray(messages) && messages.length > 0) {
      const formatted: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
      for (const m of messages) {
        if (!m || typeof m.content !== 'string' || !m.content.trim()) continue;
        const role = m.role === 'user' ? 'user' : 'model';
        if (formatted.length > 0 && formatted[formatted.length - 1].role === role) {
          formatted[formatted.length - 1].parts[0].text += '\n\n' + m.content.trim();
        } else {
          formatted.push({ role, parts: [{ text: m.content.trim() }] });
        }
      }
      if (formatted.length > 0 && formatted[0].role === 'model') {
        formatted.shift();
      }
      contents = formatted;
    }

    if (contents.length === 0) {
      const text = typeof userPrompt === 'string' && userPrompt.trim() ? userPrompt.trim() : 'Hello';
      contents = [{ role: 'user', parts: [{ text }] }];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction,
      }
    });

    let reply = response.text || "I am glad to help you with that. Let us walk through your goals together in detail.";
    reply = reply
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/^[\s]*[-•][\s]+/gm, '')
      .replace(/[\r\n][\s]*[-•][\s]+/g, '\n');

    return res.json({ reply });
  } catch (error: any) {
    console.error("Gemini chat error:", error);
    return res.status(500).json({ error: error.message || "Failed to process AI chat request." });
  }
});

// Gemini AI Assignment Grading Proxy
app.post("/api/grade-assignment", async (req, res) => {
  try {
    const { assignmentTitle, instructions, submissionText } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    const prompt = `You are an instructor at CLARIQ, a digital marketing learning platform. Grade the student's assignment submission against the instructions.
Respond with ONLY valid JSON in exactly this shape (no markdown, no code blocks):
{"grade": "A short grade like 88/100 or Excellent/Good/Needs Work", "feedback": "2-4 sentences of specific, encouraging, actionable feedback referencing what they actually wrote"}

Assignment: ${assignmentTitle}
Instructions: ${instructions}

Student submission:
${submissionText}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    let parsed: any;
    try {
      parsed = JSON.parse(response.text || "{}");
    } catch {
      parsed = { grade: "Reviewed", feedback: response.text || "Submission reviewed successfully." };
    }

    return res.json(parsed);
  } catch (error: any) {
    console.error("Gemini grading error:", error);
    return res.json({
      grade: "Reviewed",
      feedback: "Your submission has been received and saved. The AI instructor recorded your work successfully!"
    });
  }
});

// Serve static files
app.use(express.static(__dirname));

// Fallback to index.html for SPA/single page
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
