export const RENT_CONTRIBUTION_RANGES = [
  { value: "200-300", minimum: 200, maximum: 300, label: "200 €–300 €" },
  { value: "301-400", minimum: 301, maximum: 400, label: "301 €–400 €" },
  { value: "401-500", minimum: 401, maximum: 500, label: "401 €–500 €" },
  { value: "501-600", minimum: 501, maximum: 600, label: "501 €–600 €" },
] as const;

export function getRentContributionRange(value: string | null | undefined) {
  return RENT_CONTRIBUTION_RANGES.find((range) => range.value === value) ?? null;
}

export function sumRentContributionRanges(values: Array<string | null | undefined>) {
  const ranges = values.map(getRentContributionRange);
  if (ranges.length === 0 || ranges.some((range) => range === null)) return null;

  return {
    minimum: ranges.reduce((sum, range) => sum + (range?.minimum ?? 0), 0),
    maximum: ranges.reduce((sum, range) => sum + (range?.maximum ?? 0), 0),
  };
}

export function formatRentContributionRange(value: string | null | undefined) {
  const range = getRentContributionRange(value);
  return range ? `${range.label}/mês` : "Por indicar";
}
