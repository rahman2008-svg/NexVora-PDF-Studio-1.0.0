import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ClipboardList, FolderOpen, Info, LayoutDashboard, Layers, Library, Menu, Moon, PanelLeftClose,
  PanelLeftOpen, QrCode, Settings, Sun, Wrench, FilePlus2, X,
} from 'lucide-react';
import { Logo, LogoMark } from './Logo';
import { useSettings } from '../lib/settings';
import type { TKey } from '../lib/i18n';

type Item = { to: string; key: TKey; icon: typeof Info; end?: boolean };
const ITEMS: Item[] = [
  { to: '/studio', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/studio/library', key: 'library', icon: Library },
  { to: '/studio/projects', key: 'projects', icon: FolderOpen },
  { to: '/studio/generate', key: 'generate', icon: FilePlus2 },
  { to: '/studio/forms', key: 'forms', icon: ClipboardList },
  { to: '/studio/bulk', key: 'bulk', icon: Layers },
  { to: '/studio/tools', key: 'utilities', icon: Wrench },
  { to: '/studio/codes', key: 'codes', icon: QrCode },
  { to: '/studio/settings', key: 'settings', icon: Settings },
  { to: '/studio/about', key: 'about', icon: Info },
];
const BOTTOM = ['/studio', '/studio/library', '/studio/projects', '/studio/tools', '/studio/settings'];

export default function Shell({ children }: { children: ReactNode }) {
  const { t, update, resolvedTheme } = useSettings();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nx-side-collapsed') === '1');
  const [drawer, setDrawer] = useState(false);
  const fullscreen = pathname.startsWith('/studio/editor');

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    localStorage.setItem('nx-side-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  if (fullscreen) return <div className="nx-root">{children}</div>;

  const toggleTheme = () => update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' });
  const nav = (items: Item[]) =>
    items.map(({ to, key, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} className={({ isActive }) => `nx-nav${isActive ? ' active' : ''}`} title={t(key)}>
        <Icon size={19} />
        <span className="nx-label">{t(key)}</span>
      </NavLink>
    ));

  return (
    <div className="nx-root">
      <div className="nx-mobilebar">
        <button className="nx-btn sm icon" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu size={18} /></button>
        <LogoMark size={28} />
        <strong style={{ flex: 1 }}><span className="nx-grad-text">NexVora</span> PDF Studio</strong>
        <button className="nx-btn sm icon" aria-label="Toggle theme" onClick={toggleTheme}>
          {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
      {drawer && <div className="nx-scrim" onClick={() => setDrawer(false)} />}
      <div className="nx-shell">
        <aside className={`nx-side${collapsed ? ' collapsed' : ''}${drawer ? ' drawer' : ''}`}>
          <div className="nx-row" style={{ justifyContent: 'space-between', padding: '4px 4px 14px' }}>
            <Logo collapsed={collapsed && !drawer} />
            {drawer && <button className="nx-btn sm icon" aria-label="Close menu" onClick={() => setDrawer(false)}><X size={16} /></button>}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }} aria-label="Main">{nav(ITEMS)}</nav>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="nx-nav" onClick={toggleTheme} title={t('theme')}>
              {resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              <span className="nx-label">{resolvedTheme === 'dark' ? t('light') : t('dark')}</span>
            </button>
            <button className="nx-nav" onClick={() => setCollapsed((c) => !c)} title="Collapse sidebar" style={{ display: drawer ? 'none' : undefined }}>
              {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
              <span className="nx-label">Collapse</span>
            </button>
            <div className="nx-muted nx-label" style={{ padding: '6px 10px', fontSize: 11 }}>v1.0.0</div>
          </div>
        </aside>
        <main className="nx-main">{children}</main>
      </div>
      <nav className="nx-bottomnav" aria-label="Quick navigation">
        {BOTTOM.map((to) => {
          const it = ITEMS.find((i) => i.to === to)!;
          const Icon = it.icon;
          const active = it.end ? pathname === to : pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} className={active ? 'active' : ''}>
              <Icon size={20} />
              {t(it.key)}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
