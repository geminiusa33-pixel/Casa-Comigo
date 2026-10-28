import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, Card, CardHeader, MessageBar, MessageBarBody, Spinner, Text } from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "../api/http";
import type { ChatMessage, Match } from "../api/profile";
import { ProfileSafetyActions } from "./ProfileSafetyActions";
import { ProfilePreferenceSummary } from "./ProfilePreferenceSummary";
import { ProfileAvatar } from "./ProfileAvatar";

type Props = { session: Session };

export function MatchesView({ session }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState("");
  const [cancellingMatchId, setCancellingMatchId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Match[]>("/api/matches", session.access_token, { signal: controller.signal })
      .then((results) => {
        setMatches(results);
        setSelectedMatchId((current) => current || results[0]?.id || "");
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Não foi possível carregar os matches.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session.access_token]);

  useEffect(() => {
    if (!selectedMatchId) {
      setMessages([]);
      return;
    }

    const controller = new AbortController();
    let requestInFlight = false;
    setMessages([]);
    setMessagesLoading(true);
    setMessageError("");

    const loadMessages = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const result = await apiRequest<ChatMessage[]>(
          `/api/matches/${selectedMatchId}/messages`,
          session.access_token,
          { signal: controller.signal },
        );
        setMessages(result);
        setMessageError("");
      } catch (caught) {
        if (!controller.signal.aborted) {
          setMessageError(caught instanceof Error ? caught.message : "Não foi possível carregar as mensagens.");
        }
      } finally {
        requestInFlight = false;
        if (!controller.signal.aborted) setMessagesLoading(false);
      }
    };

    void loadMessages();
    const intervalId = window.setInterval(() => void loadMessages(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [selectedMatchId, session.access_token]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedMatchId || !body || sending) return;

    setSending(true);
    setMessageError("");
    try {
      const message = await apiRequest<ChatMessage>(
        `/api/matches/${selectedMatchId}/messages`,
        session.access_token,
        { method: "POST", body: JSON.stringify({ body }) },
      );
      setMessages((current) => current.some((existing) => existing.id === message.id)
        ? current
        : [...current, message]);
      setDraft("");
    } catch (caught) {
      setMessageError(caught instanceof Error ? caught.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function cancelMatch(match: Match) {
    setCancellingMatchId(match.id);
    setError("");
    setNotice("");
    try {
      await apiRequest<void>(`/api/matches/${match.id}`, session.access_token, { method: "DELETE" });
      const remainingMatches = matches.filter((candidate) => candidate.id !== match.id);
      setMatches(remainingMatches);
      setSelectedMatchId((current) => current === match.id ? remainingMatches[0]?.id ?? "" : current);
      setConfirmCancelId("");
      setNotice(`Match com ${match.displayName} cancelado. Se a área continuar compatível, podem voltar a descobrir-se e dar gosto novamente.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível cancelar o match.");
    } finally {
      setCancellingMatchId("");
    }
  }

  if (loading) return <Spinner label="A carregar matches…" />;

  const selectedMatch = matches.find((match) => match.id === selectedMatchId);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>Os seus matches</h2>
        <p style={{ marginTop: 0 }}>Um match só é criado depois de ambos gostarem um do outro. As conversas atualizam automaticamente.</p>
      </div>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
      {!error && matches.length === 0 && (
        <Card style={{ padding: 24 }}><Text>Ainda não tem matches. Continue a conhecer pessoas na descoberta.</Text></Card>
      )}
      {matches.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
          <div style={{ display: "grid", alignContent: "start", gap: 10 }}>
            {matches.map((match) => (
              <Card key={match.id} style={{ padding: 14, minWidth: 0 }}>
                <CardHeader
                  image={<ProfileAvatar name={match.displayName} photoPath={match.photoPath} />}
                  header={<Text weight="semibold">{match.displayName}</Text>}
                  description={<Text>{match.areaLabel} · {new Date(match.matchedAt).toLocaleDateString("pt-PT")}</Text>}
                  action={<Button
                    appearance={selectedMatchId === match.id ? "primary" : "secondary"}
                    size="small"
                    aria-pressed={selectedMatchId === match.id}
                    onClick={() => setSelectedMatchId(match.id)}
                  >Conversar</Button>}
                />
                {match.bio && <p>{match.bio}</p>}
                <div className="match-area-confirmation">
                  <span>Critério essencial cumprido</span>
                  <p>O centro de cada área está dentro do raio escolhido pela outra pessoa.</p>
                </div>
                <ProfilePreferenceSummary profile={match} />
                {confirmCancelId === match.id ? (
                  <div className="match-cancel-confirm" role="group" aria-label={`Confirmar cancelamento do match com ${match.displayName}`}>
                    <p>O match, a conversa e as mensagens serão eliminados. Ambos podem voltar a aparecer na descoberta se a área continuar compatível.</p>
                    <div>
                      <Button
                        appearance="primary"
                        disabled={cancellingMatchId !== ""}
                        onClick={() => void cancelMatch(match)}
                      >
                        {cancellingMatchId === match.id ? "A cancelar…" : "Confirmar cancelamento"}
                      </Button>
                      <Button appearance="secondary" disabled={cancellingMatchId !== ""} onClick={() => setConfirmCancelId("")}>Manter match</Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="match-cancel-button"
                    appearance="subtle"
                    disabled={cancellingMatchId !== ""}
                    onClick={() => setConfirmCancelId(match.id)}
                  >
                    Cancelar match
                  </Button>
                )}
                <ProfileSafetyActions
                  profileId={match.profileId}
                  displayName={match.displayName}
                  session={session}
                  onBlocked={() => {
                    setMatches((current) => current.filter((candidate) => candidate.id !== match.id));
                    setSelectedMatchId((current) => current === match.id
                      ? matches.find((candidate) => candidate.id !== match.id)?.id ?? ""
                      : current);
                  }}
                />
              </Card>
            ))}
          </div>
          {selectedMatch && (
            <Card style={{ padding: 18, display: "grid", gridTemplateRows: "auto minmax(220px, 1fr) auto", gap: 14, minHeight: 420, minWidth: 0 }}>
              <div>
                <Text size={400} weight="semibold">Conversa com {selectedMatch.displayName}</Text>
                <Text as="p" size={200}>A conversa é privada entre os participantes deste match.</Text>
              </div>
              {messageError && <MessageBar intent="error"><MessageBarBody>{messageError}</MessageBarBody></MessageBar>}
              <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "4px 2px" }}>
                {messagesLoading && messages.length === 0 && <Spinner label="A carregar mensagens…" />}
                {!messagesLoading && messages.length === 0 && !messageError && (
                  <Text>Ainda não há mensagens. Dê início à conversa.</Text>
                )}
                {messages.map((message) => {
                  const isOwnMessage = message.senderId === session.user.id;
                  return (
                    <div
                      key={message.id}
                      style={{
                        alignSelf: isOwnMessage ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        padding: "10px 13px",
                        borderRadius: 14,
                        background: isOwnMessage ? "#e7eee5" : "#f1f1ee",
                      }}
                    >
                      <Text as="p" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "0 0 5px" }}>{message.body}</Text>
                      <Text size={100}>{isOwnMessage ? "Eu" : selectedMatch.displayName} · {new Date(message.sentAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</Text>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={(event) => void sendMessage(event)} style={{ display: "grid", gap: 8 }}>
                <textarea
                  aria-label="Escreva uma mensagem"
                  maxLength={4000}
                  rows={3}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Escreva uma mensagem…"
                  style={{ resize: "vertical", width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 8, border: "1px solid #c8c8c8", font: "inherit" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text size={100}>{draft.length}/4000</Text>
                  <Button appearance="primary" type="submit" disabled={!draft.trim() || sending}>
                    {sending ? "A enviar…" : "Enviar"}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
