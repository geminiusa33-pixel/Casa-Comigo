import { useState, type FormEvent } from "react";
import { Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "../api/http";

type Props = {
  profileId: string;
  displayName: string;
  session: Session;
  onBlocked: () => void;
};

export function ProfileSafetyActions({ profileId, displayName, session, onBlocked }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function reportProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/profiles/${profileId}/reports`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setReason("");
      setReportOpen(false);
      setNotice("Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a denúncia.");
    } finally {
      setPending(false);
    }
  }

  async function blockProfile() {
    setPending(true);
    setError("");
    try {
      await apiRequest<void>(`/api/profiles/${profileId}/blocks`, session.access_token, { method: "POST" });
      onBlocked();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível bloquear este perfil.");
    } finally {
      setPending(false);
      setConfirmingBlock(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
      {confirmingBlock ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span>Bloquear {displayName}? Deixará de ver o perfil e a conversa será encerrada.</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button appearance="primary" disabled={pending} onClick={() => void blockProfile()}>
              {pending ? "A bloquear…" : "Confirmar bloqueio"}
            </Button>
            <Button appearance="secondary" disabled={pending} onClick={() => setConfirmingBlock(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button appearance="subtle" disabled={pending} onClick={() => { setError(""); setConfirmingBlock(true); }}>
            Bloquear perfil
          </Button>
          <Button appearance="subtle" disabled={pending} onClick={() => { setError(""); setReportOpen((open) => !open); }}>
            Denunciar
          </Button>
        </div>
      )}
      {reportOpen && (
        <form onSubmit={(event) => void reportProfile(event)} style={{ display: "grid", gap: 8 }}>
          <label htmlFor={`report-${profileId}`}>Explique o motivo da denúncia (5–1000 caracteres)</label>
          <textarea
            id={`report-${profileId}`}
            aria-label={`Motivo da denúncia de ${displayName}`}
            value={reason}
            maxLength={1000}
            minLength={5}
            required
            rows={3}
            onChange={(event) => setReason(event.target.value)}
            style={{ resize: "vertical", width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 8, border: "1px solid #c8c8c8", font: "inherit" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{reason.length}/1000</span>
            <Button type="submit" appearance="primary" disabled={pending || reason.trim().length < 5}>
              {pending ? "A enviar…" : "Enviar denúncia"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
