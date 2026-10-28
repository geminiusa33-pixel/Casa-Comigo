import { apiBaseUrl } from "./config";

export async function apiRequest<T>(
  path: string,
  accessToken?: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { detail?: string; title?: string } | undefined;
    throw new Error(body?.detail ?? body?.title ?? `Pedido à API falhou (${response.status}).`);
  }
  return response.json() as Promise<T>;
}
