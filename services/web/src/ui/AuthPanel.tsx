import { useState, type FormEvent } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../api/supabase";
import { authErrorMessage } from "../auth/authErrorMessage";

const useStyles = makeStyles({
  page: {
    minHeight: "calc(100vh - 73px)",
    display: "grid",
    placeItems: "center",
    padding: "32px 20px",
  },
  card: {
    width: "min(100%, 440px)",
    padding: "32px",
    borderRadius: "20px",
    boxShadow: "0 8px 32px rgba(32,42,34,.07)",
  },
  title: { margin: "8px 0", fontSize: "30px", letterSpacing: "-.7px" },
  description: { margin: "0 0 24px", color: tokens.colorNeutralForeground2, lineHeight: 1.6 },
  form: { display: "grid", gap: "16px" },
  field: { display: "grid", gap: "7px" },
  switch: { marginTop: "20px", textAlign: "center" },
  note: { marginTop: "16px", color: tokens.colorNeutralForeground3, lineHeight: 1.5 },
});

type AuthPanelProps = {
  onAuthenticated: (session: Session) => void;
};

export function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const styles = useStyles();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  if (!supabase) {
    return (
      <div className={styles.page}>
        <Card className={styles.card}>
          <Text weight="semibold">Ligue-se ao Supabase local</Text>
          <p className={styles.note}>
            Configure o URL e a chave pública em services/web/.env.local e reinicie o frontend.
          </p>
        </Card>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const authClient = supabase;
    if (!authClient) {
      setError("A configuração do Supabase local não está disponível. Reinicie o frontend após configurar o ambiente.");
      return;
    }

    if (mode === "sign-up" && password.length < 8) {
      setError("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }

    setPending(true);
    try {
      const result = mode === "sign-up"
        ? await authClient.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { display_name: displayName.trim() } },
          })
        : await authClient.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) {
        setError(authErrorMessage(result.error.message));
      } else if (result.data.session) {
        onAuthenticated(result.data.session);
      } else if (mode === "sign-up") {
        setNotice("Conta criada. Confirme o email para entrar; em local, veja a mensagem no Inbucket.");
      } else {
        setError("A autenticação terminou sem uma sessão. Tente novamente.");
      }
    } catch (caught) {
      setError(authErrorMessage(caught instanceof Error ? caught.message : "Erro inesperado."));
    } finally {
      setPending(false);
    }
  }

  const isSignUp = mode === "sign-up";

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <Text size={200} weight="semibold" style={{ color: "#58745e" }}>
          {isSignUp ? "A sua próxima casa começa aqui" : "Bem-vindo de volta"}
        </Text>
        <h1 className={styles.title}>{isSignUp ? "Crie a sua conta" : "Inicie sessão"}</h1>
        <p className={styles.description}>
          {isSignUp
            ? "Registe-se para começar a preparar o seu perfil de partilha."
            : "Entre para continuar a preparar a sua experiência Casa Comigo."}
        </p>

        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
        {notice && <MessageBar intent="success"><MessageBarBody>{notice}</MessageBarBody></MessageBar>}

        <form className={styles.form} onSubmit={handleSubmit}>
          {isSignUp && (
            <div className={styles.field}>
              <Label htmlFor="display-name" required>Nome a apresentar</Label>
              <Input
                id="display-name"
                autoComplete="name"
                maxLength={80}
                value={displayName}
                onChange={(_, data) => setDisplayName(data.value)}
                required
              />
            </div>
          )}
          <div className={styles.field}>
            <Label htmlFor="auth-email" required>Email</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(_, data) => setEmail(data.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <Label htmlFor="auth-password" required>Palavra-passe</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={isSignUp ? 8 : undefined}
              value={password}
              onChange={(_, data) => setPassword(data.value)}
              required
            />
          </div>
          <Button type="submit" appearance="primary" disabled={pending}>
            {pending ? "Aguarde…" : isSignUp ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <div className={styles.switch}>
          <Text size={300}>
            {isSignUp ? "Já tem conta? " : "Ainda não tem conta? "}
          </Text>
          <Button
            appearance="transparent"
            disabled={pending}
            onClick={() => {
              setMode(isSignUp ? "sign-in" : "sign-up");
              setError("");
              setNotice("");
            }}
          >
            {isSignUp ? "Iniciar sessão" : "Registar"}
          </Button>
        </div>
        <p className={styles.note}>
          A autenticação usa o Supabase local. A sua palavra-passe não é enviada nem guardada pela API Casa Comigo.
        </p>
      </Card>
    </div>
  );
}
