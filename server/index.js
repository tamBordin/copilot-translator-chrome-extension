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
let globalSession = null;

app.post("/translate", async (req, res) => {
  const { text, language, mode = "translate" } = req.body;

  if (!text || !language) {
    return res.status(400).json({ error: "Missing text or language" });
  }

  console.log(`Processing [${mode}] request to ${language} (streaming)...`);

  const instruction = `
Instruction:
- ห้ามตอบคำถามโดยหลอนไปเอง
- ถ้าผู้ใช้ให้แปลภาษา ให้แปลเป็นภาษา ${language} เท่านั้น และถ้าเป็นศัพท์ที่เฉพาะเกี่ยวกับเทคนิค ให้ใช้คำศัพท์ที่เป็นที่ยอมรับในวงการนั้น ๆ หรือคำทับศัพท์ที่คนไทยใช้กันในยุคปัจจุบัน
- อาจจะมี icons นิดหน่อย ประกอบเพื่อความเข้าใจที่ดีขึ้น
- ให้แปลทุกอันห้ามตกหล่น ห้ามสรุป
- ถ้าคิดว่านี่คือเกี่ยวกับ coding ให้อธิบายเป็น code block ได้ให้ใส่ code block มา
`;

  const prompt = `${instruction}\n\nUser Input: "${text}"`;

  try {
    if (!globalSession) {
      globalSession = await client.createSession({
        model: "gpt-4.1",
        streaming: true,
        systemMessage: {
          mode: "replace",
          content:
            "You are a helpful assistant. You will receive instructions in each prompt.",
        },
      });
    }

    let unsubscribe;
    const done = new Promise((resolve, reject) => {
      unsubscribe = globalSession.on((event) => {
        if (event.type === "assistant.message_delta") {
          res.write(event.data.deltaContent);
        } else if (event.type === "session.idle") {
          resolve();
        } else if (event.type === "error") {
          reject(new Error(event.data?.message || "Unknown error"));
        }
      });
    });

    await globalSession.send({ prompt: prompt });
    await done;
    unsubscribe();
    res.end();
  } catch (error) {
    console.error("Copilot SDK Error:", error);
    // If error, destroy session to be safe for next time
    if (globalSession) {
      try {
        await globalSession.destroy();
      } catch (e) {
        console.error("Error destroying session:", e);
      }
      globalSession = null;
    }

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
