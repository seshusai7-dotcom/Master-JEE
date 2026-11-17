import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({ status: 'ok', aiConfigured: hasKey });
  });

  // Contextual AI Physics Tutor
  app.post('/api/tutor/chat', async (req, res) => {
    try {
      const {
        message,
        chapterTitle = 'Units and Measurements',
        chapterContext = '',
        academicLevel = 'jee_main',
        hintOnly = false,
        history = [],
      } = req.body ?? {};

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'A valid physics question is required.' });
        return;
      }

      const ai = getGeminiClient();
      const levelGuidance =
        academicLevel === 'foundation'
          ? 'Explain from first principles with clear intuition, SI units, and simple numerical steps suitable for Class 11 CBSE beginners.'
          : academicLevel === 'jee_advanced'
            ? 'Provide rigorous analytical depth, calculus derivations, edge-case traps, and multi-concept JEE Advanced insights.'
            : 'Focus on JEE Main examination derivations, formula application, common traps, and clear step-by-step numerical solving.';

      const hintInstruction = hintOnly
        ? 'IMPORTANT: Hint-First Mode is enabled. Do NOT reveal the final numerical answer or full solution yet. Give a physical hint, identify the governing principle/equation, and invite the student to attempt the next step.'
        : 'Provide a structured response: (1) Core Principle, (2) Step-by-Step Mathematical Derivation/Solution using $...$ and $$...$$ LaTeX, (3) Physical Interpretation & Dimensional Check, (4) Common Mistake to Avoid.';

      const systemInstruction = `You are the AI Physics Teaching Assistant for "MASTER JEE – Class 11 Physics", Academically Directed by Dr. V. Sesha Sai Kumar (GRIET, Hyderabad).
Active Chapter: ${chapterTitle}
Student Level: ${academicLevel}
${levelGuidance}
${hintInstruction}
Textbook Reference Context:
${String(chapterContext).slice(0, 2500)}
Always verify dimensional consistency and SI units. Use clean LaTeX delimited by $...$ for inline math and $$...$$ for display equations.`;

      const conversationText = Array.isArray(history) && history.length > 0
        ? history
            .slice(-6)
            .map((h: { role?: string; text?: string }) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text ?? ''}`)
            .join('\n') + `\nStudent: ${message}`
        : message;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: conversationText,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({
        reply: response.text ?? 'Unable to generate an explanation at this moment.',
        model: 'gemini-4-hydrogen',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to reach AI Tutor service.';
      res.status(500).json({ error: msg });
    }
  });

  // AI Question Generation Engine (supports 10, 20, 30, 50, 100 via clean batching)
  app.post('/api/questions/generate', async (req, res) => {
    try {
      const {
        chapterId = 'ch1',
        chapterTitle = 'Units and Measurements',
        subtopicTitle = 'All Subtopics',
        difficulty = 'jee_main',
        format = 'single_mcq',
        count = 10,
      } = req.body ?? {};

      const requestedCount = Math.min(100, Math.max(1, Number(count) || 10));
      const batchSize = Math.min(10, requestedCount);
      const batches = Math.ceil(requestedCount / batchSize);

      const ai = getGeminiClient();
      const allQuestions: unknown[] = [];

      for (let b = 0; b < batches; b += 1) {
        const remaining = requestedCount - allQuestions.length;
        const currentBatchCount = Math.min(batchSize, remaining);
        if (currentBatchCount <= 0) break;

        const prompt = `Generate exactly ${currentBatchCount} original, mathematically verified Class 11 Physics practice questions for:
Chapter: ${chapterTitle} (${chapterId})
Subtopic: ${subtopicTitle}
Difficulty: ${difficulty}
Format: ${format}
Batch: ${b + 1} of ${batches}

Requirements:
- All questions MUST be 100% original (NEVER claim to be historical JEE PYQs).
- Independently verify every numerical value, SI unit, and dimensional consistency before outputting.
- For single_mcq or assertion_reason, provide 4 options and correctOptionIndices with 1 index (0-3).
- For multiple_mcq, provide 4 options and correctOptionIndices with 1-4 indices.
- For numerical or integer, set options to [] and provide exact numericalAnswer and unit.
- Use clean LaTeX ($...$) in prompts and solutions.`;

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a rigorous IIT-JEE Physics problem author. Verify every calculation numerically and dimensionally before returning JSON.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  prompt: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctOptionIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  numericalAnswer: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  solution: { type: Type.STRING },
                  topicTag: { type: Type.STRING },
                },
                required: ['prompt', 'solution', 'topicTag'],
              },
            },
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        const parsed = JSON.parse((response.text ?? '[]').trim());
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            allQuestions.push({
              id: `ai-gen-${Date.now()}-${allQuestions.length + 1}`,
              databaseCategory: 'B_AI_ORIGINAL',
              chapterId,
              topicId: String(item.topicTag || subtopicTitle).toLowerCase().replace(/\s+/g, '_').slice(0, 40),
              exam: 'Original AI-Generated Practice',
              year: new Date().getFullYear(),
              format,
              difficulty,
              prompt: String(item.prompt || ''),
              options: Array.isArray(item.options) && item.options.length > 0 ? item.options : undefined,
              correctOptionIndices:
                Array.isArray(item.correctOptionIndices) && item.correctOptionIndices.length > 0
                  ? item.correctOptionIndices
                  : [0],
              numericalAnswer: typeof item.numericalAnswer === 'number' ? item.numericalAnswer : undefined,
              numericalTolerance: format === 'integer' ? 0.001 : 0.05,
              unit: item.unit ? String(item.unit) : undefined,
              solution: String(item.solution || ''),
              sourceCitation: 'Original AI-Generated Practice — Gemini Physics Quality Engine',
              verified: true,
              copyrightNote: 'Original AI-generated supplementary practice material.',
            });
          }
        }
      }

      res.json({
        questions: allQuestions.slice(0, requestedCount),
        generatedCount: Math.min(requestedCount, allQuestions.length),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to generate practice set.';
      res.status(500).json({ error: msg });
    }
  });

  // Teacher / Admin Content Generation Engine (GENERATE step of workflow)
  app.post('/api/content/generate', async (req, res) => {
    try {
      const { chapterTitle, subtopicTitle, targetLevel = 'jee_main' } = req.body ?? {};
      if (!chapterTitle || !subtopicTitle) {
        res.status(400).json({ error: 'chapterTitle and subtopicTitle are required.' });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate an original, academically rigorous Class 11 Physics supplementary textbook module for:
Chapter: ${chapterTitle}
Subtopic: ${subtopicTitle}
Level: ${targetLevel}

Include: Physical Principle, Key Definitions, Mathematical Formulation in LaTeX ($...$ / $$...$$), Assumptions & Limitations, Common Misconceptions, and one worked numerical example with dimensional verification.`,
        config: {
          systemInstruction:
            'You are authoring supplementary Class 11 Physics textbook content for Dr. V. Sesha Sai Kumar (GRIET, Hyderabad). Do not present AI-generated content as official NCERT or NTA text.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({
        title: `${subtopicTitle} (${targetLevel.replace('_', ' ').toUpperCase()} Module)`,
        summary: response.text ?? '',
        workflowStatus: 'GENERATE',
        sourceLabel: 'Original AI-Generated',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Content generation failed.';
      res.status(500).json({ error: msg });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('/{*path}', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MASTER JEE Class 11 Physics server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
