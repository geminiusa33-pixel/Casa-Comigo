const minimumDonationCents = 50;
const maximumDonationCents = 2000;

export function parseDonationAmountCents(value: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;

  const euros = Number(match[1]);
  if (!Number.isSafeInteger(euros) || euros > 20) return null;

  const cents = euros * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents >= minimumDonationCents && cents <= maximumDonationCents
    ? cents
    : null;
}
