import { describe, expect, it } from "vitest";
import {
  formatRentContributionRange,
  getRentContributionRange,
  RENT_CONTRIBUTION_RANGES,
  sumRentContributionRanges,
} from "./rentContributionRanges";

describe("rent contribution ranges", () => {
  it("offers only the four supported monthly buckets", () => {
    expect(RENT_CONTRIBUTION_RANGES.map(({ value }) => value)).toEqual([
      "200-300",
      "301-400",
      "401-500",
      "501-600",
    ]);
  });

  it("sums the lower and upper bounds separately", () => {
    expect(sumRentContributionRanges(["301-400", "301-400"])).toEqual({
      minimum: 602,
      maximum: 800,
    });
  });

  it("does not produce totals when a member has no valid range", () => {
    expect(sumRentContributionRanges(["200-300", null])).toBeNull();
    expect(getRentContributionRange("600")).toBeNull();
  });

  it("formats a selected bucket for profile summaries", () => {
    expect(formatRentContributionRange("401-500")).toBe("401 €–500 €/mês");
    expect(formatRentContributionRange(null)).toBe("Por indicar");
  });
});
