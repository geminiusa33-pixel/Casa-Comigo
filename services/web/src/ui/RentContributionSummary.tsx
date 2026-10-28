type Props = {
  amount: number | null | undefined;
  label: string;
};

export function RentContributionSummary({ amount, label }: Props) {
  return (
    <div
      className={`rent-contribution-summary${amount == null ? " is-unavailable" : ""}`}
      aria-label={amount == null ? `${label}: sem valores indicados` : `${label}: ${formatAmount(amount)} por mês`}
    >
      <span>{label}</span>
      <strong>{amount == null ? "Sem valores indicados" : <>{formatAmount(amount)}<small>/mês</small></>}</strong>
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
