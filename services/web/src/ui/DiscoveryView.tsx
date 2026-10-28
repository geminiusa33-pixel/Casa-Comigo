import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
} from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowClockwise24Regular,
  Dismiss24Regular,
  Chat24Regular,
  Heart24Regular,
  Location24Regular,
  PeopleCommunity24Regular,
  ShieldCheckmark24Regular,
  Sparkle24Regular,
} from "@fluentui/react-icons";
import { apiRequest } from "../api/http";
import type { DiscoveryProfile, Profile } from "../api/profile";
import type { HousingGroup } from "../api/housingGroups";
import { ProfileSafetyActions } from "./ProfileSafetyActions";
import { ProfilePreferenceSummary } from "./ProfilePreferenceSummary";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfilePhoto } from "./ProfilePhoto";
import { RentContributionSummary } from "./RentContributionSummary";

type Props = {
  session: Session;
  onEditProfile: () => void;
  onOpenConversation: (matchId: string) => void;
};

export function DiscoveryView({ session, onEditProfile, onOpenConversation }: Props) {
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<HousingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOnProfileId, setActingOnProfileId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newMatch, setNewMatch] = useState<{ id: string; displayName: string } | null>(null);
  const [actingOnGroupId, setActingOnGroupId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [results, currentProfile, housingGroups] = await Promise.all([
        apiRequest<DiscoveryProfile[]>("/api/discovery/profiles", session.access_token),
        apiRequest<Profile>("/api/profile", session.access_token),
        apiRequest<HousingGroup[]>("/api/housing-groups/discovery", session.access_token),
      ]);
      setProfiles(results);
      setOwnProfile(currentProfile);
      setGroups(housingGroups);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar a descoberta.");
    } finally {
      setLoading(false);
    }
  }, [session.access_token]);

  useEffect(() => { void loadProfiles(); }, [loadProfiles]);

  async function likeProfile(profile: DiscoveryProfile) {
    setActingOnProfileId(profile.id);
    setNotice("");
    setError("");
    try {
      const result = await apiRequest<{ liked: boolean; isMatch: boolean; matchId: string | null }>(
        `/api/profiles/${profile.id}/likes`,
        session.access_token,
        { method: "POST" },
      );
      if (result.isMatch) {
        if (!result.matchId) throw new Error("O match foi criado, mas a API não devolveu a conversa.");
        setNewMatch({ id: result.matchId, displayName: profile.displayName });
      } else {
        setNotice(`Gosto enviado a ${profile.displayName}. Se for recíproco, terão um match.`);
      }
      setProfiles((current) => current.filter((candidate) => candidate.id !== profile.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registar o gosto.");
    } finally {
      setActingOnProfileId(null);
    }
  }

  async function passProfile(profile: DiscoveryProfile) {
    setActingOnProfileId(profile.id);
    setNotice("");
    setError("");
    try {
      await apiRequest<void>(
        `/api/profiles/${profile.id}/passes`,
        session.access_token,
        { method: "POST" },
      );
      setProfiles((current) => current.filter((candidate) => candidate.id !== profile.id));
      setNotice(`${profile.displayName} foi ocultado da descoberta. Poderá voltar a aparecer dentro de três dias.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível ocultar este perfil.");
    } finally {
      setActingOnProfileId(null);
    }
  }

  async function requestToJoin(group: HousingGroup) {
    setActingOnGroupId(group.id);
    setNotice("");
    setError("");
    try {
      await apiRequest<{ id: string; status: string }>(
        `/api/housing-groups/${group.id}/join-requests`,
        session.access_token,
        { method: "POST" },
      );
      setNotice(`Pedido enviado ao grupo (${group.memberCount}/${group.targetOccupants}). A entrada depende do acordo de todos os membros.`);
      await loadProfiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível pedir entrada no grupo.");
    } finally {
      setActingOnGroupId(null);
    }
  }

  return (
    <section className="discovery-view" aria-labelledby="discovery-section-title">
      <Dialog
        open={newMatch !== null}
        onOpenChange={(_, data) => {
          if (!data.open) setNewMatch(null);
        }}
      >
        <DialogSurface className="discovery-match-dialog">
          <DialogBody>
            <div className="discovery-match-dialog-art" aria-hidden="true">
              <span><Heart24Regular /></span>
              <i><Chat24Regular /></i>
            </div>
            <DialogTitle className="discovery-match-dialog-title">Deu match!</DialogTitle>
            <DialogContent className="discovery-match-dialog-content">
              Tu e {newMatch?.displayName} têm interesse em conhecer-se. A conversa já está disponível.
            </DialogContent>
            <DialogActions className="discovery-match-dialog-actions">
              <Button appearance="secondary" onClick={() => setNewMatch(null)}>
                Continuar a descobrir
              </Button>
              <Button
                appearance="primary"
                icon={<Chat24Regular />}
                onClick={() => {
                  if (newMatch) onOpenConversation(newMatch.id);
                }}
              >
                Ir conversar
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <div className="discovery-toolbar">
        <div>
          <div className="discovery-kicker"><Sparkle24Regular /> Afinidade começa pela convivência</div>
          <h2 id="discovery-section-title">Pessoas compatíveis</h2>
          <p>Conheça quem procura casa na sua zona e partilha um ritmo de vida parecido.</p>
        </div>
        <Button
          className="discovery-refresh"
          appearance="secondary"
          icon={<ArrowClockwise24Regular />}
          disabled={loading}
          onClick={() => void loadProfiles()}
        >
          Atualizar
        </Button>
      </div>

      <div className="discovery-assurance">
        <ShieldCheckmark24Regular />
        <span>O centro de cada área tem de ficar dentro do raio escolhido pela outra pessoa, nos dois sentidos. É o único critério obrigatório; a localização exata permanece privada.</span>
      </div>

      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}

      {groups.length > 0 && (
        <section className="discovery-housing-groups" aria-labelledby="discovery-groups-title">
          <div>
            <h3 id="discovery-groups-title">Grupos com lugares disponíveis</h3>
            <p>A lotação tem de coincidir e a área tem de ser compatível com todos os membros. A entrada requer aprovação unânime.</p>
          </div>
          <div className="discovery-housing-groups-grid">
            {groups.map((group) => (
              <Card key={group.id} className="discovery-housing-group-card">
                <div className="discovery-housing-group-heading">
                  <div>
                    <Badge appearance="tint" color="success">Grupo aberto</Badge>
                    <strong className="discovery-housing-group-name">{group.name}</strong>
                    <h4>{group.memberCount}/{group.targetOccupants} pessoas</h4>
                    <p>{group.targetOccupants - group.memberCount} lugar(es) disponível(is)</p>
                  </div>
                  <PeopleCommunity24Regular />
                </div>
                <RentContributionSummary
                  amount={group.totalMonthlyRentContribution}
                  label="Soma mensal indicada pelo grupo"
                />
                <div className="discovery-housing-group-members">
                  {group.members.map((member) => (
                    <div key={member.profileId}>
                      <ProfileAvatar name={member.displayName} photoPath={member.photoPath} />
                      <span>
                        <strong>{member.displayName}</strong>
                        <small>{member.areaLabel} · Máximo renda: {formatMaximumRent(member.maximumMonthlyRentContribution)}</small>
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  appearance="primary"
                  disabled={actingOnGroupId !== null || group.myJoinRequestStatus === "pending"}
                  onClick={() => void requestToJoin(group)}
                >
                  {actingOnGroupId === group.id
                    ? "A enviar pedido…"
                    : group.myJoinRequestStatus === "pending"
                      ? "Pedido a aguardar acordo"
                      : group.myJoinRequestStatus === "declined"
                        ? "Pedir novamente"
                        : "Pedir para entrar"}
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {loading && (
        <div className="discovery-loading" aria-live="polite">
          <Spinner label="A procurar perfis compatíveis…" />
        </div>
      )}

      {!loading && !error && profiles.length === 0 && (
        <div className="discovery-empty-wrap">
          <Card>
            <div className="discovery-empty-art" aria-hidden="true">
              <span className="discovery-empty-orbit discovery-empty-orbit-one" />
              <span className="discovery-empty-orbit discovery-empty-orbit-two" />
              <span className="discovery-empty-home"><PeopleCommunity24Regular /></span>
            </div>
            <div className="discovery-empty-copy">
              <Badge appearance="tint" color="success">A sua procura começa aqui</Badge>
              <h3>Ainda não há perfis para mostrar</h3>
              <p>
                Complete o perfil, escolha uma zona de procura e ative a descoberta.
                Mostraremos pessoas quando as áreas forem mutuamente compatíveis.
              </p>
              <Button appearance="primary" onClick={onEditProfile}>Rever o meu perfil</Button>
            </div>
          </Card>
          <div className="discovery-empty-footnote">
            <Location24Regular />
            <span>Está tudo bem ir ao seu ritmo. Novos perfis compatíveis aparecerão aqui.</span>
          </div>
        </div>
      )}

      {!loading && profiles.length > 0 && (
        <div className="discovery-grid">
          {profiles.map((profile, index) => (
            <article className={`discovery-profile discovery-profile-${index % 3}`} key={profile.id}>
              <Card>
                <div className="discovery-profile-cover">
                  {profile.photoPath ? (
                    <ProfilePhoto name={profile.displayName} photoPath={profile.photoPath} />
                  ) : (
                    <>
                      <span className="discovery-profile-cover-orb discovery-profile-cover-orb-one" />
                      <span className="discovery-profile-cover-orb discovery-profile-cover-orb-two" />
                      <div className="discovery-profile-avatar">
                        <ProfileAvatar name={profile.displayName} size={64} />
                      </div>
                    </>
                  )}
                  <Badge appearance="tint" color="success">
                    <Location24Regular /> Critério essencial · zona compatível
                  </Badge>
                </div>

                <div className="discovery-profile-content">
                  <div className="discovery-profile-heading">
                    <div>
                      <h3>{profile.displayName}</h3>
                      <p><Location24Regular /> {profile.areaLabel}</p>
                    </div>
                    <span className="discovery-profile-index">{String(index + 1).padStart(2, "0")}</span>
                  </div>

                  <p className="discovery-profile-bio">
                    {profile.bio || "Ainda não adicionou uma descrição."}
                  </p>

                  <RentContributionSummary
                    amount={sumKnownContributions(ownProfile?.monthlyBudget, profile.monthlyBudget)}
                    label="Soma mensal indicada pelo par"
                  />
                  <ProfilePreferenceSummary profile={profile} compareWith={ownProfile ?? undefined} />

                  <div className="discovery-profile-actions">
                    <Button
                      className="discovery-like"
                      appearance="primary"
                      icon={<Heart24Regular />}
                      disabled={actingOnProfileId !== null}
                      onClick={() => void likeProfile(profile)}
                    >
                      {actingOnProfileId === profile.id ? "A enviar…" : "Tenho interesse"}
                    </Button>
                    <Button
                      className="discovery-pass"
                      appearance="secondary"
                      icon={<Dismiss24Regular />}
                      disabled={actingOnProfileId !== null}
                      onClick={() => void passProfile(profile)}
                    >
                      Não tenho interesse
                    </Button>
                    <span>Se não escolher, este perfil pode voltar a aparecer.</span>
                  </div>
                  <div className="discovery-profile-safety">
                    <ProfileSafetyActions
                      profileId={profile.id}
                      displayName={profile.displayName}
                      session={session}
                      onBlocked={() => {
                        setProfiles((current) => current.filter((candidate) => candidate.id !== profile.id));
                        setNotice(`O perfil de ${profile.displayName} foi bloqueado.`);
                      }}
                    />
                  </div>
                </div>
              </Card>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatMaximumRent(value: number | null) {
  return value === null
    ? "não indicado"
    : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function sumKnownContributions(...values: Array<number | null | undefined>) {
  const knownValues = values.filter((value): value is number => value != null);
  return knownValues.length ? knownValues.reduce((total, value) => total + value, 0) : null;
}
