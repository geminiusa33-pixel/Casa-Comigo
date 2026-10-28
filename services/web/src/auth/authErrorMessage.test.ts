import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./authErrorMessage";

describe("authErrorMessage", () => {
  it("explains that a registered email should sign in", () => {
    expect(authErrorMessage("User already registered")).toContain("iniciar sessão");
  });

  it("localizes invalid credentials", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe("Email ou palavra-passe incorretos.");
  });
});
