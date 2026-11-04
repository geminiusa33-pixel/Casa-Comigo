# Divide Casa Comigo

Fundação para uma plataforma de partilha de casa. Em desenvolvimento, a aplicação usa uma instância Supabase local em Docker. Em produção, podes usar um projeto Supabase alojado, separado da instância local. Criar uma organização Supabase, por si só, não cria a base de dados da aplicação: cria também um **projeto** dentro dessa organização. Idealista e scraping não fazem parte deste MVP.

## Pré-requisitos

- Node.js 20.19+ ou 22.12+ e npm
- .NET 10 SDK
- Docker Desktop em execução
- Supabase CLI (`npx supabase --version` também pode ser usado se a CLI não estiver instalada globalmente)

## Desenvolvimento local com Docker

1. Inicia o Docker Desktop.
2. Na raiz do repositório, define primeiro as variáveis SendGrid descritas em **Recuperação de palavra-passe com SendGrid**, para que o Supabase possa enviar emails reais; depois inicia a instância local e aplica as migrations:

   ```powershell
   npx supabase start
   ```

   Isto inicia serviços **locais em Docker**; não usa nem altera o projeto cloud da tua organização.
3. Consulta os valores locais:

   ```powershell
   npx supabase status
   ```

   Usa a `API URL` e a chave pública `anon`/publishable local para a interface. Não uses a chave `service_role`/secret no browser. A password padrão da base local é `postgres`.

   Os emails de autenticação usam o SMTP do SendGrid configurado abaixo.
4. Aplica migrations que ainda não foram executadas, sem recriar a base nem eliminar contas:

   ```powershell
   npx supabase migration up --local
   ```

   Usa `npx supabase db reset` apenas se aceitares apagar e recriar a base de dados local.
5. Copia `.env.example` para `services/web/.env.local` e preenche `VITE_SUPABASE_ANON_KEY` com a chave pública da instância local. `services/web/.env.local` é lido pelo Vite; o ficheiro `.env.api.example` é apenas um exemplo para o processo .NET, não é carregado automaticamente.
6. Instala e executa a interface:

   ```powershell
   npm install
   npm run dev
   ```

   A interface fica em `http://localhost:5173`.
7. Noutro terminal, configura e executa o backend:

   ```powershell
   $env:ASPNETCORE_URLS = "http://localhost:5080"
   $env:ConnectionStrings__Supabase = "Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres"
   $env:SUPABASE_URL = "http://127.0.0.1:54321"
   dotnet run --project services/api/src/CasaComigo.Api
   ```

   Em `Development`, a API usa por omissão a base Supabase local em `127.0.0.1:54322` com a password local padrão `postgres`; uma `ConnectionStrings__Supabase` definida no ambiente substitui esse valor. Para outros ambientes, a connection string é obrigatória. A API valida as assinaturas com as chaves públicas JWKS publicadas pela instância Supabase local; não precisas de copiar segredos JWT ou chaves `service_role`. Verifica `http://localhost:5080/health`.

Se preferires, basta executar `dotnet run --project services/api/src/CasaComigo.Api`: o perfil de arranque local configura `Development`, a API em `http://localhost:5080` e o Supabase local. Em `Development`, a base local usa a password padrão `postgres`; se a alteraste, define `ConnectionStrings__Supabase` no terminal antes de arrancar. Fora de `Development`, a connection string é obrigatória.

### Notificações

A aplicação guarda notificações de novas mensagens individuais e de grupo, novos matches, pedidos de entrada em grupos e respetivas decisões. O ícone no topo mostra as não lidas, permite marcá-las como lidas e abre a conversa ou grupo relacionado. A lista atualiza automaticamente.

Para permitir notificações push do browser, gera uma chave VAPID uma única vez:

```powershell
dotnet run --project services/api/src/CasaComigo.Api -- --generate-vapid-keys
```

Configura no mesmo terminal da API as duas chaves impressas e o assunto VAPID (um endereço de email ou URL de contacto), antes de iniciar `dotnet run`:

```powershell
$env:WebPush__VapidPublicKey = "<chave pública gerada>"
$env:WebPush__VapidPrivateKey = "<chave privada gerada>"
$env:WebPush__VapidSubject = "mailto:contacto@exemplo.pt"
```

Não partilhes nem adiciones a chave privada ao Git. Depois de iniciares a aplicação, abre o sino de notificações e escolhe **Ativar notificações do browser**; o browser pede autorização. Push requer `localhost` ou HTTPS e só é enviado aos browsers a que deste autorização. A aplicação também continua a mostrar as notificações dentro da própria interface.

### Recuperação de palavra-passe com SendGrid

O formulário **Esqueceste-te da palavra-passe?** envia o pedido através do Supabase Auth. O Supabase gera o link e tu escolhes e confirmas a nova palavra-passe na aplicação. A API .NET do Divide Casa Comigo não recebe nem guarda palavras-passe; o Supabase usa o SendGrid apenas como serviço de envio.

**Teste local com envio para um email real:** o Supabase local está configurado para enviar os emails de autenticação pelo SMTP do SendGrid. Antes de iniciar ou reiniciar o Supabase, define no mesmo terminal PowerShell a chave SendGrid com permissão **Mail Send** e o remetente verificado:

```powershell
$env:SENDGRID_API_KEY = "<chave SendGrid>"
$env:SENDGRID_FROM_EMAIL = "<email verificado no SendGrid>"
npx supabase stop
npx supabase start
```

O nome de utilizador SMTP (`apikey`), o host e a porta estão configurados em `supabase/config.toml`. A chave não deve ser colocada nesse ficheiro, no frontend ou no Git. As variáveis de ambiente deixam de existir quando fechas o terminal; define-as novamente no terminal que inicia o Supabase. O pedido pode responder com `{}`: é normal e, por segurança, não confirma se o endereço corresponde a uma conta. O email de recuperação deverá chegar à caixa real do endereço registado. O Mailpit em `http://localhost:54324` deixa de receber os emails de autenticação enquanto o SMTP do SendGrid estiver configurado.

O URL de retorno local `http://localhost:5173` já está permitido em `supabase/config.toml`. Abre o link do email no mesmo browser em que a aplicação está a correr, escolhe uma nova palavra-passe e confirma.

**Produção:** configura o envio no projeto Supabase alojado:

1. No SendGrid, autentica um domínio ou verifica um endereço de remetente e cria uma API key com permissão de envio de email. Guarda a chave como segredo.
2. No painel do Supabase, abre as definições de **Authentication / SMTP** e ativa o SMTP personalizado. Usa:
   - Host: `smtp.sendgrid.net`
   - Porta: `587` (STARTTLS)
   - Utilizador: `apikey`
   - Palavra-passe: a API key do SendGrid
   - Remetente: o endereço verificado no SendGrid
3. Em **Authentication / URL Configuration**, define o URL do site publicado e acrescenta os URLs da aplicação às listas de redirecionamento permitidas. Para desenvolvimento local, permite `http://localhost:5173`; em produção, permite também o domínio HTTPS da aplicação.
4. Personaliza o template de recuperação de palavra-passe em **Authentication / Email Templates**, mantendo o link de ação de recuperação fornecido pelo Supabase (`{{ .ConfirmationURL }}`).

Usa uma API key SendGrid com permissão **Mail Send**; a mesma conta/chave pode servir para Auth e para o formulário de contacto, mas são configurações separadas. A configuração SMTP local lê `SENDGRID_API_KEY` e `SENDGRID_FROM_EMAIL` ao iniciar o Supabase. A API de contacto usa `SendGrid__ApiKey`, `SendGrid__FromEmail`, `SendGrid__FromName` e `Contact__ToEmail` no processo .NET. Define cada variável no processo correspondente. Não coloques chaves em `services/web/.env.local`, variáveis `VITE_*`, código da aplicação ou no Git. Em produção, guarda as credenciais SMTP nas definições seguras do projeto Supabase.

### Formulário de contacto com SendGrid

O formulário público de contacto envia mensagens pela API .NET, usando a API v3 do SendGrid. O destinatário é configurado no servidor e o endereço de resposta é o email que a pessoa indicar.

1. No SendGrid, autentica o domínio/remetente e cria uma API key com permissão **Mail Send**.
2. No serviço que aloja a API, configura `SendGrid__ApiKey`, `SendGrid__FromEmail`, `SendGrid__FromName=Divide Casa Comigo` e `Contact__ToEmail=tiagopereiracode@gmail.com`. Usa os campos correspondentes em `.env.api.production.example` como referência, mas não publiques valores reais nesse ficheiro.
3. Configura `Cors__AllowedOrigins__0` com o URL HTTPS exato do frontend; se tiveres mais origens, usa índices `__1`, `__2`, etc. Reinicia a API depois de guardares a configuração.
4. Em desenvolvimento local, coloca as variáveis no terminal que executa a API (não no terminal Vite), substituindo os marcadores pelos teus valores, e reinicia a API:

   ```powershell
   $env:SendGrid__ApiKey = "<a tua API key do SendGrid>"
   $env:SendGrid__FromEmail = "<remetente verificado no SendGrid>"
   $env:SendGrid__FromName = "Divide Casa Comigo"
   $env:Contact__ToEmail = "tiagopereiracode@gmail.com"
   dotnet run --project services\api\src\CasaComigo.Api
   ```

   Não envies a chave por chat nem a guardes em ficheiros versionados. Sem configuração, o endpoint responde explicitamente com `503`; por IP, o formulário permite no máximo três envios por cada 15 minutos. Testa o envio real a partir do formulário de contacto ou com `services/api/src/CasaComigo.Api/Contact.http`. Se falhar, consulta o terminal da API: a resposta não expõe segredos, mas regista o estado de erro devolvido pelo SendGrid.

Nunca coloques a API key em `services/web/.env.local`, em `VITE_*`, no Git ou no browser. A chave não é necessária para recuperar palavras-passe: esse fluxo usa o SMTP personalizado nas definições do Supabase, conforme a secção anterior.

### Donativos opcionais com Stripe Payment Links

Para este MVP foi escolhida a opção sem código de pagamento no backend:

1. Cria/ativa a conta Stripe e completa os dados de negócio solicitados no Dashboard.
2. Em **Payment Links**, cria três links de donativo pontual em EUR: 3 €, 5 € e 10 €. Ativa MB WAY e Multibanco nas definições de métodos de pagamento e confirma que o Dashboard permite esses métodos para cada link/conta.
3. Copia os URLs públicos para `VITE_STRIPE_COFFEE_3_URL`, `VITE_STRIPE_COFFEE_5_URL` e `VITE_STRIPE_COFFEE_10_URL` nas variáveis do frontend local ou do projeto Vercel e volta a publicar o frontend. Estes URLs são concebidos para partilha; não são chaves secretas. A aplicação não necessita de `STRIPE_SECRET_KEY`.
4. Testa primeiro com os métodos de teste oferecidos pela Stripe. Só ativa pagamentos reais quando a conta estiver verificada e os termos, contacto, privacidade e informação fiscal do projeto estiverem revistos.

MB WAY normalmente confirma o pagamento de forma imediata; Multibanco é um método com confirmação atrasada — podes pagar o talão mais tarde. Não interpretes a página de retorno do Stripe como prova de que um pagamento Multibanco foi liquidado. A elegibilidade e disponibilidade dos métodos dependem da conta e das definições Stripe. Consulta a [documentação de Payment Links](https://docs.stripe.com/payment-links), [MB WAY](https://docs.stripe.com/payments/mb-way) e [Multibanco](https://docs.stripe.com/payments/multibanco).

### Porta 65-Jovem e informação de arrendamento

No perfil podes indicar o teu interesse/situação relativamente ao Porta 65-Jovem. Esta autoavaliação é apresentada a matches e membros do grupo — não aparece na descoberta — e nunca certifica a elegibilidade. O programa destina-se a jovens dos 18 aos 35 anos, mas a candidatura depende dos restantes requisitos em vigor; confirma-os no [Portal da Habitação](https://www.portaldahabitacao.pt/porta-65-jovem). A página inicial também inclui informação geral sobre contrato, recibos e arrendamento; não substitui aconselhamento jurídico/fiscal nem constitui uma interpretação vinculativa das regras.

### Preparação para publicar

- Aloja a API .NET e configura as variáveis server-side de `.env.api.production.example` no gestor de segredos do host. Não carregues esse ficheiro para o host como se fosse uma fonte de segredos.
- No Vercel, configura `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e, quando existirem, os três URLs de Stripe Payment Links. Variáveis `VITE_*` são públicas e ficam incluídas no bundle do browser.
- Configura o domínio HTTPS no SMTP e nos URLs de redirecionamento do Supabase Auth; a API deve aceitar apenas a origem real do frontend em `Cors__AllowedOrigins__0`.
- Aplica a migration Porta 65 apenas ao projeto Supabase correto, depois de confirmares o destino e a cópia de segurança. Não uses `db reset` em produção.
- Antes do lançamento público, finaliza e revê os termos e a política de privacidade, incluindo identidade do responsável pelo serviço, retenção de dados, exercício de direitos, moderação, segurança, reclamações e obrigações fiscais dos donativos. Faz também testes com contas distintas e revê RLS, autenticação, backups e logs.

### Cookies e privacidade

A aplicação não inclui scripts conhecidos de publicidade, analytics ou rastreamento e não usa cookies de terceiros para esses fins. O cliente Supabase mantém a sessão de autenticação no armazenamento local do browser. O mapa carrega mosaicos do OpenStreetMap; como em qualquer pedido web, o serviço de mapas recebe dados técnicos como o endereço IP e os mosaicos consultados. O formulário de contacto encaminha os dados submetidos através do SendGrid. A localização precisa não aparece nos cartões públicos, mas é usada pelo backend para calcular compatibilidade. Existem medidas de controlo de acesso e minimização, mas não prometemos segurança ou privacidade absolutas; não incluas dados sensíveis em perfis, mensagens ou formulários. Antes do lançamento público, transforma este resumo numa política de privacidade completa e revista para o serviço real.

### Testa o registo, login, perfil e matching

Abre `http://localhost:5173`, escolhe **Registar** e cria uma conta com nome, email e palavra-passe de pelo menos 8 caracteres. Se te pedirem para confirmar o email, verifica a tua caixa de entrada e o spam; depois volta à aplicação e inicia sessão. Após entrares, a interface envia o token de acesso para `GET /api/auth/session`. Uma confirmação na página indica que a API local validou esse token. O trigger da migration cria automaticamente o perfil inicial com o nome que indicaste no registo. O Supabase Auth trata da palavra-passe; a API do Divide Casa Comigo não a recebe.

Em **Descobrir**, usa **Ver até 5 perfis anteriores** para consultar perfis rejeitados há mais de três dias ou pessoas de grupos concluídos. A opção respeita os mesmos critérios de visibilidade, zona e escalão de renda, e não inclui pessoas com quem já tens um match nem membros de grupos ativos. No separador **Conversas**, aparecem apenas matches e grupos ativos; o contador de notificações fica no sino.

Abre **Perfil** para adicionares uma foto JPEG, PNG ou WebP (até 10 MB), que aparece no ícone da tua conta, na descoberta e nos teus matches. As fotos ficam num bucket privado e só são servidas a ti, a perfis geograficamente elegíveis ou a membros/candidatos compatíveis de um grupo. No mesmo ecrã podes editar a apresentação e as preferências de habitação: número total de pessoas na casa (incluindo-te), escalão obrigatório de contribuição mensal para renda (200–300 €, 301–400 €, 401–500 € ou 501–600 €), titular do contrato, divisão de despesas/recibos, mobília, quartos, casas de banho, tipo de casa, prazo de mudança e duração mínima do contrato. Os perfis individuais e grupos só são sugeridos quando o escalão de renda coincide exatamente; os totais mostram a soma dos limites inferiores e superiores dos escalões que escolheste. Perfis antigos ficam sem escalão até a pessoa escolher um, e não aparecem na descoberta nesse intervalo. Escolhe o raio de procura em passos de 5 km, entre 5 e 50 km. A lotação comum cria um grupo quando ocorre o primeiro match; as restantes preferências são informativas e não impedem matches. A zona tem de ser compatível nos dois sentidos com cada pessoa do grupo. Podes obter a localização pelo browser depois de carregares no botão GPS e aceitares a permissão, escolher a zona no mapa e arrastar o marcador, ou inserir os dados manualmente. O mapa usa mosaicos OpenStreetMap servidos por openstreetmap.fr e precisa de ligação à internet. O serviço de mapas recebe pedidos relativos à área visível, mas os dados do teu perfil não são enviados para esse serviço. Guarda um nome de área aproximada, coordenadas e raio; só tu recebes as coordenadas do teu perfil. Ativa a opção de descoberta para apareceres a outras pessoas. Para testar matching e chat, cria duas contas locais e completa e ativa ambos os perfis com escalões de renda iguais e áreas/raios mutuamente compatíveis; depois envia gostos pelos cartões em **Descobrir**. O match só aparece se ambos gostarem. Se escolherem a mesma lotação, é criado um grupo com o nome inicial da área (por exemplo, 2/4); qualquer membro pode personalizar o nome e abrir o perfil completo dos membros e de quem pede entrada. Quando o grupo começa, a conversa individual deixa de aparecer e passa a ser usada a conversa do grupo; o histórico anterior é copiado e fica disponível também para quem entrar mais tarde. O total do intervalo de renda dos membros aparece na descoberta de grupos e no painel do grupo; nos perfis individuais e nos matches, aparece o intervalo total do par. Enquanto partilham um grupo, as pessoas deixam de aparecer umas às outras na descoberta individual. Qualquer membro pode escolher **Sair do grupo**; depois de sair, volta a poder descobrir os restantes membros e deixa de ter acesso à conversa. Se todos saírem, o grupo é encerrado automaticamente. Outros perfis podem pedir entrada se tiverem o mesmo escalão de renda; todos os membros atuais têm de aprovar. O grupo permanece visível enquanto houver lugares, até todos confirmarem **Concluído**; podes participar em vários grupos. Se cancelares o match que originou o grupo, o grupo e o histórico permanecem, mas as mensagens da conversa individual deixam de estar acessíveis. Os gostos recíprocos são removidos e o par pode voltar a aparecer na descoberta se continuar elegível. Podes bloquear ou denunciar um perfil diretamente na descoberta ou numa conversa; podes rever e remover bloqueios em **Perfil**. Os pedidos de API estão documentados em `services/api/src/CasaComigo.Api/Auth.http`.

Ao escolheres o GPS ou um ponto no mapa, **Área aproximada** é preenchida localmente com o distrito ou a ilha correspondente, a partir dos limites da [CAOP2025 da Direção-Geral do Território](https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-tematica/caop). Podes corrigir o texto manualmente. As coordenadas não são enviadas a um serviço de geocodificação; se a localização ficar fora das áreas administrativas de Portugal ou os dados locais não estiverem disponíveis, a app pede que indiques a área manualmente.

Na descoberta, interesses e preferências iguais são agrupados em **Em comum**; diferenças ficam em **A conversar / reconsiderar**. **Não tenho interesse** oculta o perfil durante três dias e, depois, ele pode voltar a aparecer se a área continuar compatível.

## Preparar um projeto Supabase para produção

1. No dashboard Supabase, cria um **projeto** dentro da organização. A organização, por si só, não tem URL, API keys nem uma base de dados de projeto.
2. Para a interface publicada, configura `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave **publishable/anon** desse projeto. O ficheiro `.env.production.example` mostra os nomes; configura os valores no serviço de hosting (por exemplo, Vercel), sem os adicionares ao Git.
3. Para uma API ASP.NET publicada, configura `SUPABASE_URL` e a connection string PostgreSQL do projeto apenas no ambiente **server-side** da API. O exemplo está em `.env.api.production.example`. A connection string inclui uma password privada. A API precisa de um host próprio compatível com ASP.NET Core; a chave de frontend não substitui esse host.
4. A chave Supabase `secret`/`service_role` não é uma “private key” para colocar no frontend e não é necessária para validar tokens. Nunca a uses como segredo de assinatura JWT. A API consulta as chaves públicas JWKS do projeto; revê a autorização e RLS para operações de dados antes de expor endpoints em produção.
5. Publica migrations apenas depois de reveres o destino e os efeitos. `npx supabase db reset` é para desenvolvimento local; não o executes numa base com dados que pretendes preservar. Não executes `db push` até confirmares que o projeto remoto está selecionado e que as migrations estão prontas.

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

O health check, autenticação, leitura/edição do perfil, atualização da zona privada, descoberta por compatibilidade geográfica mútua, gosto, listagem de matches, grupos de coabitação com nome editável, saída voluntária, soma de contribuições máximas, pedidos de entrada por unanimidade, conclusão consensual, perfis completos para membros/candidatos, histórico e mensagens de grupo, bloqueio e denúncia estão ligados ao frontend. O match é criado numa função SQL transacional só quando o gosto é recíproco; conversas exigem um match existente e não bloqueado. Os grupos são abertos por matches com lotação igual, não restringem a quantidade de grupos de cada utilizador e ficam descobríveis apenas quando têm lugares e compatibilidade geográfica mútua com todos os membros. Pessoas que partilham um grupo não se veem na descoberta individual enquanto continuarem membros; a verificação é aplicada também no registo do gosto. Quando existe grupo, a conversa individual associada é ocultada e só a conversa do grupo é usada; o histórico anterior é preservado para os membros atuais e futuros. A saída remove apenas o membro atual, preserva o grupo e as mensagens para os restantes e encerra o grupo se ficar vazio. Os bloqueios removem a descoberta e o acesso a conversas, e podem ser desfeitos no perfil. Denúncias têm cooldown de dez minutos por par de contas; são armazenadas de forma privada, mas ainda não existe painel nem fluxo de moderação. A política RLS restringe a leitura de grupos e membros a participantes ou a candidatos compatíveis. A interface atualiza as conversas abertas a cada cinco segundos e apresenta até às 100 mensagens mais recentes. Visitas, anúncios e favoritos ainda não estão ligados; as respetivas rotas por implementar respondem `501 Not Implemented`. A aplicação ainda precisa de testes de segurança com utilizadores distintos antes de ser usada com dados reais.

O campo `search_areas` guarda coordenadas precisas; a API de descoberta não as devolve. A distância usa haversine em SQL, sem dependência de PostGIS. Não há seed data, conta demo, Idealista, provisioning cloud ou deploy.
