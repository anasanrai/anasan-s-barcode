import { ArrowLeft, Github, Globe, Linkedin, Twitter } from "lucide-react";

interface Props {
  onBack: () => void;
}

const PROJECTS = [
  {
    name: "HungerStation Barcode",
    desc: "Offline-first PWA for instant barcode scanning & generation, with a live multi-store ranking system.",
    url: "https://github.com/anasanrai/anasan-s-barcode",
    tag: "TypeScript",
  },
  {
    name: "BridgeFlow Agency",
    desc: "AI revenue operations — audits inbound lead handling, then builds the response and follow-up systems that close the gap.",
    url: "https://github.com/anasanrai/BridgeFlowAgency",
    tag: "AI / Automation",
  },
  {
    name: "n8nGalaxy",
    desc: "Static site for n8nGalaxy — a community hub around n8n workflow automation.",
    url: "https://github.com/anasanrai/n8ngalaxy-static-site",
    tag: "TypeScript",
  },
  {
    name: "Scrollvine",
    desc: "Author website with a reading-first experience.",
    url: "https://github.com/anasanrai/scrollvine",
    tag: "TypeScript",
  },
];

const LINKS = [
  { icon: Github, label: "GitHub", url: "https://github.com/anasanrai" },
  { icon: Globe, label: "bridgeflow.agency", url: "https://www.bridgeflow.agency" },
  { icon: Linkedin, label: "LinkedIn", url: "https://www.linkedin.com/in/anasan-rai/" },
  { icon: Twitter, label: "@AnasanRai", url: "https://x.com/AnasanRai" },
];

export default function AboutPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="about-page">
      <button type="button" className="admin-back-btn about-page__back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to app
      </button>

      <section className="about-hero">
        <div className="about-hero__avatar-ring">
          <img
            src="/about/anasan.jpg"
            alt="Anasan Rai"
            className="about-hero__avatar"
            loading="eager"
          />
        </div>
        <h1 className="about-hero__name">Anasan Rai</h1>
        <p className="about-hero__title">
          Founder of <a href="https://www.bridgeflow.agency" target="_blank" rel="noreferrer">BridgeFlow</a>
        </p>
        <blockquote className="about-hero__quote">“I love to build and manage.”</blockquote>
        <p className="about-hero__bio">
          I run BridgeFlow — an AI integration team that stops businesses from losing the
          inbound leads they already paid for. We audit how leads are handled, then build
          the AI response and follow-up systems that close the gap.
        </p>
      </section>

      <section className="about-projects">
        <h2 className="about-projects__title">Selected work</h2>
        <div className="about-projects__grid">
          {PROJECTS.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noreferrer" className="about-project-card">
              <span className="about-project-card__tag">{p.tag}</span>
              <h3 className="about-project-card__name">{p.name}</h3>
              <p className="about-project-card__desc">{p.desc}</p>
            </a>
          ))}
        </div>
      </section>

      <footer className="about-footer">
        {LINKS.map((l) => (
          <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="about-footer__link">
            <l.icon size={15} />
            <span>{l.label}</span>
          </a>
        ))}
      </footer>
    </main>
  );
}
