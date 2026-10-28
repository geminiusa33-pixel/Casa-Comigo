# Casa Comigo

Fundação para uma plataforma de partilha de casa. Em desenvolvimento, a aplicação usa uma instância Supabase local em Docker. Em produção, pode usar um projeto Supabase alojado, separado da instância local. Criar uma organização Supabase, por si só, não cria a base de dados da aplicação: crie também um **projeto** dentro dessa organização. Idealista e scraping não fazem parte deste MVP.

## Pré-requisitos

- Node.js 20.19+ ou 22.12+ e npm
- .NET 10 SDK
- Docker Desktop em execução
- Supabase CLI (`npx supabase --version` também pode ser usado se a CLI não estiver instalada globalmente)

## Desenvolvimento local com Docker

1. Inicie Docker Desktop.
2. Na raiz do repositório, inicie a instância Supabase local e aplique as migrations:

   ```powershell
   npx supabase start
   npx supabase db reset
   ```

   Isto cria serviços **locais em Docker**; não usa nem altera o projeto cloud da sua organização. `db reset` recria a base local e apaga os dados que nela existirem. A migration cria schema e políticas, sem dados de demonstração.
3. Consulte os valores locais:

   ```powershell
   npx supabase status
   ```

   Use a `API URL` e a chave pública `anon`/publishable local para a interface, e o `JWT secret` local para a API. Não use a chave `service_role`/secret no browser. A password padrão da base local é `postgres`.

   Para emails de confirmação locais, abra o Inbucket em `http://localhost:54324`.
4. Aplique migrations que ainda não foram executadas, sem recriar a base nem eliminar contas:

   ```powershell
   npx supabase migration up --local
   ```

   Use `npx supabase db reset` apenas se aceitar apagar e recriar a base de dados local.
5. Copie `.env.example` para `services/web/.env.local` e preencha `VITE_SUPABASE_ANON_KEY` com a chave pública da instância local. `services/web/.env.local` é lido pelo Vite; o ficheiro `.env.api.example` é apenas um exemplo para o processo .NET, não é carregado automaticamente.
6. Instale e execute a interface:

   ```powershell
   npm install
   npm run dev
   ```

   A interface fica em `http://localhost:5173`.
7. Noutro terminal, configure e execute o backend:

   ```powershell
   $env:ASPNETCORE_URLS = "http://localhost:5080"
   $env:ConnectionStrings__Supabase = "Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres"
   $env:SUPABASE_URL = "http://127.0.0.1:54321"
   $env:SUPABASE_JWT_ISSUER = "supabase"
   $env:SUPABASE_JWT_SECRET = "<JWT secret local mostrado por supabase status>"
   dotnet run --project services/api/src/CasaComigo.Api
   ```

   `SUPABASE_JWT_SECRET` é o segredo de assinatura JWT da instância local — não é a chave API `service_role`/secret. Substitua o placeholder pelo valor local, sem o guardar no Git. Verifique `http://localhost:5080/health`.

### Testar registo e login

Abra `http://localhost:5173`, escolha **Registar**, e crie uma conta com nome, email e palavra-passe de pelo menos 8 caracteres. Se for pedido para confirmar o email, consulte `http://localhost:54324`; depois volte à aplicação e inicie sessão. Após entrar, a interface envia o token de acesso para `GET /api/auth/session`. Uma confirmação na página indica que a API local validou esse token. O trigger da migration cria automaticamente o perfil inicial com o nome indicado no registo. A palavra-passe é tratada pelo Supabase Auth; a API Casa Comigo não a recebe.

## Preparar um projeto Supabase para produção

1. No dashboard Supabase, crie um **projeto** dentro da organização. A organização sozinha não tem URL, API keys nem uma base de dados de projeto.
2. Para a interface publicada, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave **publishable/anon** desse projeto. O ficheiro `.env.production.example` mostra os nomes; configure os valores no serviço de hosting (por exemplo, Vercel), não os adicione ao Git.
3. Para uma API ASP.NET publicada, configure `SUPABASE_URL` e a connection string PostgreSQL do projeto apenas no ambiente **server-side** da API. O exemplo está em `.env.api.production.example`. A connection string inclui uma password privada. A API precisa de um host próprio compatível com ASP.NET Core; a chave de frontend não substitui esse host.
4. A chave Supabase `secret`/`service_role` não é uma “private key” para colocar no frontend. Nunca use essa chave como `SUPABASE_JWT_SECRET`: são credenciais diferentes. A API ainda requer uma revisão da validação de JWT/RLS para o projeto cloud antes de expor endpoints de dados.
5. Publique migrations apenas depois de rever o destino e os efeitos. `npx supabase db reset` é para desenvolvimento local; não o execute contra uma base com dados que pretende preservar. Não execute `db push` até confirmar que o projeto remoto está selecionado e que as migrations estão prontas.

Não é necessário criar ou ligar o projeto cloud para testar localmente. A instância Docker tem base de dados, URL e credenciais próprias, independentes do projeto alojado.

## Comandos úteis

```powershell
npm run build
npm test
npm run typecheck
dotnet test services/api/CasaComigo.sln
npx supabase status
npx supabase db reset
```

Para parar a stack local: `npx supabase stop`.

## Estrutura

- `services/web` — React, TypeScript, Vite, Fluent UI v9 e cliente Supabase Auth.
- `services/api` — ASP.NET Core Web API .NET 10, validação JWT Supabase, EF Core/Npgsql e SignalR configurado.
- `services/api/src/CasaComigo.Api/Auth.http` — pedido para confirmar a sessão da API com token local.
- `supabase/migrations` — schema inicial seed-free, constraints, índices e RLS.
- `.env.example` / `.env.api.example` — configuração de desenvolvimento local.
- `.env.production.example` / `.env.api.production.example` — nomes de variáveis para configurar nos serviços de hosting; sem credenciais reais.

## Estado real deste scaffold

O health check e `GET /api/auth/session` estão funcionais. Registo e login usam Supabase Auth, e a API confirma o token de acesso antes de a interface mostrar a sessão como validada. A migration cria automaticamente o perfil e o nome inicial durante o registo. As restantes rotas REST estão declaradas e protegidas por autenticação, mas respondem `501 Not Implemented` até os casos de uso/repositórios serem implementados. A migration inclui o schema, RLS, buckets privados e funções SQL para compatibilidade mútua por distância e criação transacional/idempotente de match após likes recíprocos; essas funções ainda não estão ligadas à API nem foram exercitadas contra uma instância PostgreSQL neste ambiente. As políticas precisam de testes de isolamento com utilizadores distintos e revisão de segurança antes de uso real.

O campo `search_areas` guarda coordenadas precisas numa tabela privada por RLS; não há ainda endpoint de descoberta nem integração da API com o contexto RLS. A distância usa haversine em SQL, sem dependência de PostGIS. Não há seed data, conta demo, Idealista, provisioning cloud ou deploy.
