import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

app.post('/api/analyze-waste', async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: 'Gemini API not configured' });
  }

  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Analyze this waste item. What broad category of waste is it (e.g., Plastic, Paper, Metal, Glass, E-waste, Organic)? And what is a rough estimated value per kg in Indian Rupees (INR) for this type of scrap material? Return ONLY a JSON object exactly like this: {"type": "Plastic", "estimatedValue": 15}. Do not include any markdown formatting or extra text.' },
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
          ]
        }
      ]
    });

    const text = response.text || '';
    // parse the JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Could not parse JSON from model response');
    }
    const result = JSON.parse(match[0]);
    
    res.json(result);
  } catch (error) {
    console.error('Error analyzing waste:', error);
    res.status(500).json({ error: 'Failed to analyze waste' });
  }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await import('vite');
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(viteServer.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
