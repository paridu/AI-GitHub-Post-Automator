
import { GoogleGenAI, Type } from "@google/genai";
import { GithubProject } from "../types";

const API_KEY = process.env.API_KEY || '';

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async researchGithubProjects(): Promise<GithubProject[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: "Find 12 high-quality, trending, or interesting AI, Machine Learning, or Deep Learning repositories on GitHub. Include details: project name, URL, author, description, and the LICENSE type (e.g. MIT, Apache 2.0, GPL, or 'Not Specified').",
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                url: { type: Type.STRING },
                description: { type: Type.STRING },
                author: { type: Type.STRING },
                stars: { type: Type.STRING },
                topic: { type: Type.STRING },
                license: { type: Type.STRING }
              },
              required: ["name", "url", "description", "author", "license"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No data returned from AI research.");
      return JSON.parse(text);
    } catch (error) {
      console.error("Error researching GitHub:", error);
      throw error;
    }
  }

  private getStylePrompt(languageStyle: string): string {
    if (languageStyle === 'eastern-thai-mix') {
      return 'Thai (Eastern dialect style like Rayong/Chonburi, e.g., ending with "ฮิ", "นะฮิ") mixed with English technical terms. Tone is super friendly, localized, and coastal.';
    }
    return languageStyle === 'thai-english-mix' 
      ? 'Thai mixed with English (natural tech community slang).' 
      : 'Thai only (natural spoken style).';
  }

  async researchAndGenerateSingle(url: string, languageStyle: string): Promise<any> {
    const styleDescription = this.getStylePrompt(languageStyle);
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Research this GitHub repository: ${url}. 
        Then, generate a Facebook post content about it.
        
        Style Requirements:
        - Language: ${styleDescription}
        - Tone: Casual, friendly, and conversational (แบบคุยกับเพื่อน).
        - Spoken Language: Use particles naturally based on the dialect chosen.
        
        Formatting: Clear paragraphs, catchy headline, relatable pain point, solution intro, features/license, and CTA.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              project: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  url: { type: Type.STRING },
                  description: { type: Type.STRING },
                  author: { type: Type.STRING },
                  stars: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  license: { type: Type.STRING }
                },
                required: ["name", "url", "description", "author", "license"]
              },
              painPoint: { type: Type.STRING },
              solution: { type: Type.STRING },
              postContent: { type: Type.STRING }
            },
            required: ["project", "painPoint", "solution", "postContent"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Could not research this repository.");
      return JSON.parse(text);
    } catch (error) {
      console.error("Error researching specific repo:", error);
      throw error;
    }
  }

  async generateBatchPostContent(projects: GithubProject[], languageStyle: string): Promise<any[]> {
    const styleDescription = this.getStylePrompt(languageStyle);
    
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create Facebook post contents for these 12 projects: ${JSON.stringify(projects)}.
        
        Style Requirements:
        - Language: ${styleDescription}
        - Tone: Casual, friendly, and conversational (แบบคุยกับเพื่อน). Do NOT be formal.
        - Spoken Language: Use appropriate particles. If Eastern Thai is selected, use "ฮิ" naturally.
        
        Formatting Requirements:
        - Organize into clear paragraphs with double line breaks.
        - Structure:
          1. Headline: Use catchy emojis and a "friend-sharing-secret" vibe.
          2. Pain Point (The Story): Start with a relatable frustration.
          3. Solution & Project Intro: Introduce the repo as a cool discovery.
          4. Features & License: Mention what it does and its license.
          5. Call to Action: Friendly closing with URL.
          
        - Ensure high readability for mobile feed users.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                painPoint: { type: Type.STRING },
                solution: { type: Type.STRING },
                postContent: { type: Type.STRING }
              },
              required: ["painPoint", "solution", "postContent"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No content generated.");
      return JSON.parse(text);
    } catch (error) {
      console.error("Error generating batch content:", error);
      throw error;
    }
  }
}
