import express from "express";
import cors from "cors";
import { CopilotClient } from "@github/copilot-sdk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env from the server directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Token Management
// Prioritize GH_TOKEN from .env file or environment variables
const GH_TOKEN = process.env.GH_TOKEN;

if (!GH_TOKEN) {
  console.warn(
    "WARNING: GH_TOKEN is not set in .env or environment variables.",
  );
}

const client = new CopilotClient();

app.post("/translate", async (req, res) => {
  const { text, language, mode = "translate" } = req.body;

  if (!text || !language) {
    return res.status(400).json({ error: "Missing text or language" });
  }

  console.log(`Processing [${mode}] request...`);

  try {
    const models = ["gpt-4.1", "gpt-4o", "gpt-5-mini", "grok-code-fast-1"]; // Model list for 0x free tier users
    const session = await client.createSession({
      model: models[3],
    });

    const instruction = `
Instruction:
- ห้ามตอบคำถามโดยหลอนไปเอง
- ถ้าผู้ใช้ให้แปลภาษา ให้แปลเป็นภาษาไทยเท่านั้น และถ้าเป็นศัพท์ที่เฉพาะเกี่ยวกับเทคนิค ให้ใช้คำศัพท์ที่เป็นที่ยอมรับในวงการนั้น ๆ หรือคำทับศัพท์ที่คนไทยใช้กันในยุคปัจจุบัน
- อาจจะมี icons นิดหน่อย ประกอบเพื่อความเข้าใจที่ดีขึ้น
- ให้แปลทุกอันห้ามตกหล่น ห้ามสรุป
- ถ้าคิดว่านี่คือเกี่ยวกับ coding ให้อธิบายเป็น code block ได้ให้ใส่ code block มา
`;

    const prompt = `${instruction}\n\nUser Input: "${text}"`;

    const response = await session.sendAndWait({ prompt });

    const translation =
      response?.data?.content || response.text || JSON.stringify(response);

    res.json({ translation });
  } catch (error) {
    console.error("Copilot SDK Error:", error);
    res.json({
      translation: `[Error]: ${error.message || "Failed to connect to Copilot"}`,
      note: "Ensure your GH_TOKEN is valid and the server has access.",
    });
  }
});

app.listen(port, () => {
  console.log(`Copilot Translator Server running at http://localhost:${port}`);
});
