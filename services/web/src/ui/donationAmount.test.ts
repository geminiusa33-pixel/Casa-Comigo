import { describe, expect, it } from "vitest";
import { parseDonationAmountCents } from "./donationAmount";

describe("parseDonationAmountCents", () => {
  it.each([
    ["0,50", 50],
    ["0.50", 50],
    ["1", 100],
    ["1,25", 125],
    ["20,00", 2000],
  ])("converts %s to cents", (value, expected) => {
    expect(parseDonationAmountCents(value)).toBe(expected);
  });

  it.each(["", "0,49", "20,01", "1,234", "-1", "abc"])(
    "rejects invalid donation amount %s",
    (value) => {
      expect(parseDonationAmountCents(value)).toBeNull();
    },
  );
});
