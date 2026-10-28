import type { DiscoveryProfile, Match } from "../api/profile";

type Props = {
  profile: PreferenceProfile;
  compareWith?: PreferenceProfile;
};

type PreferenceProfile = Partial<Pick<
    DiscoveryProfile | Match,
    | "preferredHousemates"
    | "genderPreference"
    | "hasPets"
    | "interests"
    | "opinions"
    | "workSchedule"
    | "cookingHabits"
    | "monthlyBudget"
    | "leaseHolderPreference"
    | "billsPreference"
    | "furnishedPreference"
    | "preferredBathrooms"
    | "preferredBedrooms"
    | "homeTypePreference"
    | "moveInTiming"
    | "minimumLeaseMonths"
  >>;

const genderLabels: Record<string, string> = {
  any: "Sem preferência de género",
  women: "Prefere mulheres",
  men: "Prefere homens",
  other: "Outra preferência de género",
};

const leaseLabels: Record<string, string> = {
  any: "Contrato: sem preferência",
  own_name: "Contrato em seu nome",
  joint: "Contrato em conjunto",
  other: "Contrato: a combinar",
};

const billsLabels: Record<string, string> = {
  discuss: "Despesas: a combinar",
  split_equally: "Despesas divididas por igual",
  separate: "Despesas separadas",
};

const furnishedLabels: Record<string, string> = {
  any: "Mobília: sem preferência",
  furnished: "Prefere casa mobilada",
  unfurnished: "Prefere casa sem mobília",
  partial: "Prefere mobília parcial",
};

const homeTypeLabels: Record<string, string> = {
  any: "Tipo de casa: sem preferência",
  apartment: "Prefere apartamento",
  house: "Prefere moradia",
  room: "Prefere quarto partilhado",
};

const moveInLabels: Record<string, string> = {
  flexible: "Mudança: flexível",
  immediately: "Mudança: assim que possível",
  one_to_three_months: "Mudança: dentro de 1 a 3 meses",
  three_plus_months: "Mudança: daqui a 3 ou mais meses",
};

export function ProfilePreferenceSummary({ profile, compareWith }: Props) {
  const preferences = getPreferenceFacts(profile);
  const sharedInterests = compareWith
    ? (profile.interests ?? []).filter((interest) => compareWith.interests?.includes(interest))
    : [];
  const shared = compareWith
    ? [
        ...sharedInterests.map((interest) => `Interesse em comum: ${interest}`),
        ...getSharedFacts(profile, compareWith),
      ]
    : [];
  const reconsider = compareWith
    ? getReconsiderableFacts(profile, compareWith)
    : preferences;

  return (
    <section className={`profile-compatibility-summary${compareWith ? " has-comparison" : ""}`} aria-label="Compatibilidade e preferências">
      {compareWith && (
        <div className="profile-common-facts">
          <h4>Em comum</h4>
          {shared.length
            ? <div>{shared.map((fact) => <span key={fact}>{fact}</span>)}</div>
            : <p>Ainda não há preferências iguais assinaladas.</p>}
        </div>
      )}
      <div className="profile-reconsider-facts">
        <h4>{compareWith ? "A conversar / reconsiderar" : "Pontos para conversar"}</h4>
        <small>Preferências flexíveis · não impedem o match</small>
        {reconsider.length
          ? <div>{reconsider.map((fact) => <span key={fact}>{fact}</span>)}</div>
          : <p>As preferências assinaladas estão alinhadas.</p>}
      </div>
    </section>
  );
}

const comparableFields = [
  ["preferredHousemates", "Lotação pretendida", (value: number | boolean | string) => `${value} pessoas no total`],
  ["genderPreference", "Género", (value: number | boolean | string) => genderLabels[String(value)] ?? String(value)],
  ["hasPets", "Animais", (value: number | boolean | string) => value ? "Sim" : "Não"],
  ["monthlyBudget", "Máximo para renda", (value: number | boolean | string) => `${Number(value).toLocaleString("pt-PT")} €/mês`],
  ["leaseHolderPreference", "Contrato", (value: number | boolean | string) => leaseLabels[String(value)] ?? String(value)],
  ["billsPreference", "Despesas", (value: number | boolean | string) => billsLabels[String(value)] ?? String(value)],
  ["furnishedPreference", "Mobília", (value: number | boolean | string) => furnishedLabels[String(value)] ?? String(value)],
  ["preferredBathrooms", "Casas de banho", (value: number | boolean | string) => String(value)],
  ["preferredBedrooms", "Quartos", (value: number | boolean | string) => String(value)],
  ["homeTypePreference", "Tipo de casa", (value: number | boolean | string) => homeTypeLabels[String(value)] ?? String(value)],
  ["moveInTiming", "Mudança", (value: number | boolean | string) => moveInLabels[String(value)] ?? String(value)],
  ["minimumLeaseMonths", "Contrato mínimo", (value: number | boolean | string) => `${value} meses`],
  ["workSchedule", "Rotina", (value: number | boolean | string) => String(value)],
  ["cookingHabits", "Cozinha", (value: number | boolean | string) => String(value)],
  ["opinions", "Convivência", (value: number | boolean | string) => String(value)],
] as const;

function getSharedFacts(profile: PreferenceProfile, other: PreferenceProfile) {
  return comparableFields.flatMap(([key, label, format]) => {
    const value = profile[key];
    if (value == null || value === "" || other[key] !== value) return [];
    return [`${label}: ${format(value)}`];
  });
}

function getReconsiderableFacts(profile: PreferenceProfile, other: PreferenceProfile) {
  const facts = comparableFields.flatMap(([key, label, format]) => {
    const value = profile[key];
    if (value == null || value === "") return [];
    if (other[key] == null || other[key] === "") return [`${label}: ${format(value)}`];
    if (other[key] === value) return [];
    return [`${label}: ${format(value)} / ${format(other[key])}`];
  });
  const unmatchedInterests = (profile.interests ?? [])
    .filter((interest) => !other.interests?.includes(interest));
  if (unmatchedInterests.length) facts.push(`Outros interesses: ${unmatchedInterests.join(", ")}`);
  return facts;
}

function getPreferenceFacts(profile: PreferenceProfile) {
  return getReconsiderableFacts(profile, {});
}
