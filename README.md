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
   ```

   Isto inicia serviços **locais em Docker**; não usa nem altera o projeto cloud da sua organização.
3. Consulte os valores locais:

   ```powershell
   npx supabase status
   ```

   Use a `API URL` e a chave pública `anon`/publishable local para a interface. Não use a chave `service_role`/secret no browser. A password padrão da base local é `postgres`.

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
   dotnet run --project services/api/src/CasaComigo.Api
   ```

   A API valida as assinaturas com as chaves públicas JWKS publicadas pela instância Supabase local; não precisa de copiar segredos JWT ou chaves `service_role`. Verifique `http://localhost:5080/health`.

### Testar registo, login, perfil e matching

Abra `http://localhost:5173`, escolha **Registar**, e crie uma conta com nome, email e palavra-passe de pelo menos 8 caracteres. Se for pedido para confirmar o email, consulte `http://localhost:54324`; depois volte à aplicação e inicie sessão. Após entrar, a interface envia o token de acesso para `GET /api/auth/session`. Uma confirmação na página indica que a API local validou esse token. O trigger da migration cria automaticamente o perfil inicial com o nome indicado no registo. A palavra-passe é tratada pelo Supabase Auth; a API Casa Comigo não a recebe.

Abra **Perfil** para adicionar uma foto JPEG, PNG ou WebP (até 10 MB), que aparece no ícone da conta, na descoberta e nos matches. As fotos ficam num bucket privado e só são servidas ao próprio utilizador, a perfis geograficamente elegíveis ou ao seu match atual. No mesmo ecrã pode editar a apresentação, os dados de convivência e as preferências de habitação: orçamento mensal por pessoa, titular do contrato, divisão de despesas/recibos, mobília, quartos, casas de banho, tipo de casa, prazo de mudança e duração mínima do contrato. Estas preferências são sugestões para conversar e nunca filtram a descoberta nem impedem um match. O único critério obrigatório é geográfico: o centro de cada área de procura tem de caber dentro do raio definido pela outra pessoa, nos dois sentidos. A localização pode ser obtida pelo browser apenas depois de carregar no botão GPS e aceitar a permissão, ou escolhida clicando no mapa e arrastando o marcador; também pode ser inserida manualmente. O mapa usa mosaicos OpenStreetMap servidos por openstreetmap.fr e precisa de ligação à internet. O serviço de mapas recebe pedidos relativos à área visível, mas os dados do perfil não são enviados para esse serviço. Guarde um nome de área aproximada, coordenadas e raio; as coordenadas são devolvidas apenas ao dono do perfil. Ative a opção de descoberta para aparecer a outros utilizadores. Para testar matching e chat, crie duas contas locais, complete e ative ambos os perfis com áreas/raios mutuamente compatíveis, depois envie gostos pelos cartões em **Descobrir**. O match só aparece se os dois gostarem; a conversa fica disponível em **Conversas**, com atualização automática a cada cinco segundos. Um participante pode cancelar um match; a conversa e mensagens são eliminadas, os gostos recíprocos são removidos e o par pode voltar a aparecer na descoberta se continuar geograficamente elegível. Pode bloquear ou denunciar um perfil diretamente na descoberta ou numa conversa; os bloqueios podem ser revistos e removidos em **Perfil**. Os pedidos de API estão documentados em `services/api/src/CasaComigo.Api/Auth.http`.

Ao escolher o GPS ou um ponto no mapa, **Área aproximada** é preenchida localmente com o distrito ou a ilha correspondente, a partir dos limites da [CAOP2025 da Direção-Geral do Território](https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-tematica/caop). Pode corrigir o texto manualmente. As coordenadas não são enviadas a um serviço de geocodificação; se a localização ficar fora das áreas administrativas de Portugal ou os dados locais não estiverem disponíveis, a app pede que indique a área manualmente.

Na descoberta, interesses e preferências iguais são agrupados em **Em comum**; diferenças ficam em **A conversar / reconsiderar**. **Não tenho interesse** oculta o perfil durante três dias e, depois, ele pode voltar a aparecer se a área continuar compatível.

## Preparar um projeto Supabase para produção

1. No dashboard Supabase, crie um **projeto** dentro da organização. A organização sozinha não tem URL, API keys nem uma base de dados de projeto.
2. Para a interface publicada, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave **publishable/anon** desse projeto. O ficheiro `.env.production.example` mostra os nomes; configure os valores no serviço de hosting (por exemplo, Vercel), não os adicione ao Git.
3. Para uma API ASP.NET publicada, configure `SUPABASE_URL` e a connection string PostgreSQL do projeto apenas no ambiente **server-side** da API. O exemplo está em `.env.api.production.example`. A connection string inclui uma password privada. A API precisa de um host próprio compatível com ASP.NET Core; a chave de frontend não substitui esse host.
4. A chave Supabase `secret`/`service_role` não é uma “private key” para colocar no frontend e não é necessária para validar tokens. Nunca a use como segredo de assinatura JWT. A API consulta as chaves públicas JWKS do projeto; a autorização e RLS para operações de dados ainda devem ser revistas antes de expor endpoints em produção.
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
- `services/api` — ASP.NET Core Web API .NET 10, validação JWT Supabase e acesso PostgreSQL com Npgsql.
- `services/api/src/CasaComigo.Api/Auth.http` — pedido para confirmar a sessão da API com token local.
- `supabase/migrations` — schema inicial seed-free, constraints, índices e RLS.
- `.env.example` / `.env.api.example` — configuração de desenvolvimento local.
- `.env.production.example` / `.env.api.production.example` — nomes de variáveis para configurar nos serviços de hosting; sem credenciais reais.

## Estado real deste scaffold

O health check, autenticação, leitura/edição do perfil, atualização da zona privada, descoberta por compatibilidade geográfica mútua, gosto, listagem de matches, mensagens entre participantes, bloqueio e denúncia estão ligados ao frontend. O match é criado numa função SQL transacional só quando o gosto é recíproco; conversas exigem um match existente e não bloqueado. Os bloqueios removem a descoberta e o acesso a conversas, e podem ser desfeitos no perfil. Denúncias têm cooldown de dez minutos por par de contas; são armazenadas de forma privada, mas ainda não existe painel nem fluxo de moderação. A política RLS também restringe a leitura direta de outros perfis às áreas mutuamente compatíveis. A interface atualiza a conversa aberta a cada cinco segundos e apresenta até às 100 mensagens mais recentes. Visitas, fotos, anúncios e favoritos ainda não estão ligados; as respetivas rotas por implementar respondem `501 Not Implemented`. A aplicação ainda precisa de testes de segurança com utilizadores distintos antes de ser usada com dados reais.

O campo `search_areas` guarda coordenadas precisas; a API de descoberta não as devolve. A distância usa haversine em SQL, sem dependência de PostGIS. Não há seed data, conta demo, Idealista, provisioning cloud ou deploy.
