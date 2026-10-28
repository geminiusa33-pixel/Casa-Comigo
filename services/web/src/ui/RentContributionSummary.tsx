type Props = {
  minimum: number | null | undefined;
  maximum: number | null | undefined;
  label: string;
};

export function RentContributionSummary({ minimum, maximum, label }: Props) {
  const isMissing = minimum == null || maximum == null;
  return (
    <div
      className={`rent-contribution-summary${isMissing ? " is-unavailable" : ""}`}
      aria-label={isMissing ? `${label}: escalão por indicar` : `${label}: entre ${formatAmount(minimum)} e ${formatAmount(maximum)} por mês`}
    >
      <span>{label}</span>
      <strong>{isMissing ? "Escalão por indicar" : <>{formatAmount(minimum)}–{formatAmount(maximum)}<small>/mês</small></>}</strong>
    </div>
  );
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}
