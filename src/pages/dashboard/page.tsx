import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bookmark, Bot, ChartNoAxesCombined, ChevronDown, ChevronRight, KeyRound, Link2, MessageSquare, Sparkles, Wand2, ChevronLeft, ExternalLink, Globe2, LayoutDashboard, LoaderCircle, LogOut, Building2, Monitor, Zap, Package, Search, Settings, Users, Video, X } from 'lucide-react';
import { Analytics, Creator, CreatorVideo, Market, Metric, Period, markets, money, normalizeUsername, number, safeUrl, searchCreator, loadCreatorDetails, validUsername } from './creator-api';
import './dashboard.css';
import { ApiSettingsPage } from '../../settings/ApiSettingsPage';
import { CreatorExplorer } from './CreatorExplorer';
import { useStore } from '../../store';
import { useAuthStore } from '../../auth-store';
import { BusinessConnectPage } from '../business/BusinessConnectPage';
import { BotPanel, type BotName } from './BotPanel';
import { MonitorPanel } from './MonitorPanel';
type Section = 'dashboard' | 'creator-search' | 'winning-products' | 'content' | 'business-connect' | 'bots' | 'monitor' | 'saved' | 'settings';
type HistoryItem = {
    username: string;
    market: Market;
    time: string;
};
const nav = [{ id: 'winning-products', label: 'Winning products', icon: Link2 }, { id: 'creator-search', label: 'Search Creator API', icon: Wand2 }, { id: 'content', label: 'Search ideas', icon: ChartNoAxesCombined }, { id: 'business-connect', label: 'Business Connect', icon: Building2 }] as const;
/** Sections reachable from the URL (?section=…) besides the Affiliates tools. */
const EXTRA_SECTIONS = ['settings', 'monitor', 'bots'];
const isSection = (v: string | null): v is Section => !!v && (EXTRA_SECTIONS.includes(v) || nav.some(n => n.id === v));
const PATH_SECTIONS: Record<string, Section> = { '/business-connect': 'business-connect', '/monitor': 'monitor' };
function read<T>(key: string, fallback: T): T { try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(value) ? value as T : fallback;
}
catch {
    return fallback;
} }
function Empty({ title, text, icon: Icon = Search }: {
    title: string;
    text: string;
    icon?: typeof Search;
}) { return <div className="research-empty"><span><Icon size={25} strokeWidth={1.5}/></span><h3>{title}</h3><p>{text}</p></div>; }
function Avatar({ creator }: {
    creator: Creator;
}) { return safeUrl(creator.avatar) ? <img className="creator-avatar-new" src={safeUrl(creator.avatar)} alt={`${creator.displayName || creator.username} profile`} onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/> : <span className="creator-avatar-new">{creator.username.charAt(0).toUpperCase()}</span>; }
function Stats({ metrics, currency }: {
    metrics?: Analytics['metrics'];
    currency: string;
}) { const m = metrics || {}; return <div className="research-kpis">{[['Revenue / GMV', money(m.revenue, currency)], ['Items Sold', number(m.itemsSold)], ['Products Promoted', number(m.productsPromoted)], ['Videos', number(m.videos)], ['Average Views', number(m.averageViews)], ['Engagement Rate', number(m.engagementRate, '%')]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>; }
function Performance({ analytics, currency }: {
    analytics?: Analytics;
    currency: string;
}) {
    const [metric, setMetric] = useState<Metric>('revenue');
    const points = (analytics?.series || []).filter(p => typeof p[metric] === 'number' && Number.isFinite(p[metric]) && !isNaN(Date.parse(p.date))).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const max = Math.max(1, ...points.map(p => p[metric]!));
    return <section className="research-panel"><div className="panel-heading"><div><h2>Performance over time</h2><p>A closer look at the numbers behind the creator.</p></div><div className="research-segments">{(['revenue', 'itemsSold', 'views', 'videos'] as Metric[]).map((m, i) => <button key={m} className={metric === m ? 'selected' : ''} onClick={() => setMetric(m)}>{['Revenue', 'Items Sold', 'Views', 'Videos'][i]}</button>)}</div></div>{points.length ? <><div className="performance-chart"><div className="chart-scale"><span>{metric === 'revenue' ? money(max, currency) : number(max)}</span><span>0</span></div><svg viewBox="0 0 900 220" role="img" aria-label={`${metric} over time`} preserveAspectRatio="none">{[20, 75, 130, 185].map(y => <line key={y} x1="10" y1={y} x2="890" y2={y} stroke="#e8edf2" strokeDasharray="4 5"/>)}<polyline fill="none" stroke="#2563eb" strokeWidth="3" points={points.map((p, i) => `${10 + i / Math.max(1, points.length - 1) * 880},${200 - p[metric]! / max * 180}`).join(' ')}/>{points.map((p, i) => <circle key={i} cx={10 + i / Math.max(1, points.length - 1) * 880} cy={200 - p[metric]! / max * 180} r="4" fill="#2563eb"><title>{p.date}: {metric === 'revenue' ? money(p[metric], currency) : number(p[metric])}</title></circle>)}</svg></div><div className="chart-dates"><span>{points[0].date}</span><span>{points[points.length - 1].date}</span></div></> : <Empty title="No performance data for this period" text="The chart will appear when verified historical data is available." icon={ChartNoAxesCombined}/>}</section>;
}
function CreatorDetailsView({ creator, period, setPeriod, busy, back, saved, save }: {
    creator: Creator;
    period: Period;
    setPeriod: (v: Period) => void;
    busy: boolean;
    back: () => void;
    saved: boolean;
    save: () => void;
}) {
    const [sort, setSort] = useState('revenue');
    const a = creator.analytics[period];
    const currency = creator.currency || (creator.market === 'GB' ? 'GBP' : 'USD');
    const videos = [...(a?.videos || [])].sort((x, y) => sort === 'newest' ? (Date.parse(y.postedAt || '') || 0) - (Date.parse(x.postedAt || '') || 0) : ((y[sort as keyof CreatorVideo] as number) ?? -1) - ((x[sort as keyof CreatorVideo] as number) ?? -1));
    return <><button className="research-back" onClick={back}><ChevronLeft size={16}/> Back to creator search</button><div className="creator-detail-heading"><div className="creator-identity"><Avatar creator={creator}/><div><span className="eyebrow">CREATOR INTELLIGENCE</span><h1>{creator.displayName || creator.username}</h1><p>@{creator.username} <span>·</span> {markets[creator.market].flag} {markets[creator.market].name}</p></div></div><div className="creator-actions"><button onClick={save}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'}/>{saved ? 'Saved' : 'Save creator'}</button><a href={`https://www.tiktok.com/@${encodeURIComponent(creator.username)}`} target="_blank" rel="noreferrer">TikTok profile <ExternalLink size={14}/></a></div></div><div className="creator-social">{[['Followers', creator.followers], ['Following', creator.following], ['Likes', creator.likes]].map(([label, value]) => <span key={label as string}><strong>{number(value as number)}</strong> {label}</span>)}</div><div className="period-heading"><div><h2>Creator overview</h2><p>Shop performance · {currency} · estimates where provided</p></div><select aria-label="Analytics time period" value={period} onChange={e=>setPeriod(Number(e.target.value) as Period)}>{([7,30,90,180,365] as Period[]).map(p=><option key={p} value={p}>{p===365?'Last 1 year':`Last ${p} days`}</option>)}</select></div>{busy ? <div className="research-notice" role="status"><LoaderCircle className="spin" size={16}/> Updating analytics...</div> : null}<Stats metrics={a?.metrics} currency={currency}/><Performance analytics={a} currency={currency}/><section className="research-panel"><div className="panel-heading"><div><h2>Products promoted</h2><p>The products behind this creator’s shop performance.</p></div><span className="count-badge">{a ? a.products.length : '—'} products</span></div>{a?.products.length ? <div className="media-grid">{a.products.map(p => <article className="media-card" key={p.id}>{safeUrl(p.image) ? <img src={safeUrl(p.image)} alt={p.name}/> : <div className="media-placeholder"><Package /></div>}<div><h3>{p.name}</h3><strong>{money(p.price, currency)}</strong><dl><div><dt>Est. revenue</dt><dd>{money(p.revenue, currency)}</dd></div><div><dt>Est. units sold</dt><dd>{number(p.itemsSold)}</dd></div><div><dt>Commission</dt><dd>{number(p.commission, '%')}</dd></div><div><dt>Creator videos</dt><dd>{number(p.videos)}</dd></div></dl>{safeUrl(p.url) ? <a href={safeUrl(p.url)} target="_blank" rel="noreferrer">View Product <ArrowUpRight size={15}/></a> : <button disabled>View Product</button>}</div></article>)}</div> : <Empty title="No product data available" text="Promoted products will appear here when supplied by the data source." icon={Package}/>}</section><section className="research-panel"><div className="panel-heading"><div><h2>Top Performing Videos</h2><p>Product-led content, ranked by what matters to you.</p></div><select aria-label="Sort videos" value={sort} onChange={e => setSort(e.target.value)}><option value="revenue">Most Revenue</option><option value="itemsSold">Most Sales</option><option value="views">Most Views</option><option value="newest">Newest</option></select></div>{videos.length ? <div className="media-grid">{videos.map(v => <article className="media-card" key={v.id}>{safeUrl(v.thumbnail) ? <img src={safeUrl(v.thumbnail)} alt={v.product || 'Creator video'}/> : <div className="media-placeholder"><Video /></div>}<div><h3>{v.product || 'Product unavailable'}</h3><p>{v.postedAt && !isNaN(Date.parse(v.postedAt)) ? new Date(v.postedAt).toLocaleDateString() : '—'}</p><dl>{[['Views', number(v.views)], ['Likes', number(v.likes)], ['Comments', number(v.comments)], ['Shares', number(v.shares)], ['Est. sales', number(v.itemsSold)], ['Est. revenue', money(v.revenue, currency)]].map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>{safeUrl(v.url) && <a href={safeUrl(v.url)} target="_blank" rel="noreferrer">Watch video <ExternalLink size={14}/></a>}</div></article>)}</div> : <Empty title="No video data available" text="Shoppable videos will appear when the data source provides them." icon={Video}/>}</section><section className="research-panel"><div className="panel-heading"><div><h2>Category breakdown</h2><p>Where this creator performs best.</p></div></div>{a?.categories.length ? <div className="category-bars">{a.categories.filter(c => Number.isFinite(c.percentage) && c.percentage >= 0 && c.percentage <= 100).map(c => <div key={c.name}><span>{c.name}</span><div><i style={{ width: `${c.percentage}%` }}/></div><strong>{number(c.percentage, '%')}</strong></div>)}</div> : <Empty title="No category breakdown available" text="Category shares require verified performance data." icon={ChartNoAxesCombined}/>}</section></>;
}
function CreatorDetails(props: React.ComponentProps<typeof CreatorDetailsView> & { onLoaded: (creator: Creator) => void }) {
  const [loaded,setLoaded]=useState<Creator|null>(null);
  const [error,setError]=useState('');const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoaded(null);setError('');
    const timer=setTimeout(()=>{controller.abort();setError('The request timed out. Please try again.');},30000);
    loadCreatorDetails(props.creator,props.period,controller.signal).then(c=>{if(!controller.signal.aborted){setLoaded(c);props.onLoaded(c);}}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load creator data. Please try again.');}).finally(()=>clearTimeout(timer));
    return ()=>{clearTimeout(timer);controller.abort();};
  },[props.creator.id,props.creator.market,props.period,retry]);
  if(error)return <><button className="research-back" onClick={props.back}><ChevronLeft size={16}/> Back to creator search</button><div className="research-notice" role="alert">{error}<button onClick={()=>setRetry(r=>r+1)}>Try again</button></div></>;
  if(!loaded)return <div className="research-notice" role="status"><LoaderCircle className="spin" size={16}/> Loading creator analytics…<button onClick={props.back}>Back to search</button></div>;
  return <>{loaded.stale&&<div className="research-notice" role="status">Showing recently cached data while live updates are unavailable.</div>}{loaded.detailWarning&&<div className="research-notice">{loaded.detailWarning}<button onClick={()=>setRetry(r=>r+1)}>Refresh</button></div>}{loaded.bio&&<p>{loaded.bio}</p>}<CreatorDetailsView {...props} creator={loaded} busy={false}/></>;
}
function AffiliateSection({ section }: { section: 'winning-products' | 'content' }) {
  const [country, setCountry] = useState<Market>('US');
  const [category, setCategory] = useState('items');
  const [views, setViews] = useState('20k-50k');
  return <><div className="research-page-heading"><div><span className="eyebrow">Affiliate research</span><h1>{section === 'winning-products' ? 'Winning products' : 'Search ideas'}</h1><p>Find products, creators and video ideas.</p></div></div><section className="research-panel"><div className="panel-heading"><div><h2>{section === 'winning-products' ? 'Top 10 products by sales this month' : 'Search TikTok ideas'}</h2><p>{section === 'winning-products' ? 'Pick USA or UK, then select a product to see the videos driving the most sales for it.' : 'Filter country, category and view range to understand why one video outperforms another.'}</p></div>{section === 'winning-products' ? <div className="research-segments">{(['US','GB'] as Market[]).map(m=><button key={m} className={country===m?'selected':''} onClick={()=>setCountry(m)}>{m==='US'?'USA':'UK'}</button>)}</div> : <div className="original-idea-filters"><select aria-label="Country" value={country} onChange={e=>setCountry(e.target.value as Market)}><option value="US">USA</option><option value="GB">UK</option></select><select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)}><option value="items">Items</option><option value="drinks">Drinks</option></select><select aria-label="View range" value={views} onChange={e=>setViews(e.target.value)}><option value="1k-20k">1k to 20k</option><option value="20k-50k">20k to 50k</option><option value="50k+">50k+</option></select></div>}</div><Empty title={section==='winning-products'?'Product data currently unavailable':'Video data currently unavailable'} text={`Verified ${markets[country].name} TikTok Shop data is needed to show ${section==='winning-products'?'product rankings and sales videos':'videos for these filters'}.`} icon={section==='winning-products'?Package:Video}/></section></>;
}
export function ResearchDashboard({ onSettings, profileName = 'Your workspace' }: {
    onSettings: () => void;
    profileName?: string;
}) {
    const openaiKey = useStore(s => s.openaiKey);
    const grokKey = useStore(s => s.grokKey);
    const usage = useStore(s => s.generationUsage);
    const signOut = useAuthStore(s => s.signOut);
    const accessToken = useAuthStore(s => s.session?.access_token ?? null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const imageCredits = openaiKey ? Math.max(0, 100 - (usage.image || 0)) : 0;
    const videoCredits = grokKey ? Math.max(0, 20 - (usage.video || 0)) : 0;
    const totalCredits = imageCredits + videoCredits;
    async function handleLogout() {
        setLoggingOut(true);
        setLogoutError('');
        try {
            const result = await signOut();
            if (result.error) { setLogoutError('Could not log out. Please try again.'); return; }
            window.history.replaceState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch { setLogoutError('Could not log out. Please try again.'); }
        finally { setLoggingOut(false); }
    }
    const initial = location.pathname.startsWith('/creator/') ? 'creator-search' : PATH_SECTIONS[location.pathname] ?? new URLSearchParams(location.search).get('section');
    const [openSections, setOpenSections] = useState({ affiliates: true, bots: true, automation: true, setting: true });
    const toggleSection = (key: keyof typeof openSections) => setOpenSections(current => ({ ...current, [key]: !current[key] }));
    const [botTitle, setBotTitle] = useState<BotName>('Hook bot');
    const [section, setSection] = useState<Section>(isSection(initial) ? initial : 'winning-products');
    const [market, setMarket] = useState<Market | ''>('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('idle');
    const [creator, setCreator] = useState<Creator | null>(null);
    const [detail, setDetail] = useState(false);
    const [period, setPeriod] = useState<Period>(30);
    const [history, setHistory] = useState<HistoryItem[]>(() => read('launchly.research.history', []));
    const [saved, setSaved] = useState<Creator[]>(() => read('launchly.research.saved', []));
    const [storageError, setStorageError] = useState(false);
    const request = useRef<AbortController | null>(null);
    useEffect(() => () => request.current?.abort(), []);
    useEffect(() => { try {
        localStorage.setItem('launchly.research.history', JSON.stringify(history));
        localStorage.setItem('launchly.research.saved', JSON.stringify(saved));
    }
    catch {
        setStorageError(true);
    } }, [history, saved]);
    useEffect(() => { const handler = () => {
      const params = new URLSearchParams(location.search);const id = location.pathname.match(/^\/creator\/(\d{1,30})$/)?.[1];
      if(id){const region=params.get('region')||'GB';if(!Object.prototype.hasOwnProperty.call(markets,region))return;
        setSection('creator-search');setCreator({id,username:'',market:region as Market,analytics:{}});setMarket(region as Market);setDetail(true);
        const days=Number(params.get('period')||30);setPeriod(([7,30,90,180,365].includes(days)?days:30) as Period);return;}
      const value=PATH_SECTIONS[location.pathname]??params.get('section');setSection(isSection(value)?value:'winning-products');setDetail(false);
    };handler();window.addEventListener('popstate',handler);return ()=>window.removeEventListener('popstate',handler); }, []);
    function go(next: Section) { request.current?.abort(); setStatus('idle'); setSection(next); setDetail(false); const url = new URL('/dashboard',location.origin); url.searchParams.set('section', next); window.history.pushState({}, '', url); }
    function changeMarket(value: Market | '') { request.current?.abort(); setMarket(value); setCreator(null); setDetail(false); setStatus('idle'); }
    async function runSearch(event?: React.FormEvent, nextPeriod: Period = period, input = query, country = market, keepDetail = false) {
        event?.preventDefault();
        if (!country || !validUsername(input))
            return;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const timeout = window.setTimeout(() => { controller.abort(); if (request.current === controller) {
            setStatus('unavailable');
            setCreator(null);
            setDetail(false);
        } }, 15000);
        setStatus('searching');
        if (!keepDetail) {
            setCreator(null);
            setDetail(false);
        }
        try {
            const result = await searchCreator(input, country, nextPeriod, controller.signal);
            if (controller.signal.aborted)
                return;
            setStatus(result.status);
            if (result.status === 'found') {
                setCreator(result.creator);
                setDetail(true);
                window.history.pushState({},'',`/creator/${encodeURIComponent(result.creator.id!)}?region=${country}&period=${nextPeriod}`);
            }
            else {
                setCreator(null);
                setDetail(false);
            }
            if (!keepDetail)
                setHistory(h => [{ username: normalizeUsername(input), market: country, time: new Date().toISOString() }, ...h.filter(x => x.username !== normalizeUsername(input) || x.market !== country)].slice(0, 12));
        }
        catch {
            if (!controller.signal.aborted)
                setStatus('unavailable');
        }
        finally {
            clearTimeout(timeout);
        }
    }
    function repeat(item: HistoryItem) { go('creator-search'); setMarket(item.market); setQuery(item.username); setPeriod(30); runSearch(undefined, 30, item.username, item.market); }
    function saveCreator() { if (!creator)
        return; setSaved(s => s.some(c => c.username === creator.username && c.market === creator.market) ? s.filter(c => c.username !== creator.username || c.market !== creator.market) : [creator, ...s]); }
    const isSaved = !!creator && saved.some(c => c.username === creator.username && c.market === creator.market);
    const title = section === 'settings' ? 'Settings' : section === 'monitor' ? 'Monitor' : section === 'bots' ? botTitle : nav.find(n => n.id === section)?.label || 'Dashboard';
    const historyRows = (items: HistoryItem[]) => <div className="research-list">{items.map((item, i) => <button key={`${item.market}-${item.username}-${i}`} onClick={() => repeat(item)}><span className="list-icon"><Search size={16}/></span><span><strong>@{item.username}</strong><small>{markets[item.market]?.flag} {markets[item.market]?.name} · {new Date(item.time).toLocaleDateString()}</small></span><ArrowUpRight size={16}/></button>)}</div>;
    const savedRows = () => saved.length ? <div className="research-list">{saved.map(c => <button key={`${c.market}-${c.username}`} onClick={() => repeat({ username: c.username, market: c.market, time: new Date().toISOString() })}><Avatar creator={c}/><span><strong>{c.displayName || c.username}</strong><small>@{c.username} · {markets[c.market]?.name}</small></span><ArrowUpRight size={16}/></button>)}</div> : <Empty title="Your shortlist starts here" text="Save creators from their analytics page to find them again." icon={Bookmark}/>;
    return <div className="research-app"><aside className="research-sidebar"><a className="research-brand" href="/">launchly<span>®</span></a><nav aria-label="Dashboard sections" className="original-sections">
<button className="research-section-heading" onClick={() => toggleSection('affiliates')} aria-expanded={openSections.affiliates} aria-controls="affiliate-navigation"><span>Affiliates tools</span>{openSections.affiliates ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
{openSections.affiliates && <div id="affiliate-navigation" className="research-section-items">{nav.map(({id,label,icon:Icon}) => <button key={id} aria-label={label} title={label} className={section===id?'active':''} onClick={()=>go(id)} aria-current={section===id?'page':undefined}><Icon size={16}/><span>{label}</span></button>)}</div>}
<button className="research-section-heading" onClick={() => toggleSection('bots')} aria-expanded={openSections.bots} aria-controls="bots-navigation"><span>Bots</span>{openSections.bots ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
{openSections.bots && <div id="bots-navigation" className="research-section-items">{([{label:'Hook bot',icon:Bot},{label:'Caption bot',icon:MessageSquare},{label:'Creative bot',icon:Sparkles}] as {label:BotName;icon:typeof Bot}[]).map(({label,icon:Icon})=><button key={label} aria-label={label} title={label} className={section==='bots'&&botTitle===label?'active':''} onClick={()=>{setBotTitle(label);go('bots');}}><Icon size={16}/><span>{label}</span></button>)}</div>}
<button className="research-section-heading" onClick={() => toggleSection('automation')} aria-expanded={openSections.automation} aria-controls="automation-navigation"><span>Automation</span>{openSections.automation ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
{openSections.automation && <div id="automation-navigation" className="research-section-items"><button aria-label="Monitor" title="Monitor" className={section==='monitor'?'active':''} onClick={()=>go('monitor')} aria-current={section==='monitor'?'page':undefined}><Monitor size={16}/><span>Monitor</span></button></div>}
<button className={`settings-nav-item ${section === 'settings' ? 'active' : ''}`} aria-label="Settings" title="Settings" aria-current={section === 'settings' ? 'page' : undefined} onClick={() => go('settings')}><Settings size={17}/><span>Settings</span></button>
</nav><div className="sidebar-bottom">{section!=='creator-search'&&<button className="sidebar-credit-box" onClick={() => go('settings')} title={openaiKey || grokKey ? `Local generation allowance: ${imageCredits} image credits + ${videoCredits} video credits remaining` : 'Add your API keys in Settings to unlock generation credits'} aria-label={`Total credits: ${totalCredits}. Open settings`}><span className="sidebar-credit-icon"><Zap size={18}/></span><span className="sidebar-credit-copy"><small>Total credits</small><strong>{totalCredits.toLocaleString()} <span>left</span></strong></span><ChevronRight size={15}/></button>}<div className="workspace-profile"><span>{profileName.charAt(0).toUpperCase()}</span><div><strong>{profileName}</strong><small>Research workspace</small></div><button className="sidebar-logout" onClick={handleLogout} disabled={loggingOut} aria-label={loggingOut ? "Logging out" : "Log out"} title="Log out">{loggingOut ? <LoaderCircle size={17} className="spin"/> : <LogOut size={17}/>}</button></div>{logoutError && <p className="sidebar-logout-error" role="alert">{logoutError}</p>}</div></aside><div className="research-body"><header className="research-topbar"><span>Workspace <span>/</span> <strong>{title}</strong></span><div><span className="research-live-dot"/> TikTok Shop research</div></header><main className="research-main">{storageError && <div className="research-notice">Browser storage is unavailable. Your saved items will last for this session only.</div>}{section === 'settings' ? <ApiSettingsPage/> : section === 'business-connect' ? <BusinessConnectPage token={accessToken ?? ''}/> : section === 'bots' ? <BotPanel key={botTitle} bot={botTitle} onSettings={() => go('settings')}/> : section === 'monitor' ? <MonitorPanel onSettings={() => go('settings')}/> : section === 'winning-products' || section === 'content' ? <AffiliateSection section={section}/> : section === 'creator-search' ? <>{detail && creator ? <CreatorDetails onLoaded={setCreator} creator={creator} period={period} busy={status === 'searching'} setPeriod={p => { setPeriod(p); const url=new URL(location.href);url.searchParams.set('period',String(p));window.history.replaceState({},'',url); }} back={() => go('creator-search')} saved={isSaved} save={saveCreator}/> : null}<div hidden={detail && !!creator}><CreatorExplorer saved={saved} onSave={c=>setSaved(items=>items.some(x=>x.username===c.username&&x.market===c.market)?items.filter(x=>x.username!==c.username||x.market!==c.market):[c,...items])} onOpen={(c,p)=>{setCreator(c);setMarket(c.market);setQuery(c.username);setPeriod(p);setStatus('found');setDetail(true);window.history.pushState({},'',`/creator/${encodeURIComponent(c.id!)}?region=${c.market}&period=${p}`);}} onHistory={(username,market)=>setHistory(items=>[{username,market,time:new Date().toISOString()},...items.filter(x=>x.username!==username||x.market!==market)].slice(0,12))}/></div></> : section === 'dashboard' ? <><div className="research-page-heading"><div><span className="eyebrow">YOUR RESEARCH, IN FOCUS</span><h1>Dashboard</h1><p>Your creators, products and opportunities. All in one place.</p></div><button className="research-primary" onClick={() => go('creator-search')}>Find a creator <ArrowRight size={17}/></button></div><div className="overview-kpis">{[{ label: 'Creators Tracked', value: saved.length, icon: Users, note: 'In your saved shortlist' }, { label: 'Products Saved', value: 0, icon: Package, note: 'Build your product collection' }, { label: 'Content Found', value: 0, icon: Video, note: 'Your content discoveries' }, { label: 'Automation Jobs', value: 0, icon: Bot, note: 'No jobs running' }].map(({ label, value, icon: Icon, note }) => <div className="research-panel overview-kpi" key={label}><div><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><p>{note}</p></div>)}</div><section className="research-callout"><div><span className="eyebrow">CREATOR INTELLIGENCE</span><h2>Go beyond the follower count.</h2><p>Research the audience, products and content behind a creator.</p><button onClick={() => go('creator-search')}>Search Creator API <ArrowRight size={16}/></button></div><div className="callout-art" aria-hidden="true"><Users size={43} strokeWidth={1}/><span>US</span><span>UK</span></div></section><div className="dashboard-grid"><section className="research-panel"><div className="panel-heading"><h2>Recent creator searches</h2><button className="text-button" onClick={() => go('creator-search')}>Search <ArrowUpRight size={15}/></button></div>{history.length ? historyRows(history.slice(0, 4)) : <Empty title="Your next discovery is a search away" text="Look up a creator to start building your research history."/>}</section><section className="research-panel"><div className="panel-heading"><h2>Saved creators</h2><Bookmark size={17}/></div>{savedRows()}</section><section className="research-panel"><div className="panel-heading"><h2>Trending products</h2><span className="outline-badge">Market insights</span></div><Empty title="Waiting for product insights" text="Verified trending products will appear when market data is available." icon={Package}/></section><section className="research-panel"><div className="panel-heading"><h2>Recent activity</h2><span className="count-badge">This browser</span></div>{history.length ? historyRows(history.slice(0, 3)) : <Empty title="A fresh workspace" text="Your creator searches will appear here as you explore." icon={ChartNoAxesCombined}/>}</section></div></> : section === 'saved' ? <><div className="research-page-heading"><div><span className="eyebrow">YOUR SHORTLIST</span><h1>Saved creators<span>.</span></h1><p>Keep your next collaborations within reach.</p></div></div><section className="research-panel">{savedRows()}</section></> : <><div className="research-page-heading"><div><span className="eyebrow">YOUR RESEARCH WORKSPACE</span><h1>{title}</h1><p>{section === 'bots' ? 'Bring your research into your content workflow.' : 'Turn market signals into your next opportunity.'}</p></div></div><section className="research-panel"><Empty title={section === 'bots' ? 'No automation jobs yet' : section === 'content' ? 'Content insights are not available yet' : 'Product insights are not available yet'} text={section === 'bots' ? 'Automation jobs will appear here when a bot is connected.' : 'Verified market data is required before results can be displayed.'} icon={section === 'bots' ? Bot : section === 'content' ? Video : Package}/></section></>}<footer className="research-footer"><span>launchly <span>/</span> Built for your next move.</span><span>Real insights. No invented numbers.</span></footer></main></div></div>;
}
