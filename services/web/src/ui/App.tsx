import { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
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
  ArrowUpRight24Regular,
} from "@fluentui/react-icons";
import { hasSupabasePublicConfig } from "../api/config";
import { apiRequest } from "../api/http";
import { supabase } from "../api/supabase";
import { AuthPanel } from "./AuthPanel";

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
  },
  heading: { marginBottom: "24px" },
  eyebrow: {
    color: "#58745e", fontSize: "12px", letterSpacing: "1.5px",
    textTransform: "uppercase", fontWeight: 700,
  },
  title: { margin: "7px 0 8px", fontSize: "34px", lineHeight: 1.15, letterSpacing: "-1px" },
  subtitle: { color: tokens.colorNeutralForeground2, margin: 0, lineHeight: 1.6 },
  nav: { margin: "24px 0" },
  hero: {
    padding: "28px", borderRadius: "18px",
    background: "linear-gradient(120deg, #eaf0e8 0%, #f1efe4 100%)",
    display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "center",
  },
  heroTitle: { fontSize: "21px", lineHeight: 1.3, margin: "0 0 8px", maxWidth: "470px" },
  heroText: { margin: 0, lineHeight: 1.55, color: "#4b5c50", maxWidth: "490px" },
  heroIcon: {
    width: "80px", height: "80px", borderRadius: "26px", display: "grid",
    placeItems: "center", backgroundColor: "rgba(255,255,255,.62)", color: "#47644d",
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
  "@media (max-width: 760px)": {
    topbar: { padding: "0 5vw" },
    layout: { gridTemplateColumns: "1fr", width: "90vw", marginTop: "26px" },
    hero: { gridTemplateColumns: "1fr" },
    heroIcon: { display: "none" },
    title: { fontSize: "29px" },
  },
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
  const [apiIdentity, setApiIdentity] = useState<string | null>(null);
  const [apiError, setApiError] = useState("");
  const currentLabel = navItems.find((item) => item.value === selected)?.label ?? "Descobrir";

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

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setApiError(`Não foi possível terminar a sessão: ${error.message}`);
  }

  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Spinner label="A carregar sessão…" /></div>;
  }

  if (!session) {
    return (
      <div className={styles.app}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandMark}><Home24Regular /></div>
            <Text className={styles.brandName} size={500}>casa comigo</Text>
          </div>
          <Badge appearance="tint" color="success">Ambiente local</Badge>
        </header>
        <AuthPanel onAuthenticated={setSession} />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}><Home24Regular /></div>
          <Text className={styles.brandName} size={500}>casa comigo</Text>
        </div>
        <div className={styles.topActions}>
          <Badge appearance="tint" color="success">Pré-visualização local</Badge>
          <Text size={300}>{session.user.email}</Text>
          <Button appearance="secondary" size="small" onClick={() => void signOut()}>Sair</Button>
          <Avatar name={session.user.email ?? "Utilizador"} size={32} />
        </div>
      </header>

      <div className={styles.layout}>
        <main>
          <section className={styles.heading}>
            <Text className={styles.eyebrow}>Um bom começo para partilhar casa</Text>
            <h1 className={styles.title}>{currentLabel}, ao seu ritmo.</h1>
            <p className={styles.subtitle}>Pessoas, espaços e rotinas que podem combinar com a sua próxima casa.</p>
          </section>

          <TabList
            className={styles.nav}
            selectedValue={selected}
            onTabSelect={(_, data) => setSelected(String(data.value))}
            aria-label="Navegação principal"
            vertical={false}
          >
            {navItems.map((item) => (
              <Tab key={item.value} value={item.value} icon={item.icon}>{item.label}</Tab>
            ))}
          </TabList>

          <section className={styles.hero}>
            <div>
              <h2 className={styles.heroTitle}>A sua próxima casa começa por conhecer quem a vai partilhar.</h2>
              <p className={styles.heroText}>Crie o seu perfil e indique uma zona de procura. Só mostramos a localização aproximada necessária para encontrar compatibilidade.</p>
              <Button appearance="primary" icon={<ArrowUpRight24Regular />} style={{ marginTop: 18 }}>
                Preparar perfil
              </Button>
            </div>
            <div className={styles.heroIcon}><PeopleCommunity24Regular fontSize={34} /></div>
          </section>

          <h2 className={styles.sectionTitle}>{selected === "casas" ? "Casas da comunidade" : "Uma primeira ideia de compatibilidade"}</h2>
          <Card className={styles.profileCard}>
            <CardHeader
              image={<Avatar className={styles.avatar} name="M" />}
              header={<Text className={styles.profileName}>O seu espaço está pronto para começar</Text>}
              description={<Text className={styles.profileMeta}>Adicione as suas preferências para preparar a descoberta.</Text>}
            />
            <div className={styles.tags}>
              <Badge appearance="tint" color="informative">Rotinas compatíveis</Badge>
              <Badge appearance="tint" color="informative">Zona de procura</Badge>
              <Badge appearance="tint" color="informative">Forma de partilhar</Badge>
            </div>
            <Divider />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16 }}>
              <Text size={300} style={{ color: "#66736a" }}>Ainda sem perfis: os resultados virão da API após autenticação.</Text>
              <Button appearance="secondary">Completar perfil</Button>
            </div>
          </Card>
        </main>

        <aside>
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
          <p className={styles.footer}>Fundação de interface. Os dados apresentados são apenas texto de orientação, não correspondem a perfis reais.</p>
        </aside>
      </div>
    </div>
  );
}
