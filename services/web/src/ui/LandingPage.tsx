import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Input, Textarea, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { createPortal } from "react-dom";
import {
  ArrowRight24Regular,
  Chat24Regular,
  Dismiss24Regular,
  Heart24Regular,
  Home24Regular,
  Location24Regular,
  PeopleCommunity24Regular,
  ShieldCheckmark24Regular,
} from "@fluentui/react-icons";
import { apiRequest } from "../api/http";

type Props = {
  onSignIn: () => void;
  onSignUp: () => void;
  authenticated?: boolean;
  onDiscover?: () => void;
  onProfile?: () => void;
  onSignOut?: () => void;
  showStoryBanner?: boolean;
  onDismissStoryBanner?: () => void;
  showSupportBanner?: boolean;
  onDismissSupportBanner?: () => void;
};

const steps = [
  {
    number: "01",
    title: "Mostra quem és",
    text: "Cria um perfil com as tuas rotinas, preferências e o tipo de casa que procuras.",
  },
  {
    number: "02",
    title: "Encontra o teu match",
    text: "Descobre pessoas com uma área de procura compatível e gostos de convivência próximos.",
  },
  {
    number: "03",
    title: "Comecem a conversa",
    text: "Quando o interesse é recíproco, podem conversar e combinar os próximos passos.",
  },
];

export function LandingPage({
  onSignIn,
  onSignUp,
  authenticated = false,
  onDiscover,
  onProfile,
  onSignOut,
  showStoryBanner,
  onDismissStoryBanner,
  showSupportBanner,
  onDismissSupportBanner,
}: Props) {
  const [localStoryOpen, setLocalStoryOpen] = useState(true);
  const [localSupportOpen, setLocalSupportOpen] = useState(true);
  const storyCloseButton = useRef<HTMLButtonElement>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactNotice, setContactNotice] = useState("");
  const [contactError, setContactError] = useState("");
  const [donationBusy, setDonationBusy] = useState<number | null>(null);
  const [donationError, setDonationError] = useState("");
  const [donationNotice, setDonationNotice] = useState(() => {
    const status = new URLSearchParams(window.location.search).get("apoio");
    if (status === "concluido")
      return "O Stripe recebeu o teu pedido de apoio. Se escolheste Multibanco, o pagamento só fica confirmado depois de pagares a referência.";
    if (status === "cancelado")
      return "O pagamento foi cancelado. Não foi feito qualquer donativo.";
    return "";
  });

  async function sendContactMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactBusy(true);
    setContactError("");
    setContactNotice("");
    try {
      await apiRequest<{ message: string }>("/api/public/contact", undefined, {
        method: "POST",
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage }),
      });
      setContactNotice("Mensagem enviada. Obrigado pelo contacto.");
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    } catch (caught) {
      setContactError(caught instanceof Error ? caught.message : "Não foi possível enviar a mensagem.");
    } finally {
      setContactBusy(false);
    }
  }

  async function startDonation(amountEuro: number) {
    setDonationBusy(amountEuro);
    setDonationError("");
    setDonationNotice("");
    try {
      const { url } = await apiRequest<{ url: string }>("/api/public/donations/checkout", undefined, {
        method: "POST",
        body: JSON.stringify({ amountEuro }),
      });
      const checkoutUrl = new URL(url);
      if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com")
        throw new Error("O Stripe devolveu um endereço de pagamento inválido.");
      window.location.assign(checkoutUrl.href);
    } catch (caught) {
      setDonationError(caught instanceof Error ? caught.message : "Não foi possível iniciar o pagamento.");
      setDonationBusy(null);
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("apoio")) return;
    url.searchParams.delete("apoio");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const donationAmounts = [3, 5, 10];
  const storyOpen = showStoryBanner ?? localStoryOpen;
  const supportOpen = showSupportBanner ?? localSupportOpen;

  useEffect(() => {
    if (!storyOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    storyCloseButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismissStoryBanner?.();
        setLocalStoryOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [storyOpen, onDismissStoryBanner]);

  function dismissStory() {
    setLocalStoryOpen(false);
    onDismissStoryBanner?.();
  }

  function dismissSupport() {
    setLocalSupportOpen(false);
    onDismissSupportBanner?.();
  }

  return (
    <div className="landing">
      {storyOpen && createPortal(
        <div className="landing-story-overlay">
          <section
            className="landing-story-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-story-title"
            aria-describedby="landing-story-description"
          >
            <Button
              ref={storyCloseButton}
              className="landing-story-dialog-dismiss"
              appearance="subtle"
              icon={<Dismiss24Regular />}
              aria-label="Fechar história"
              title="Fechar"
              onClick={dismissStory}
            />
            <span className="landing-eyebrow">Porque nasceu o projeto Divide Casa Comigo</span>
            <h2 id="landing-story-title">Uma ideia que começou numa experiência pessoal.</h2>
            <p id="landing-story-description">
              Sou pai e mudei-me do Porto para Lisboa para estar perto da minha filha. Gostava de poder
              partilhar com ela uma residência alternada, mas, por enquanto, não consigo suportar sozinho
              o custo de uma casa que permita essa solução. Esta dificuldade limita o tempo que podemos
              passar juntos — uma realidade delicada, vivida por muitas famílias, sem que isso tenha de ser
              culpa de alguém. Neste momento, a possibilidade de residência alternada está em pausa,
              a aguardar apreciação do tribunal e até conseguir arrendar uma casa que permita essa solução.
              Criei esta plataforma na esperança de tornar mais fácil encontrar pessoas compatíveis para
              partilhar casa e, assim, abrir novas possibilidades para quem precisa de conciliar habitação
              acessível e vida familiar.
            </p>
            <p className="landing-story-signature">
              A plataforma é gratuita nesta fase. Se quiseres apoiar o projeto,{" "}
              <a href="#apoio" onClick={dismissStory}>podes pagar um café</a>.
            </p>
          </section>
        </div>,
        document.body,
      )}
      <header className="landing-header">
        <a className="landing-brand" href="#inicio" aria-label="Divide Casa Comigo, início">
          <span className="landing-brand-mark"><Home24Regular /></span>
          <span>Divide Casa Comigo<span className="landing-brand-period">.</span></span>
        </a>
        <nav className="landing-nav" aria-label="Navegação da página">
          <a href="#como-funciona">Como funciona</a>
          <a href="#privacidade">A nossa abordagem</a>
          <a href="#apoio">Apoiar</a>
        </nav>
        <div className="landing-header-actions">
          {authenticated ? (
            <>
              <Button appearance="subtle" onClick={onProfile}>O meu perfil</Button>
              <Button appearance="primary" className="landing-primary-button" onClick={onDiscover}>Descobrir <ArrowRight24Regular /></Button>
              <Button appearance="subtle" onClick={onSignOut}>Sair</Button>
            </>
          ) : (
            <>
              <Button appearance="subtle" onClick={onSignIn}>Entrar</Button>
              <Button appearance="primary" className="landing-primary-button" onClick={onSignUp}>Criar conta <ArrowRight24Regular /></Button>
            </>
          )}
        </div>
      </header>

      <main>
        <div className="landing-banners">
          <span id="apoio" className="landing-anchor" />
          <span id="historia" className="landing-anchor" />
          {supportOpen && (
            <section className="landing-top-banner landing-top-banner-support">
              <div>
                <span className="landing-eyebrow">Um café ajuda a continuar</span>
                <h2>O projeto é gratuito. O teu apoio é opcional.</h2>
                <p>
                  Se a ideia te for útil, podes contribuir com um pequeno donativo. O pagamento é feito numa
                  página segura do Stripe. MB WAY e Multibanco só aparecem se estiverem ativados na conta Stripe.
                </p>
              </div>
              <div className="landing-donation-options" aria-label="Opções de donativo">
                {donationAmounts.map((amountEuro) => (
                  <Button
                    className="landing-donation-link"
                    key={amountEuro}
                    appearance="secondary"
                    disabled={donationBusy !== null}
                    onClick={() => void startDonation(amountEuro)}
                  >
                    {donationBusy === amountEuro ? "A preparar pagamento…" : `Pagar um café · ${amountEuro} €`}
                  </Button>
                ))}
                {donationError && <MessageBar intent="error"><MessageBarBody>{donationError}</MessageBarBody></MessageBar>}
                {donationNotice && <MessageBar intent="success"><MessageBarBody>{donationNotice}</MessageBarBody></MessageBar>}
              </div>
              <Button
                className="landing-banner-dismiss"
                appearance="subtle"
                icon={<Dismiss24Regular />}
                aria-label="Fechar banner de apoio"
                title="Fechar"
                onClick={dismissSupport}
              />
            </section>
          )}
        </div>
        <section className="landing-hero" id="inicio">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span /> Uma forma mais humana de encontrar casa</div>
            <h1>Encontrar casa começa por encontrar <em>as pessoas certas.</em></h1>
            <p className="landing-lede">
              Junta-te a pessoas que procuram na tua zona e que combinam com a forma como gostas de viver.
              Menos acaso. Mais afinidade.
            </p>
            <div className="landing-hero-actions">
              <Button
                appearance={authenticated ? "subtle" : "primary"}
                className={authenticated ? undefined : "landing-primary-button"}
                size="large"
                onClick={onSignUp}
              >
                {authenticated ? "Completar o meu perfil" : "Criar o meu perfil"}
              </Button>
              <Button
                appearance={authenticated ? "primary" : "subtle"}
                className={authenticated ? "landing-primary-button" : undefined}
                size="large"
                onClick={onSignIn}
              >
                {authenticated ? "Ir para Descobrir" : "Já tenho conta"}
                {authenticated && <ArrowRight24Regular />}
              </Button>
            </div>
            <div className="landing-trust-line">
              <ShieldCheckmark24Regular />
              <span>A tua localização exata permanece privada.</span>
            </div>
          </div>

          <div className="landing-visual" aria-label="Pré-visualização de perfis de pessoas à procura de casa">
            <div className="landing-visual-orbit landing-visual-orbit-one" />
            <div className="landing-visual-orbit landing-visual-orbit-two" />
            <div className="landing-visual-note"><span className="landing-live-dot" /> Uma casa começa por aqui</div>
            <article className="landing-profile-card landing-profile-main">
              <div className="landing-profile-art landing-profile-art-one">
                <img
                  className="landing-profile-photo"
                  src="/images/sample-woman.jpg"
                  alt="Fotografia ilustrativa do perfil de Mariana"
                />
              </div>
              <div className="landing-profile-content">
                <div className="landing-profile-heading"><strong>Mariana, 27</strong><span>Perfil exemplo</span></div>
                <div className="landing-profile-location"><Location24Regular /> Lisboa · zona de procura</div>
                <p>Gosto de cozinhar, plantas e domingos sem pressa.</p>
                <div className="landing-profile-tags"><span>Rotinas tranquilas</span><span>Procura 1 pessoa</span></div>
              </div>
              <div className="landing-card-heart"><Heart24Regular /></div>
            </article>
            <article className="landing-profile-card landing-profile-secondary">
              <img
                className="landing-mini-avatar"
                src="/images/sample-man.jpg"
                alt="Fotografia ilustrativa do perfil de Rui"
              />
              <div><strong>Rui, 30</strong><span>Também procura em Lisboa</span></div>
              <span className="landing-match-icon"><Heart24Regular /></span>
            </article>
            <div className="landing-visual-caption">Pré-visualização ilustrativa</div>
          </div>
        </section>

        <section className="landing-principles" aria-label="O que torna a procura diferente">
          <div><PeopleCommunity24Regular /><span>Pessoas antes das paredes</span></div>
          <div><Location24Regular /><span>Procuras na tua zona</span></div>
          <div><Chat24Regular /><span>Conversa só quando há match</span></div>
        </section>

        <section className="landing-how" id="como-funciona">
          <div className="landing-section-intro">
            <span className="landing-eyebrow">Simples desde o primeiro passo</span>
            <h2>Uma boa partilha começa com uma boa combinação.</h2>
            <p>Sem deslizar por anúncios sem contexto. Primeiro conheces as pessoas; depois decidem juntos o que faz sentido.</p>
          </div>
          <div className="landing-steps">
            {steps.map((step) => (
              <article className="landing-step" key={step.number}>
                <span className="landing-step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-privacy" id="privacidade">
          <div className="landing-privacy-icon"><ShieldCheckmark24Regular /></div>
          <div>
            <span className="landing-eyebrow">Privacidade, desde o início</span>
            <h2>A tua localização é tua.</h2>
            <p>
              Não usamos cookies de terceiros para publicidade, análise ou rastreamento. A autenticação
              guarda uma sessão essencial no armazenamento local do teu browser. Usamos a zona de procura
              para sugerir pessoas compatíveis; a morada e as coordenadas exatas não aparecem no perfil
              público. O mapa carrega imagens de OpenStreetMap, que recebe os pedidos técnicos normais do
              browser, como o endereço IP e a zona do mapa visualizada.
            </p>
            <p className="landing-privacy-safeguards">
              Aplicamos controlos de acesso e minimização de dados, mas nenhum serviço online pode prometer
              risco zero. Partilha apenas o que consideras necessário e evita incluir dados sensíveis no
              perfil, chat ou formulário.
            </p>
          </div>
          <Button appearance="secondary" className="landing-secondary-button" onClick={onSignUp}>
            {authenticated ? "Completar o perfil" : "Começar com segurança"} <ArrowRight24Regular />
          </Button>
        </section>

        <section className="landing-rental-info" id="arrendamento">
          <span className="landing-eyebrow">Informação para uma decisão informada</span>
          <h2>Antes de partilhar casa</h2>
          <div className="landing-info-grid">
            <article>
              <h3>Contrato e recibos</h3>
              <p>
                Antes de pagares ou mudares, confirma por escrito quem será parte no contrato, como se divide
                a renda, que despesas estão incluídas e como serão emitidos os recibos. A emissão de recibos
                separados depende da relação contratual e do enquadramento fiscal; não é garantida em todos
                os modelos de partilha.
              </p>
              <a href="https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/Pages/default.aspx" target="_blank" rel="noreferrer">Portal das Finanças: questões frequentes</a>
            </article>
            <article>
              <h3>Direitos e deveres</h3>
              <p>
                A lei do arrendamento prevê regras sobre contrato, pagamento, conservação do imóvel,
                comunicações e cessação. Lê o contrato com atenção, guarda comprovativos e esclarece
                responsabilidades com o senhorio antes de assinares.
              </p>
              <a href="https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=691&tabela=leis" target="_blank" rel="noreferrer">Novo Regime do Arrendamento Urbano</a>
            </article>
            <article>
              <h3>Porta 65-Jovem</h3>
              <p>
                O programa destina-se a jovens dos 18 aos 35 anos e pode apoiar o pagamento da renda de
                candidatos que cumpram os requisitos em vigor. Rendimentos, contrato e composição do
                agregado também podem ser relevantes; assinalar
                interesse no perfil não significa que a candidatura seja elegível ou aprovada.
              </p>
              <a href="https://www.portaldahabitacao.pt/porta-65-jovem" target="_blank" rel="noreferrer">Consulta as condições no Portal da Habitação</a>
            </article>
          </div>
          <p className="landing-legal-note">Esta informação é geral, pode mudar e não substitui aconselhamento jurídico ou fiscal. Confirma sempre as regras e a tua situação junto das entidades oficiais ou de um profissional qualificado.</p>
        </section>

        <section className="landing-terms" id="termos">
          <span className="landing-eyebrow">Termos e utilização</span>
          <h2>Regras claras para uma comunidade mais segura.</h2>
          <div className="landing-terms-grid">
            <article><h3>O que a plataforma faz</h3><p>O Divide Casa Comigo ajuda pessoas a descobrir potenciais colegas de casa e a conversar. Não é uma agência imobiliária, não anuncia nem inspeciona imóveis, não te representa e não garante matches, alojamento, segurança ou elegibilidade para apoios.</p></article>
            <article><h3>Responsabilidade dos utilizadores</h3><p>Usa informação verdadeira, respeita as outras pessoas e não publiques conteúdo ilegal, discriminatório, enganador ou abusivo. Verifica a identidade, o imóvel e as condições por meios próprios; não envies dinheiro antes de confirmares a legitimidade do anúncio e do destinatário.</p></article>
            <article><h3>Dados, cookies e privacidade</h3><p>Não usamos cookies de terceiros para publicidade, análise ou rastreamento. A sessão de autenticação fica guardada no armazenamento local do browser. A localização exata não aparece no perfil público, mas usamos os dados que forneces para calcular compatibilidade. O mapa usa OpenStreetMap e recebe os pedidos do teu browser. Há medidas de segurança e controlo de acesso, mas não é correto prometer privacidade ou segurança absolutas. Partilha apenas o necessário e não incluas dados bancários, documentos de identificação ou moradas privadas nos perfis e conversas.</p></article>
          </div>
          <p className="landing-legal-note">Este resumo é informativo, não é aconselhamento jurídico e ainda deve ser revisto e completado para refletir o responsável pelo tratamento, retenção de dados, exercício de direitos e regras de reclamação aplicáveis ao serviço.</p>
        </section>

        <section className="landing-contact" id="contactos">
          <div>
            <span className="landing-eyebrow">Dúvidas, sugestões ou ajuda</span>
            <h2>Fala connosco.</h2>
            <p>As mensagens são encaminhadas para <a href="mailto:tiagopereiracode@gmail.com">tiagopereiracode@gmail.com</a>.</p>
          </div>
          <form onSubmit={(event) => void sendContactMessage(event)}>
            {contactError && <MessageBar intent="error"><MessageBarBody>{contactError}</MessageBarBody></MessageBar>}
            {contactNotice && <MessageBar intent="success"><MessageBarBody>{contactNotice}</MessageBarBody></MessageBar>}
            <label><span>Nome</span><Input value={contactName} maxLength={100} required onChange={(_, data) => setContactName(data.value)} /></label>
            <label><span>Email para resposta</span><Input type="email" value={contactEmail} maxLength={254} required onChange={(_, data) => setContactEmail(data.value)} /></label>
            <label><span>Mensagem</span><Textarea value={contactMessage} maxLength={5000} minLength={10} required resize="vertical" onChange={(_, data) => setContactMessage(data.value)} /></label>
            <Button appearance="primary" className="landing-primary-button" type="submit" disabled={contactBusy}>
              {contactBusy ? "A enviar…" : "Enviar mensagem"}
            </Button>
            <small>
              O formulário é limitado para reduzir mensagens automáticas. O nome, email e mensagem serão
              usados para responder ao pedido e enviados através do fornecedor de email SendGrid. Não
              incluas palavras-passe, dados bancários, documentos de identificação ou outra informação
              sensível.
            </small>
          </form>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-brand" href="#inicio">
          <span className="landing-brand-mark"><Home24Regular /></span>
          <span>Divide Casa Comigo<span className="landing-brand-period">.</span></span>
        </a>
        <span>Encontra pessoas. Sente-te em casa.</span>
        <nav aria-label="Informação legal e contacto">
          <a href="#termos">Termos</a>
          <a href="#arrendamento">Informação de arrendamento</a>
          <a href="#contactos">Contactos</a>
        </nav>
        <span>© Divide Casa Comigo</span>
      </footer>
    </div>
  );
}
