import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import {
  ChatMultiple24Regular,
  Home24Regular,
  Heart24Regular,
  PeopleCommunity24Regular,
  Person24Regular,
  Location24Regular,
} from "@fluentui/react-icons";
import { hasSupabasePublicConfig } from "../api/config";
import { apiRequest } from "../api/http";
import { supabase } from "../api/supabase";
import { AuthPanel } from "./AuthPanel";
import { BlockedProfiles } from "./BlockedProfiles";
import { DiscoveryView } from "./DiscoveryView";
import { MatchesView } from "./MatchesView";
import { ProfileEditor } from "./ProfileEditor";
import { LandingPage } from "./LandingPage";
import { ProfileAvatar } from "./ProfileAvatar";

const useStyles = makeStyles({
  app: { minHeight: "100vh", color: tokens.colorNeutralForeground1 },
  topbar: {
    height: "72px",
    padding: "0 5vw",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    "@media (max-width: 760px)": { padding: "0 5vw" },
  },
  brand: { display: "flex", alignItems: "center", gap: "11px" },
  brandMark: {
    width: "38px", height: "38px", borderRadius: "13px", display: "grid",
    placeItems: "center", backgroundColor: "#e7eee5", color: "#315b43",
  },
  brandName: { fontWeight: 700, letterSpacing: "-.4px" },
  topActions: { display: "flex", alignItems: "center", gap: "12px" },
  layout: {
    width: "min(1160px, 90vw)", margin: "38px auto 72px",
    display: "grid", gridTemplateColumns: "minmax(0, 1fr) 292px", gap: "32px",
    "@media (max-width: 760px)": { gridTemplateColumns: "1fr", width: "90vw", marginTop: "26px" },
  },
  heading: { marginBottom: "24px" },
  eyebrow: {
    color: "#58745e", fontSize: "12px", letterSpacing: "1.5px",
    textTransform: "uppercase", fontWeight: 700,
  },
  title: {
    margin: "7px 0 8px", fontSize: "34px", lineHeight: 1.15, letterSpacing: "-1px",
    "@media (max-width: 760px)": { fontSize: "29px" },
  },
  subtitle: { color: tokens.colorNeutralForeground2, margin: 0, lineHeight: 1.6 },
  nav: { margin: "24px 0" },
  hero: {
    padding: "28px", borderRadius: "18px",
    background: "linear-gradient(120deg, #eaf0e8 0%, #f1efe4 100%)",
    display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "center",
    "@media (max-width: 760px)": { gridTemplateColumns: "1fr" },
  },
  heroTitle: { fontSize: "21px", lineHeight: 1.3, margin: "0 0 8px", maxWidth: "470px" },
  heroText: { margin: 0, lineHeight: 1.55, color: "#4b5c50", maxWidth: "490px" },
  heroIcon: {
    width: "80px", height: "80px", borderRadius: "26px", display: "grid",
    placeItems: "center", backgroundColor: "rgba(255,255,255,.62)", color: "#47644d",
    "@media (max-width: 760px)": { display: "none" },
  },
  sectionTitle: { margin: "30px 0 14px", fontSize: "18px" },
  profileCard: { padding: "22px", borderRadius: "16px", boxShadow: "0 2px 10px rgba(32,42,34,.04)" },
  profileTop: { display: "flex", gap: "16px", alignItems: "center" },
  avatar: { width: "60px", height: "60px", backgroundColor: "#e7e9d8", color: "#43553c" },
  profileName: { fontSize: "18px", fontWeight: 650 },
  profileMeta: { color: tokens.colorNeutralForeground2, marginTop: "3px" },
  tags: { display: "flex", flexWrap: "wrap", gap: "8px", margin: "18px 0" },
  sideCard: { padding: "20px", borderRadius: "16px", marginBottom: "14px" },
  sideTitle: { fontWeight: 650, margin: "0 0 8px" },
  sideText: { margin: 0, color: tokens.colorNeutralForeground2, lineHeight: 1.55 },
  step: { display: "flex", gap: "11px", alignItems: "flex-start", marginTop: "16px" },
  stepDot: {
    minWidth: "25px", height: "25px", display: "grid", placeItems: "center",
    borderRadius: "50%", backgroundColor: "#edf1e9", color: "#45634d", fontWeight: 700, fontSize: "12px",
  },
  status: { marginTop: "18px" },
  footer: { marginTop: "18px", color: tokens.colorNeutralForeground3, fontSize: "12px", lineHeight: 1.5 },
});

const navItems = [
  { value: "descobrir", label: "Descobrir", icon: <PeopleCommunity24Regular /> },
  { value: "matches", label: "Conversas", icon: <ChatMultiple24Regular /> },
  { value: "casas", label: "Casas", icon: <Home24Regular /> },
  { value: "favoritos", label: "Favoritos", icon: <Heart24Regular /> },
  { value: "perfil", label: "Perfil", icon: <Person24Regular /> },
];

export function App() {
  const styles = useStyles();
  const [selected, setSelected] = useState("descobrir");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"landing" | "sign-in" | "sign-up">("landing");
  const [apiIdentity, setApiIdentity] = useState<string | null>(null);
  const [apiError, setApiError] = useState("");
  const [ownPhotoPath, setOwnPhotoPath] = useState<string | null>(null);
  const currentLabel = navItems.find((item) => item.value === selected)?.label ?? "Descobrir";
  const updateOwnPhotoPath = useCallback((photoPath: string | null) => setOwnPhotoPath(photoPath), []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setApiError(`Não foi possível recuperar a sessão: ${error.message}`);
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setApiIdentity(null);
      setApiError("");
      setOwnPhotoPath(null);
      return;
    }

    const controller = new AbortController();
    void apiRequest<{ userId: string; email: string | null }>(
      "/api/auth/session",
      session.access_token,
      { signal: controller.signal },
    ).then((identity) => {
      setApiIdentity(identity.userId);
      setApiError("");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setApiError(error instanceof Error ? error.message : "Não foi possível validar a sessão na API.");
      }
    });

    return () => controller.abort();
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const controller = new AbortController();
    void apiRequest<{ photoPath: string | null }>("/api/profile", session.access_token, {
      signal: controller.signal,
    }).then((profile) => {
      setOwnPhotoPath(profile.photoPath ?? null);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.error("Não foi possível carregar a foto do perfil autenticado.", error);
      }
    });

    return () => controller.abort();
  }, [session?.access_token]);

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setApiError(`Não foi possível terminar a sessão: ${error.message}`);
  }

  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Spinner label="A carregar sessão…" /></div>;
  }

  if (!session) {
    if (authMode === "landing") {
      return <LandingPage onSignIn={() => setAuthMode("sign-in")} onSignUp={() => setAuthMode("sign-up")} />;
    }

    return (
      <AuthPanel
        onAuthenticated={setSession}
        initialMode={authMode}
        onBack={() => setAuthMode("landing")}
      />
    );
  }

  return (
    <div className={`${styles.app} member-app`}>
      <header className={`${styles.topbar} member-topbar`}>
        <div className={styles.brand}>
          <div className={styles.brandMark}><Home24Regular /></div>
          <Text className={styles.brandName} size={500}>casa comigo</Text>
        </div>
        <div className={styles.topActions}>
          <Badge className="member-environment" appearance="tint" color="success">Ambiente local</Badge>
          <div className="member-account">
            <ProfileAvatar name={session.user.email ?? "Utilizador"} photoPath={ownPhotoPath} size={32} />
            <Text className="member-email" size={300}>{session.user.email}</Text>
          </div>
          <Button className="member-signout" appearance="secondary" size="small" onClick={() => void signOut()}>Sair</Button>
        </div>
      </header>

      <div className={`${styles.layout} member-layout`}>
        <main className="member-main">
          <section className={`${styles.heading} member-heading`}>
            <Text className={styles.eyebrow}>Um bom começo para partilhar casa</Text>
            <h1 className={styles.title}>
              {currentLabel}<span className="member-heading-comma">,</span> <em>ao seu ritmo.</em>
            </h1>
            <p className={styles.subtitle}>Pessoas, espaços e rotinas que podem combinar com a sua próxima casa.</p>
          </section>

          <div className="member-tabs-wrap">
            <TabList
              className={styles.nav}
              selectedValue={selected}
              onTabSelect={(_, data) => setSelected(String(data.value))}
              aria-label="Navegação principal"
              vertical={false}
            >
              {navItems.map((item) => (
                <Tab
                  key={item.value}
                  value={item.value}
                  icon={item.value === "perfil"
                    ? <ProfileAvatar name={session.user.email ?? "Perfil"} photoPath={ownPhotoPath} size={24} />
                    : item.icon}
                >
                  {item.label}
                </Tab>
              ))}
            </TabList>
          </div>

          {selected === "descobrir" && <DiscoveryView session={session} onEditProfile={() => setSelected("perfil")} />}
          {selected === "matches" && <MatchesView session={session} />}
          {selected === "perfil" && (
            <>
              <ProfileEditor session={session} onPhotoPathChange={updateOwnPhotoPath} />
              <BlockedProfiles session={session} />
            </>
          )}
          {(selected === "casas" || selected === "favoritos") && (
            <Card className={styles.profileCard}>
              <Text weight="semibold">Esta área será ligada numa próxima etapa.</Text>
              <p>Por agora, pode completar o perfil e conhecer pessoas em zonas compatíveis.</p>
              <Button appearance="primary" onClick={() => setSelected("perfil")}>Completar perfil</Button>
            </Card>
          )}
        </main>

        <aside className="member-sidebar">
          <Card className={styles.sideCard}>
            <h2 className={styles.sideTitle}>Comece por aqui</h2>
            <p className={styles.sideText}>Pode atualizar as suas escolhas quando quiser. A localização precisa fica privada.</p>
            <div className={styles.step}><span className={styles.stepDot}>1</span><Text size={300}>Conte-nos um pouco sobre si</Text></div>
            <div className={styles.step}><span className={styles.stepDot}>2</span><Text size={300}>Escolha a zona e o raio de procura</Text></div>
            <div className={styles.step}><span className={styles.stepDot}>3</span><Text size={300}>Descubra pessoas e casas</Text></div>
          </Card>
          <Card className={styles.sideCard}>
            <h2 className={styles.sideTitle}><Location24Regular /> A sua privacidade primeiro</h2>
            <p className={styles.sideText}>A localização só deve ser pedida quando escolher configurar a sua área. Pode usar uma referência manual em vez de GPS.</p>
          </Card>
          <MessageBar className={styles.status} intent={apiError ? "error" : apiIdentity ? "success" : "warning"}>
            <MessageBarBody>
              {apiError
                ? `Sessão Supabase iniciada, mas a API não a validou: ${apiError}`
                : apiIdentity
                  ? "Sessão Supabase ativa e validada pela API local."
                  : hasSupabasePublicConfig
                    ? "A validar a sessão na API local…"
                    : "Configure services/web/.env.local para ligar ao Supabase local."}
            </MessageBarBody>
          </MessageBar>
          <p className={styles.footer}>A localização exata nunca é apresentada a outros utilizadores.</p>
        </aside>
      </div>
    </div>
  );
}
