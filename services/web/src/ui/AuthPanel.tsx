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
import { Eye24Regular, EyeOff24Regular, Home24Regular } from "@fluentui/react-icons";
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
  initialMode: "sign-in" | "sign-up";
  onBack: () => void;
};

export function AuthPanel({ onAuthenticated, initialMode, onBack }: AuthPanelProps) {
  const styles = useStyles();
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot-password">(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  if (!supabase) {
    return (
      <div className={`${styles.page} auth-page`}>
        <section className="auth-story">
          <a className="landing-brand" href="#" onClick={(event) => { event.preventDefault(); onBack(); }}>
            <span className="landing-brand-mark"><Home24Regular /></span>
            <span>casa comigo<span className="landing-brand-period">.</span></span>
          </a>
          <div className="auth-story-copy">
            <span className="landing-eyebrow">Um bom lugar começa com as pessoas</span>
            <h1>Partilhar casa. Sentir-se em casa.</h1>
            <p>Encontra pessoas que combinam contigo, na zona onde queres viver.</p>
          </div>
        </section>
        <div className="auth-form-area">
          <div className="auth-card">
            <Card className={styles.card}>
              <Button appearance="subtle" onClick={onBack} className="auth-back">
                <span aria-hidden="true">←</span> Voltar ao início
              </Button>
              <Text weight="semibold">Ligue-se ao Supabase local</Text>
              <p className={styles.note}>
                Configure o URL e a chave pública em services/web/.env.local e reinicie o frontend.
              </p>
            </Card>
          </div>
        </div>
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
      if (mode === "forgot-password") {
        const { error: resetError } = await authClient.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (resetError) {
          setError(authErrorMessage(resetError.message));
        } else {
          const localInbucketHint = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? " Em desenvolvimento local, consulta também o Inbucket em http://localhost:54324."
            : "";
          setNotice(`Se existir uma conta associada a este email, receberás uma mensagem com instruções para redefinir a palavra-passe. Consulta a caixa de entrada e o spam.${localInbucketHint}`);
        }
        return;
      }

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
  const isForgotPassword = mode === "forgot-password";

  return (
    <div className={`${styles.page} auth-page`}>
      <section className="auth-story">
        <a className="landing-brand" href="#" onClick={(event) => { event.preventDefault(); onBack(); }}>
          <span className="landing-brand-mark"><Home24Regular /></span>
          <span>casa comigo<span className="landing-brand-period">.</span></span>
        </a>
        <div className="auth-story-copy">
          <span className="landing-eyebrow">Um bom lugar começa com as pessoas</span>
          <h1>Partilhar casa. Sentir-se em casa.</h1>
          <p>Encontra pessoas que combinam contigo, na zona onde queres viver.</p>
        </div>
        <span className="auth-story-footer">A tua próxima casa começa por uma boa conversa.</span>
      </section>
      <div className="auth-form-area">
        <div className="auth-card">
          <Card className={styles.card}>
            <Button appearance="subtle" onClick={onBack} className="auth-back">
              <span aria-hidden="true">←</span> Voltar ao início
            </Button>
            <Text size={200} weight="semibold" style={{ color: "#58745e" }}>
              {isSignUp ? "A tua próxima casa começa aqui" : isForgotPassword ? "Recupera o acesso à tua conta" : "Bem-vindo de volta"}
            </Text>
            <h1 className={styles.title}>{isSignUp ? "Cria a tua conta" : isForgotPassword ? "Palavra-passe esquecida?" : "Inicia sessão"}</h1>
            <p className={styles.description}>
              {isSignUp
                ? "Regista-te para começares a preparar o teu perfil de partilha."
                : isForgotPassword
                  ? "Indica o email da tua conta e enviaremos instruções para escolheres uma nova palavra-passe."
                  : "Entra para continuares a preparar a tua experiência Casa Comigo."}
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
              {!isForgotPassword && (
                <div className={styles.field}>
                  <Label htmlFor="auth-password" required>Palavra-passe</Label>
                  <Input
                    id="auth-password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    minLength={isSignUp ? 8 : undefined}
                    value={password}
                    onChange={(_, data) => setPassword(data.value)}
                    contentAfter={
                      <Button
                        type="button"
                        appearance="transparent"
                        size="small"
                        icon={passwordVisible ? <EyeOff24Regular /> : <Eye24Regular />}
                        aria-label={passwordVisible ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                        title={passwordVisible ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                        onClick={() => setPasswordVisible((visible) => !visible)}
                      />
                    }
                    required
                  />
                </div>
              )}
              <Button className="auth-primary" type="submit" appearance="primary" disabled={pending}>
                {pending ? "Aguarda…" : isSignUp ? "Criar conta" : isForgotPassword ? "Enviar instruções" : "Entrar"}
              </Button>
            </form>

            <div className={styles.switch}>
              <Button
                appearance="transparent"
                disabled={pending}
                onClick={() => {
                  setMode(isForgotPassword ? "sign-in" : isSignUp ? "sign-in" : "sign-up");
                  setError("");
                  setNotice("");
                }}
              >
                {isForgotPassword ? "Voltar a iniciar sessão" : isSignUp ? "Já tens conta? Iniciar sessão" : "Ainda não tens conta? Registar"}
              </Button>
              {mode === "sign-in" && (
                <Button
                  appearance="transparent"
                  disabled={pending}
                  onClick={() => {
                    setMode("forgot-password");
                    setError("");
                    setNotice("");
                  }}
                >
                  Esqueceste-te da palavra-passe?
                </Button>
              )}
            </div>
            <p className={styles.note}>
              A autenticação usa o Supabase. A tua palavra-passe não é enviada nem guardada pela API Casa Comigo.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
