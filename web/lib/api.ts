const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  return API_BASE_URL;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}