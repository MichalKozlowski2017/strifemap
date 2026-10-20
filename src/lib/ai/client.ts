import OpenAI from "openai";

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAI(): OpenAI | null {
  if (!hasOpenAI()) return null;

  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    ...(baseURL ? { baseURL } : {}),
  });
}

export function modelName(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}
