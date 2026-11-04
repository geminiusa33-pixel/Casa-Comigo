import { useState, type FormEvent } from "react";
import { Button, Card, Input, Label, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { Eye24Regular, EyeOff24Regular } from "@fluentui/react-icons";
import { supabase } from "../api/supabase";
import { authErrorMessage } from "../auth/authErrorMessage";

type Props = { onCompleted: () => void };

export function PasswordRecoveryPanel({ onCompleted }: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);
  const [pending, setPending] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    if (!supabase) {
      setError("A configuração do Supabase não está disponível.");
      return;
    }

    setPending(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(authErrorMessage(updateError.message));
      } else {
        setUpdated(true);
      }
    } catch (caught) {
      setError(authErrorMessage(caught instanceof Error ? caught.message : "Erro inesperado."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="password-recovery-page">
      <Card className="password-recovery-card">
        <span className="landing-eyebrow">Divide Casa Comigo</span>
        <h1>{updated ? "Palavra-passe atualizada" : "Escolhe uma nova palavra-passe"}</h1>
        <p>
          {updated
            ? "Já podes continuar e entrar na tua conta com a nova palavra-passe."
            : "Cria uma palavra-passe com pelo menos 8 caracteres para proteger a tua conta."}
        </p>
        {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
        {updated ? (
          <Button className="auth-primary" appearance="primary" onClick={onCompleted}>
            Continuar para a aplicação
          </Button>
        ) : (
          <form onSubmit={(event) => void updatePassword(event)}>
            <div>
              <Label htmlFor="recovery-password" required>Nova palavra-passe</Label>
              <Input
                id="recovery-password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
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
            <div>
              <Label htmlFor="recovery-confirmation" required>Confirmar palavra-passe</Label>
              <Input
                id="recovery-confirmation"
                type={confirmationVisible ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={confirmation}
                onChange={(_, data) => setConfirmation(data.value)}
                contentAfter={
                  <Button
                    type="button"
                    appearance="transparent"
                    size="small"
                    icon={confirmationVisible ? <EyeOff24Regular /> : <Eye24Regular />}
                    aria-label={confirmationVisible ? "Ocultar confirmação da palavra-passe" : "Mostrar confirmação da palavra-passe"}
                    title={confirmationVisible ? "Ocultar confirmação da palavra-passe" : "Mostrar confirmação da palavra-passe"}
                    onClick={() => setConfirmationVisible((visible) => !visible)}
                  />
                }
                required
              />
            </div>
            <Button className="auth-primary" type="submit" appearance="primary" disabled={pending}>
              {pending ? "A atualizar…" : "Guardar nova palavra-passe"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
