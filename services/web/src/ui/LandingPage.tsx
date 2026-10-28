import { Button } from "@fluentui/react-components";
import {
  ArrowRight24Regular,
  Chat24Regular,
  Heart24Regular,
  Home24Regular,
  Location24Regular,
  PeopleCommunity24Regular,
  ShieldCheckmark24Regular,
} from "@fluentui/react-icons";

type Props = {
  onSignIn: () => void;
  onSignUp: () => void;
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

export function LandingPage({ onSignIn, onSignUp }: Props) {
  return (
    <div className="landing">
      <header className="landing-header">
        <a className="landing-brand" href="#inicio" aria-label="Casa Comigo, início">
          <span className="landing-brand-mark"><Home24Regular /></span>
          <span>casa comigo<span className="landing-brand-period">.</span></span>
        </a>
        <nav className="landing-nav" aria-label="Navegação da página">
          <a href="#como-funciona">Como funciona</a>
          <a href="#privacidade">A nossa abordagem</a>
        </nav>
        <div className="landing-header-actions">
          <Button appearance="subtle" onClick={onSignIn}>Entrar</Button>
          <Button appearance="primary" className="landing-primary-button" onClick={onSignUp}>Criar conta <ArrowRight24Regular /></Button>
        </div>
      </header>

      <main>
        <section className="landing-hero" id="inicio">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span /> Uma forma mais humana de encontrar casa</div>
            <h1>Encontrar casa começa por encontrar <em>as pessoas certas.</em></h1>
            <p className="landing-lede">
              Junta-te a pessoas que procuram na tua zona e que combinam com a forma como gostas de viver.
              Menos acaso. Mais afinidade.
            </p>
            <div className="landing-hero-actions">
              <Button appearance="primary" className="landing-primary-button" size="large" onClick={onSignUp}>
                Criar o meu perfil <ArrowRight24Regular />
              </Button>
              <Button appearance="subtle" size="large" onClick={onSignIn}>Já tenho conta</Button>
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
                <span className="landing-art-sun" />
                <span className="landing-art-window" />
                <span className="landing-art-plant" aria-hidden="true" />
                <span className="landing-art-person">M</span>
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
              <div className="landing-mini-avatar">R</div>
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
            <p>Usamos a área de procura para sugerir pessoas compatíveis. A morada e as coordenadas exatas não aparecem no teu perfil público.</p>
          </div>
          <Button appearance="secondary" className="landing-secondary-button" onClick={onSignUp}>Começar com segurança <ArrowRight24Regular /></Button>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-brand" href="#inicio">
          <span className="landing-brand-mark"><Home24Regular /></span>
          <span>casa comigo<span className="landing-brand-period">.</span></span>
        </a>
        <span>Encontrar pessoas. Sentir-se em casa.</span>
        <span>© Casa Comigo</span>
      </footer>
    </div>
  );
}
