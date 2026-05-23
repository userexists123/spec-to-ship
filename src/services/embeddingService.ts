import { getAppConfig } from "./config";

interface OpenAIEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
  }>;
  error?: {
    message?: string;
  };
}

function assertEmbeddingVector(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error("Embedding provider did not return a vector.");
  }

  const vector = value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));

  if (vector.length !== 1536) {
    throw new Error(`Expected a 1536 dimension embedding vector but received ${vector.length}.`);
  }

  return vector;
}

export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export async function createEmbedding(input: string): Promise<number[]> {
  const config = getAppConfig();

  if (!config.openaiApiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiEmbeddingModel,
      input: input.slice(0, 12000)
    })
  });

  const body = (await response.json()) as OpenAIEmbeddingResponse;

  if (!response.ok) {
    throw new Error(body.error?.message || "Embedding request failed.");
  }

  return assertEmbeddingVector(body.data?.[0]?.embedding);
}