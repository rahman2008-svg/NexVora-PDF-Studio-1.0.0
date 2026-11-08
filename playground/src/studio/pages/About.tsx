import { Link } from 'react-router-dom';
import { BRAND } from '../lib/brand';
import { LogoMark } from '../components/Logo';

const wa = (n: string) => `https://wa.me/88${n.replace(/\D/g, '')}`;

export default function About() {
  const c = BRAND.contacts;
  return (
    <div className="nx-page">
      <div className="nx-row" style={{ gap: 16 }}>
        <LogoMark size={64} />
        <div>
          <h1 className="nx-h1"><span className="nx-grad-text">NexVora</span> PDF Studio</h1>
          <p className="nx-sub">Version {BRAND.version}</p>
        </div>
      </div>

      <div className="nx-two" style={{ marginTop: 20 }}>
        <section className="nx-card">
          <h2 className="nx-h2">Developer</h2>
          <p style={{ margin: '0 0 4px' }}><strong>{BRAND.developer}</strong></p>
          <p className="nx-muted" style={{ marginTop: 0 }}>{BRAND.organization}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 8 }}>
            {c.whatsapp.map((n) => <li key={n}>WhatsApp: <a className="nx-grad-text" href={wa(n)} target="_blank" rel="noopener noreferrer">{n}</a></li>)}
            <li>Facebook: <a className="nx-grad-text" href={c.facebook} target="_blank" rel="noopener noreferrer">{c.facebook}</a></li>
            <li>Instagram: <a className="nx-grad-text" href={c.instagram} target="_blank" rel="noopener noreferrer">{c.instagram}</a></li>
            <li>Gmail: <a className="nx-grad-text" href={`mailto:${c.gmail}`}>{c.gmail}</a></li>
          </ul>
        </section>
        <section className="nx-card">
          <h2 className="nx-h2">Credits</h2>
          <p style={{ margin: 0 }}>Developed by {BRAND.developer}</p>
          <p style={{ margin: '4px 0 0' }}>Published by {BRAND.organization}</p>
          <p className="nx-muted">{BRAND.copyright}</p>
        </section>
        <section className="nx-card" style={{ gridColumn: '1 / -1' }}>
          <h2 className="nx-h2">Open-source attribution</h2>
          <p className="nx-sub" style={{ marginTop: 0 }}>
            NexVora PDF Studio is built on <strong>pdfme</strong> (<a className="nx-grad-text" href="https://github.com/pdfme/pdfme" target="_blank" rel="noopener noreferrer">github.com/pdfme/pdfme</a>),
            © hand-dot and pdfme contributors, released under the MIT License. The PDF designer, generator, schemas, converter and manipulator packages are pdfme’s.
            The pdfme MIT license text is preserved in <code>LICENSE.md</code>. Other third-party libraries (React, Tailwind CSS, bwip-js, pdf-lib fork, lucide-react, react-router, react-toastify) keep their own licenses.
            NexVora’s own additions are marked as such in the README; the NexVora name and logo are not part of pdfme.
          </p>
          <p className="nx-muted">Looking for the original pdfme playground? It is still available: <Link to="/templates" className="nx-grad-text">open the original playground</Link>.</p>
        </section>
      </div>
    </div>
  );
}
