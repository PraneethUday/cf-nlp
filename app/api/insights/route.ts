import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
  }

  try {
    const { htmlContent } = await request.json();
    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const parsedHtml = await new Promise<string>((resolve, reject) => {
      const pythonScriptPath = path.resolve(
        process.cwd(),
        'OpenWebAgent/server/html_tools/html_parser.py'
      );
      const pythonProcess = spawn('python3', [pythonScriptPath]);

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          return reject(
            new Error(`Python script exited with code ${code}: ${errorOutput}`)
          );
        }
        resolve(output.trim());
      });

      pythonProcess.stdin.write(htmlContent);
      pythonProcess.stdin.end();
    });

    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following text from a Codeforces analytics page and provide insights about the user's profile. Focus on strengths, weaknesses, and improvement areas. Keep it concise and expert-like. Text: ${parsedHtml}`
    });

    return NextResponse.json({ insights: response.text });
  } catch (error: any) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights', details: error.message },
      { status: 500 }
    );
  }
}
