import { describe, expect, it } from "vitest";
import { apiBaseUrl, isSupabasePublicConfigComplete } from "./config";

describe("local application configuration", () => {
  it("uses the local API by default", () => {
    expect(apiBaseUrl).toBe("http://localhost:5080");
  });

  it("requires both public settings before connecting to Supabase", () => {
    expect(isSupabasePublicConfigComplete(undefined, "key")).toBe(false);
    expect(isSupabasePublicConfigComplete("http://localhost", undefined)).toBe(false);
    expect(isSupabasePublicConfigComplete("http://localhost", "key")).toBe(true);
  });
});
