export function authErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Já existe uma conta com este email. Experimente iniciar sessão.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Email ou palavra-passe incorretos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme o email antes de iniciar sessão. Em local, consulte o Inbucket.";
  }

  if (normalized.includes("password")) {
    return "A palavra-passe não cumpre os requisitos. Use pelo menos 8 caracteres.";
  }

  return `Não foi possível concluir a operação de autenticação: ${message}`;
}
