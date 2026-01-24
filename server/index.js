import express from 'express';
import cors from 'cors';
import { CopilotClient } from '@github/copilot-sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from the server directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Token Management
// Prioritize GH_TOKEN from .env file or environment variables
const GH_TOKEN = process.env.GH_TOKEN;

if (!GH_TOKEN) {
  console.warn('WARNING: GH_TOKEN is not set in .env or environment variables.');
}

const client = new CopilotClient();

app.post('/translate', async (req, res) => {
  const { text, language, mode = 'translate' } = req.body;

  if (!text || !language) {
    return res.status(400).json({ error: 'Missing text or language' });
  }

  console.log(`Processing [${mode}] request...`);

  try {
    // Note: The SDK usually expects GH_TOKEN to be in process.env.GH_TOKEN
    const session = await client.createSession({
      model: 'gpt-4.1',
    });

    const translateInstruction = `
Instruction:
- ให้คุยกับผู้ใช้ด้วยภาษาไทยเท่านั้น!
- ห้ามตอบคำถามโดยหลอนไปเอง
- ถ้าผู้ใช้ให้แปลภาษา ให้แปลเป็นภาษาไทยเท่านั้น และถ้าเป็นศัพท์ที่เฉพาะเกี่ยวกับเทคนิค ให้ใช้คำศัพท์ที่เป็นที่ยอมรับในวงการนั้น ๆ หรือคำทับศัพท์ที่คนไทยใช้กันในยุคปัจจุบัน อาจจะมี icons ประกอบเพื่อความเข้าใจที่ดีขึ้น
- ให้แปลทุกอันห้ามตกหล่น ห้ามสรุป
`;

    const codeInstruction = `
Instruction:
- คุณคือผู้เชี่ยวชาญด้านการเขียนโปรแกรม
- หน้าที่ของคุณคือ "อธิบายการทำงานของ Code" ที่ได้รับมาให้เข้าใจง่ายที่สุด
- อธิบายเป็นภาษาไทย
- ถ้า Code นั้นเป็น Algorithm ให้วิเคราะห์ Time Complexity (Big O) มาด้วยสั้นๆ
- ถ้ามีจุดที่น่าสนใจหรือควรระวัง ให้แนะนำเพิ่มเติม
- ไม่ต้องอารัมภบท เข้าประเด็นทันที
- ใช้ Code Block ประกอบการอธิบายได้ถ้าจำเป็น
`;

    const systemInstruction = mode === 'code' ? codeInstruction : translateInstruction;
    const prompt = `${systemInstruction}\n\nUser Input: "${text}"`;

    const response = await session.sendAndWait({ prompt });
    
    const translation = response?.data?.content || response.text || JSON.stringify(response);

    res.json({ translation });

  } catch (error) {
    console.error('Copilot SDK Error:', error);
    res.json({
      translation: `[Error]: ${error.message || 'Failed to connect to Copilot'}`,
      note: "Ensure your GH_TOKEN is valid and the server has access."
    });
  }
});

app.listen(port, () => {
  console.log(`Copilot Translator Server running at http://localhost:${port}`);
});
