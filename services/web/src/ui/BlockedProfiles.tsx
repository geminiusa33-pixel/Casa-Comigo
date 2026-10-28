import { useCallback, useEffect, useState } from "react";
import { Button, Card, MessageBar, MessageBarBody, Spinner, Text } from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "../api/http";

type BlockedProfile = {
  profileId: string;
  displayName: string;
  blockedAt: string;
};

type Props = { session: Session };

export function BlockedProfiles({ session }: Props) {
  const [profiles, setProfiles] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadBlockedProfiles = useCallback(async () => {
    setError("");
    try {
      const results = await apiRequest<BlockedProfile[]>("/api/profile/blocks", session.access_token);
      setProfiles(results);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os perfis bloqueados.");
    } finally {
      setLoading(false);
    }
  }, [session.access_token]);

  useEffect(() => { void loadBlockedProfiles(); }, [loadBlockedProfiles]);

  async function unblock(profileId: string) {
    setPendingId(profileId);
    setError("");
    try {
      await apiRequest<void>(`/api/profiles/${profileId}/blocks`, session.access_token, { method: "DELETE" });
      setProfiles((current) => current.filter((profile) => profile.profileId !== profileId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desbloquear este perfil.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card style={{ padding: 24, borderRadius: 16, marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Perfis bloqueados</h2>
      <p>As pessoas que bloqueou deixam de aparecer na descoberta e não podem continuar conversas consigo.</p>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {loading && <Spinner label="A carregar bloqueios…" />}
      {!loading && profiles.length === 0 && !error && <Text>Não tem perfis bloqueados.</Text>}
      {!loading && profiles.map((profile) => (
        <div key={profile.profileId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #e5e5e5" }}>
          <Text>{profile.displayName}</Text>
          <Button
            appearance="secondary"
            disabled={pendingId !== null}
            onClick={() => void unblock(profile.profileId)}
          >
            {pendingId === profile.profileId ? "A desbloquear…" : "Desbloquear"}
          </Button>
        </div>
      ))}
    </Card>
  );
}
