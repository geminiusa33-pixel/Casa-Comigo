import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./http";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("supports successful no-content responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<void>("/api/profiles/example/blocks", "token", {
      method: "DELETE",
    })).resolves.toBeUndefined();
  });

  it("surfaces API problem details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: "Já enviaste uma denúncia sobre este perfil. Aguarda dez minutos antes de enviares outra." }),
      { status: 409, headers: { "Content-Type": "application/problem+json" } },
    )));

    await expect(apiRequest("/api/profiles/example/reports", "token", {
      method: "POST",
      body: JSON.stringify({ reason: "Spam" }),
    })).rejects.toThrow("Já enviaste uma denúncia sobre este perfil. Aguarda dez minutos antes de enviares outra.");
  });
});
