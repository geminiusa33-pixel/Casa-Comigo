import { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  MessageBar,
  MessageBarBody,
  Spinner,
} from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowClockwise24Regular,
  Heart24Regular,
  Location24Regular,
  PeopleCommunity24Regular,
  ShieldCheckmark24Regular,
  Sparkle24Regular,
} from "@fluentui/react-icons";
import { apiRequest } from "../api/http";
import type { DiscoveryProfile } from "../api/profile";
import { ProfileSafetyActions } from "./ProfileSafetyActions";

type Props = {
  session: Session;
  onEditProfile: () => void;
};

export function DiscoveryView({ session, onEditProfile }: Props) {
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await apiRequest<DiscoveryProfile[]>("/api/discovery/profiles", session.access_token);
      setProfiles(results);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar a descoberta.");
    } finally {
      setLoading(false);
    }
  }, [session.access_token]);

  useEffect(() => { void loadProfiles(); }, [loadProfiles]);

  async function likeProfile(profile: DiscoveryProfile) {
    setLikingId(profile.id);
    setNotice("");
    setError("");
    try {
      const result = await apiRequest<{ liked: boolean; isMatch: boolean; matchId: string | null }>(
        `/api/profiles/${profile.id}/likes`,
        session.access_token,
        { method: "POST" },
      );
      setNotice(result.isMatch
        ? `É um match! Tu e ${profile.displayName} gostaram um do outro.`
        : `Gosto enviado a ${profile.displayName}. Se for recíproco, terão um match.`);
      await loadProfiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registar o gosto.");
    } finally {
      setLikingId(null);
    }
  }

  return (
    <section className="discovery-view" aria-labelledby="discovery-section-title">
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
        <span>Apenas mostramos perfis com áreas de procura compatíveis. A sua localização exata permanece privada.</span>
      </div>

      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}

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
                  <span className="discovery-profile-cover-orb discovery-profile-cover-orb-one" />
                  <span className="discovery-profile-cover-orb discovery-profile-cover-orb-two" />
                  <Badge appearance="tint" color="success">
                    <Location24Regular /> Zona compatível
                  </Badge>
                  <div className="discovery-profile-avatar">
                    <Avatar name={profile.displayName} size={64} />
                  </div>
                </div>

                <div className="discovery-profile-content">
                  <div className="discovery-profile-heading">
                    <div>
                      <h3>{profile.displayName}</h3>
                      <p><Location24Regular /> {profile.areaLabel}</p>
                    </div>
                    <span className="discovery-profile-index">{String(index + 1).padStart(2, "0")}</span>
                  </div>

                  <div className="discovery-profile-facts">
                    <span><PeopleCommunity24Regular /> Procura {profile.preferredHousemates} {profile.preferredHousemates === 1 ? "colega" : "colegas"}</span>
                    <span>{profile.hasPets ? "Animais bem-vindos" : "Sem animais indicados"}</span>
                  </div>

                  {profile.bio && <p className="discovery-profile-bio">{profile.bio}</p>}

                  {profile.interests.length > 0 && (
                    <div className="discovery-profile-interests" aria-label="Interesses">
                      {profile.interests.map((interest) => (
                        <Badge key={interest} appearance="tint">{interest}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="discovery-profile-details">
                    {profile.workSchedule && (
                      <div><span>Rotina</span><p>{profile.workSchedule}</p></div>
                    )}
                    {profile.cookingHabits && (
                      <div><span>Cozinha</span><p>{profile.cookingHabits}</p></div>
                    )}
                    {profile.opinions && (
                      <div><span>Convivência</span><p>{profile.opinions}</p></div>
                    )}
                  </div>

                  <div className="discovery-profile-actions">
                    <Button
                      className="discovery-like"
                      appearance="primary"
                      icon={<Heart24Regular />}
                      disabled={likingId !== null}
                      onClick={() => void likeProfile(profile)}
                    >
                      {likingId === profile.id ? "A enviar gosto…" : "Tenho interesse"}
                    </Button>
                    <span>O interesse só é partilhado quando gosta.</span>
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
