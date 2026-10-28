import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
} from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "../api/http";
import type { HousingGroup, HousingGroupMember, HousingGroupMessage } from "../api/housingGroups";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfilePreferenceSummary } from "./ProfilePreferenceSummary";
import { RentContributionSummary } from "./RentContributionSummary";
import { formatRentContributionRange } from "./rentContributionRanges";

type Props = { session: Session; initialMatchId?: string | null; initialGroupId?: string | null };
type ProfileToView = Pick<HousingGroupMember, "displayName" | "photoPath" | "areaLabel" | "rentContributionRange" | "profile">;

export function HousingGroupsPanel({ session, initialMatchId, initialGroupId }: Props) {
  const [groups, setGroups] = useState<HousingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [messages, setMessages] = useState<HousingGroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileToView, setProfileToView] = useState<ProfileToView | null>(null);
  const [editingGroupId, setEditingGroupId] = useState("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [confirmLeaveGroupId, setConfirmLeaveGroupId] = useState("");
  const groupsRequestInFlight = useRef(false);

  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    if (groupsRequestInFlight.current) return;
    groupsRequestInFlight.current = true;
    try {
      const results = await apiRequest<HousingGroup[]>("/api/housing-groups", session.access_token, { signal });
      setGroups(results);
      setSelectedGroupId((current) => current && results.some((group) => group.id === current)
        ? current
        : results[0]?.id ?? "");
      setError("");
    } catch (caught) {
      if (!signal?.aborted) setError(caught instanceof Error ? caught.message : "Não foi possível carregar os grupos.");
    } finally {
      if (!signal?.aborted) setLoading(false);
      groupsRequestInFlight.current = false;
    }
  }, [session.access_token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadGroups(controller.signal);
    const intervalId = window.setInterval(() => void loadGroups(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [loadGroups]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId],
  );

  useEffect(() => {
    if (initialGroupId && groups.some((group) => group.id === initialGroupId)) {
      setSelectedGroupId(initialGroupId);
      return;
    }
    if (!initialMatchId) return;
    const originatingGroup = groups.find((group) => group.originMatchId === initialMatchId);
    if (originatingGroup) setSelectedGroupId(originatingGroup.id);
  }, [groups, initialGroupId, initialMatchId]);

  useEffect(() => {
    if (!selectedGroupId) {
      setMessages([]);
      return;
    }

    const controller = new AbortController();
    let requestInFlight = false;
    setMessages([]);
    const loadMessages = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const results = await apiRequest<HousingGroupMessage[]>(
          `/api/housing-groups/${selectedGroupId}/messages`,
          session.access_token,
          { signal: controller.signal },
        );
        setMessages(results);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Não foi possível carregar as mensagens do grupo.");
      } finally {
        requestInFlight = false;
      }
    };
    void loadMessages();
    const intervalId = window.setInterval(() => void loadMessages(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [selectedGroupId, session.access_token]);

  async function voteOnRequest(requestId: string, accept: boolean) {
    setWorking(requestId);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ status: string }>(
        `/api/housing-groups/join-requests/${requestId}/votes`,
        session.access_token,
        { method: "POST", body: JSON.stringify({ accept }) },
      );
      setNotice(result.status === "accepted"
        ? "A pessoa foi aceite no grupo por unanimidade."
        : result.status === "declined"
          ? "O pedido foi recusado."
          : "Voto registado. O pedido aguarda a decisão dos restantes membros.");
      await loadGroups();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registar o voto.");
    } finally {
      setWorking("");
    }
  }

  async function confirmCompletion(groupId: string) {
    setWorking(groupId);
    setError("");
    setNotice("");
    try {
      await apiRequest<void>(
        `/api/housing-groups/${groupId}/completion-confirmations`,
        session.access_token,
        { method: "POST" },
      );
      setNotice("Confirmação registada. O grupo deixa de aparecer na descoberta quando todos concordarem.");
      await loadGroups();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível confirmar a conclusão.");
    } finally {
      setWorking("");
    }
  }

  async function renameGroup(event: FormEvent<HTMLFormElement>, groupId: string) {
    event.preventDefault();
    const name = groupNameDraft.trim();
    if (!name || working) return;
    setWorking(groupId);
    setError("");
    setNotice("");
    try {
      await apiRequest<void>(
        `/api/housing-groups/${groupId}/name`,
        session.access_token,
        { method: "PUT", body: JSON.stringify({ name }) },
      );
      setGroups((current) => current.map((group) => group.id === groupId ? { ...group, name } : group));
      setEditingGroupId("");
      setNotice("Nome do grupo atualizado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar o nome do grupo.");
    } finally {
      setWorking("");
    }
  }

  async function leaveGroup(group: HousingGroup) {
    setWorking(group.id);
    setError("");
    setNotice("");
    try {
      await apiRequest<void>(
        `/api/housing-groups/${group.id}/members/me`,
        session.access_token,
        { method: "DELETE" },
      );
      const remainingGroups = groups.filter((candidate) => candidate.id !== group.id);
      setGroups(remainingGroups);
      setSelectedGroupId((current) => current === group.id ? remainingGroups[0]?.id ?? "" : current);
      setConfirmLeaveGroupId("");
      setNotice(`Saiu do grupo ${group.name}. Os membros deixam de aparecer na sua descoberta de pessoas, salvo se ainda partilharem outro grupo.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível sair do grupo.");
    } finally {
      setWorking("");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedGroupId || !body || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await apiRequest<HousingGroupMessage>(
        `/api/housing-groups/${selectedGroupId}/messages`,
        session.access_token,
        { method: "POST", body: JSON.stringify({ body }) },
      );
      setMessages((current) => current.some((existing) => existing.id === message.id) ? current : [...current, message]);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Spinner label="A carregar grupos de coabitação…" />;

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <Dialog
        open={profileToView !== null}
        onOpenChange={(_, data) => {
          if (!data.open) setProfileToView(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Perfil de {profileToView?.displayName}</DialogTitle>
            {profileToView && (
              <DialogContent>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <ProfileAvatar name={profileToView.displayName} photoPath={profileToView.photoPath} />
                  <div>
                    <Text weight="semibold">{profileToView.displayName}</Text>
                    <Text as="p" size={200} style={{ margin: "3px 0" }}>{profileToView.areaLabel}</Text>
                  </div>
                </div>
                {profileToView.profile.bio && <p>{profileToView.profile.bio}</p>}
                <Text size={200}>Escalão de renda: {formatRentContributionRange(profileToView.rentContributionRange)}</Text>
                <ProfilePreferenceSummary profile={profileToView.profile} />
              </DialogContent>
            )}
            <DialogActions>
              <Button appearance="secondary" onClick={() => setProfileToView(null)}>Fechar perfil</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <div>
        <h2 style={{ marginBottom: 4 }}>Os meus grupos de coabitação</h2>
        <p style={{ marginTop: 0 }}>Um match recíproco inicia um grupo quando ambos escolheram a mesma lotação. Novas entradas precisam do acordo de todos.</p>
      </div>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}
      {groups.length === 0 && (
        <Card style={{ padding: 20 }}>
          <Text>Ainda não tem grupos. Quando um match escolher a mesma lotação total, ambos iniciam um grupo.</Text>
        </Card>
      )}
      {groups.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
          <div style={{ display: "grid", alignContent: "start", gap: 12 }}>
            {groups.map((group) => {
              const confirmed = group.members.filter((member) => member.confirmedCompletion).length;
              return (
                <Card key={group.id} style={{ padding: 16, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                    <div>
                      <Text weight="semibold" size={400}>{group.name}</Text>
                      <Text as="p" size={200} style={{ margin: "3px 0" }}>Grupo {group.memberCount}/{group.targetOccupants}</Text>
                      <Text as="p" style={{ margin: "4px 0" }}>
                        {group.status === "completed" ? "Concluído — deixou de aparecer na descoberta" : `${group.targetOccupants - group.memberCount} lugar(es) disponível(is)`}
                      </Text>
                    </div>
                    <Button
                      size="small"
                      appearance={selectedGroupId === group.id ? "primary" : "secondary"}
                      aria-pressed={selectedGroupId === group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                    >Conversar</Button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <RentContributionSummary
                      minimum={group.totalMonthlyRentMinimum}
                      maximum={group.totalMonthlyRentMaximum}
                      label="Soma mensal indicada pelo grupo"
                    />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {editingGroupId === group.id ? (
                      <form onSubmit={(event) => void renameGroup(event, group.id)} style={{ display: "flex", gap: 8 }}>
                        <Input
                          aria-label="Nome do grupo"
                          maxLength={80}
                          value={groupNameDraft}
                          onChange={(_, data) => setGroupNameDraft(data.value)}
                        />
                        <Button size="small" appearance="primary" type="submit" disabled={!groupNameDraft.trim() || working !== ""}>Guardar</Button>
                        <Button size="small" appearance="secondary" type="button" onClick={() => setEditingGroupId("")}>Cancelar</Button>
                      </form>
                    ) : (
                      <Button
                        size="small"
                        appearance="subtle"
                        onClick={() => {
                          setGroupNameDraft(group.name);
                          setEditingGroupId(group.id);
                        }}
                      >Editar nome</Button>
                    )}
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {group.members.map((member) => (
                      <button
                        key={member.profileId}
                        type="button"
                        onClick={() => setProfileToView(member)}
                        aria-label={`Ver perfil de ${member.displayName}`}
                        style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "inherit" }}
                      >
                        <ProfileAvatar name={member.displayName} photoPath={member.photoPath} />
                        <div style={{ display: "grid" }}>
                          <Text weight="semibold">{member.displayName}</Text>
                          <Text size={200}>{member.areaLabel} · {formatRentContributionRange(member.rentContributionRange)}</Text>
                        </div>
                      </button>
                    ))}
                  </div>
                  {group.status === "open" && (
                    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                      <Text size={200}>Concordaram em concluir: {confirmed}/{group.memberCount}</Text>
                      <Button
                        appearance="secondary"
                        disabled={working !== "" || group.members.some((member) => member.profileId === session.user.id && member.confirmedCompletion)}
                        onClick={() => void confirmCompletion(group.id)}
                      >
                        {working === group.id ? "A registar…" : "Concluído"}
                      </Button>
                    </div>
                  )}
                  {confirmLeaveGroupId === group.id ? (
                    <div className="group-leave-confirm" role="group" aria-label={`Confirmar saída de ${group.name}`}>
                      <Text size={200}>Vai deixar de fazer parte do grupo e da conversa. Poderá voltar a descobrir os restantes membros.</Text>
                      <div>
                        <Button
                          appearance="primary"
                          disabled={working !== ""}
                          onClick={() => void leaveGroup(group)}
                        >
                          {working === group.id ? "A sair…" : "Confirmar saída"}
                        </Button>
                        <Button appearance="secondary" disabled={working !== ""} onClick={() => setConfirmLeaveGroupId("")}>Manter-me no grupo</Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="group-leave-button"
                      appearance="secondary"
                      disabled={working !== ""}
                      onClick={() => setConfirmLeaveGroupId(group.id)}
                    >Sair do grupo</Button>
                  )}
                  {group.pendingRequests.length > 0 && (
                    <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                      <Text weight="semibold">Pedidos de entrada</Text>
                      {group.pendingRequests.map((request) => (
                        <div key={request.id} style={{ borderTop: "1px solid #e5e5e5", paddingTop: 10 }}>
                          <button
                            type="button"
                            onClick={() => setProfileToView(request)}
                            aria-label={`Ver perfil de ${request.displayName}`}
                            style={{ display: "flex", alignItems: "center", gap: 8, border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "inherit" }}
                          >
                            <ProfileAvatar name={request.displayName} photoPath={request.photoPath} />
                            <Text weight="semibold">{request.displayName} · Ver perfil</Text>
                          </button>
                          <Text as="p" size={200} style={{ margin: "3px 0 8px" }}>
                            {request.areaLabel} · {formatRentContributionRange(request.rentContributionRange)} · {request.approvalCount}/{request.requiredApprovals} votos
                          </Text>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button
                              size="small"
                              appearance="primary"
                              disabled={working !== ""}
                              onClick={() => void voteOnRequest(request.id, true)}
                            >{request.myVote ? "Aceite — alterar voto" : "Aceitar"}</Button>
                            <Button
                              size="small"
                              appearance="secondary"
                              disabled={working !== ""}
                              onClick={() => void voteOnRequest(request.id, false)}
                            >Recusar</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          {selectedGroup && (
            <Card style={{ padding: 18, display: "grid", gridTemplateRows: "auto minmax(220px, 1fr) auto", gap: 14, minHeight: 420, minWidth: 0 }}>
              <div>
                <Text size={400} weight="semibold">{selectedGroup.name} · {selectedGroup.memberCount}/{selectedGroup.targetOccupants}</Text>
                <Text as="p" size={200}>Só os membros deste grupo podem ler e enviar mensagens.</Text>
              </div>
              <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "4px 2px" }}>
                {messages.length === 0 && <Text>Ainda não há mensagens. Dê início à conversa.</Text>}
                {messages.map((message) => {
                  const isOwnMessage = message.senderId === session.user.id;
                  const sender = selectedGroup.members.find((member) => member.profileId === message.senderId)?.displayName ?? "Membro";
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
                      <Text size={100}>{isOwnMessage ? "Eu" : sender} · {new Date(message.sentAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</Text>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={(event) => void sendMessage(event)} style={{ display: "grid", gap: 8 }}>
                <textarea
                  aria-label="Escreva uma mensagem para o grupo"
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
