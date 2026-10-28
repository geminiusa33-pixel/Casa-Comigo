import { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
} from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "../api/http";
import type { DiscoveryProfile } from "../api/profile";
import { ProfileSafetyActions } from "./ProfileSafetyActions";

type Props = { session: Session };

export function DiscoveryView({ session }: Props) {
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
    <section style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>Pessoas compatíveis</h2>
        <p style={{ marginTop: 0 }}>Só aparecem pessoas cuja zona e raio também incluem a sua área. As coordenadas não são partilhadas.</p>
      </div>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
      {loading && <Spinner label="A procurar perfis compatíveis…" />}
      {!loading && !error && profiles.length === 0 && (
        <Card style={{ padding: 24 }}>
          <Text weight="semibold">Ainda não há perfis para mostrar</Text>
          <p>Confirme que completou o seu perfil, guardou uma zona e ativou a descoberta. Só são apresentados perfis em zonas mutuamente compatíveis.</p>
        </Card>
      )}
      {!loading && profiles.map((profile) => (
        <Card key={profile.id} style={{ padding: 22, borderRadius: 16 }}>
          <CardHeader
            image={<Avatar name={profile.displayName} />}
            header={<Text size={500} weight="semibold">{profile.displayName}</Text>}
            description={<Text>{profile.areaLabel} · procura {profile.preferredHousemates} colega(s)</Text>}
          />
          {profile.bio && <p>{profile.bio}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Badge appearance="tint">{profile.genderPreference === "any" ? "Sem preferência de género" : `Preferência: ${profile.genderPreference}`}</Badge>
            <Badge appearance="tint">{profile.hasPets ? "Animais em casa" : "Sem animais indicados"}</Badge>
            {profile.interests.map((interest) => <Badge key={interest} appearance="tint" color="informative">{interest}</Badge>)}
          </div>
          {profile.workSchedule && <p><strong>Rotina:</strong> {profile.workSchedule}</p>}
          {profile.cookingHabits && <p><strong>Cozinha:</strong> {profile.cookingHabits}</p>}
          {profile.opinions && <p><strong>Convivência:</strong> {profile.opinions}</p>}
          <Button
            appearance="primary"
            disabled={likingId !== null}
            onClick={() => void likeProfile(profile)}
            style={{ marginTop: 12 }}
          >
            {likingId === profile.id ? "A enviar gosto…" : "Gosto"}
          </Button>
          <ProfileSafetyActions
            profileId={profile.id}
            displayName={profile.displayName}
            session={session}
            onBlocked={() => {
              setProfiles((current) => current.filter((candidate) => candidate.id !== profile.id));
              setNotice(`O perfil de ${profile.displayName} foi bloqueado.`);
            }}
          />
        </Card>
      ))}
    </section>
  );
}
