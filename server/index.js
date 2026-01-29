import express from "express";
import cors from "cors";
import { CopilotClient } from "@github/copilot-sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 5555;

app.use(cors());
app.use(express.json());

const client = new CopilotClient();

app.post("/translate", async (req, res) => {
  const { text, language, mode = "translate" } = req.body;

  if (!text || !language) {
    return res.status(400).json({ error: "Missing text or language" });
  }

  console.log(`Processing [${mode}] request to ${language} (streaming)...`);

  const instruction = `
Instruction:
- Do not hallucinate.
- If the user asks to translate, translate to ${language} ONLY. 
- For technical terms, use industry-standard terminology or common transliterations used by developers in that language.
- Use icons sparingly to improve understanding.
- Translate everything accurately, do not skip or summarize.
- If the input is code or related to coding, provide a technical explanation and use code blocks where appropriate.
`;

  const prompt = `${instruction}\n\nUser Input: "${text}"`;

  try {
    const session = await client.createSession({
      model: "gpt-4.1",
      streaming: true,
      systemMessage: {
        mode: "replace",
        content: instruction,
      },
    });

    const done = new Promise((resolve, reject) => {
      session.on((event) => {
        if (event.type === "assistant.message_delta") {
          res.write(event.data.deltaContent);
        } else if (event.type === "session.idle") {
          resolve();
        } else if (event.type === "error") {
          reject(new Error(event.data?.message || "Unknown error"));
        }
      });
    });

    await session.send({ prompt: prompt });
    await done;
    await session.destroy();
    res.end();
  } catch (error) {
    console.error("Copilot SDK Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`\n\n[Error]: ${error.message}`);
      res.end();
    }
  }
});

app.listen(port, () => {
  console.log(`Copilot Translator Server running at http://localhost:${port}`);
});
