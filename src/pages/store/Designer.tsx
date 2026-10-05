import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  Globe,
  GripVertical,
  Link2,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type {
  DesignerState,
  LinkItem,
  Product,
  SectionKind,
  SocialItem,
  SocialNetwork,
} from './store';
import { GRADIENTS, SOLID_COLORS, newId, storeShareUrl } from './store';
import { PhonePreview } from './PhonePreview';

type Selection =
  | { area: 'sections' }
  | { area: 'add' }
  | { area: 'background' }
  | { area: 'buttons' }
  | { area: 'section'; sectionId: string }
  | { area: 'product'; productId: string }
  | { area: 'link'; linkId: string }
  | { area: 'social'; socialId: string };

const KIND_LABEL: Record<SectionKind, string> = {
  profile: 'Profile',
  featured: 'Featured',
  products: 'Products',
  links: 'Links',
  social: 'Social',
};

interface DesignerProps {
  designer: DesignerState;
  username: string;
  saveState: 'saved' | 'saving';
  publishedAt: string | null;
  onPatch: (patch: Partial<DesignerState>) => void;
  onPublish: () => void;
}

export function Designer({ designer, username, saveState, publishedAt, onPatch, onPublish }: DesignerProps) {
  const [selection, setSelection] = useState<Selection>({ area: 'sections' });
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  const selectedKey =
    selection.area === 'section'
      ? `section:${selection.sectionId}`
      : selection.area === 'product'
        ? `product:${selection.productId}`
        : selection.area === 'link'
          ? `link:${selection.linkId}`
          : null;

  const section =
    selection.area === 'section' ? designer.sections.find((s) => s.id === selection.sectionId) ?? null : null;
  const editingProduct =
    selection.area === 'product' ? designer.products.find((p) => p.id === selection.productId) ?? null : null;
  const editingLink =
    selection.area === 'link' ? designer.links.find((l) => l.id === selection.linkId) ?? null : null;
  const editingSocial =
    selection.area === 'social' ? designer.socials.find((s) => s.id === selection.socialId) ?? null : null;

  // If the selected item was deleted, fall back to the list.
  const active: Selection =
    (selection.area === 'section' && !section) ||
    (selection.area === 'product' && !editingProduct) ||
    (selection.area === 'link' && !editingLink) ||
    (selection.area === 'social' && !editingSocial)
      ? { area: 'sections' }
      : selection;

  function flash(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  }

  function pickKey(key: string) {
    const [kind, id] = key.split(':');
    if (kind === 'product') setSelection({ area: 'product', productId: id });
    else if (kind === 'link') setSelection({ area: 'link', linkId: id });
    else setSelection({ area: 'section', sectionId: id });
  }

  function moveSection(from: number, to: number) {
    if (from === to) return;
    const sections = [...designer.sections];
    const [moved] = sections.splice(from, 1);
    sections.splice(to, 0, moved);
    onPatch({ sections });
  }

  function addProduct() {
    const item: Product = { id: newId('product'), title: 'New product', description: '', price: '$9', image: '' };
    onPatch({ products: [...designer.products, item] });
    setSelection({ area: 'product', productId: item.id });
  }

  function addLink() {
    const item: LinkItem = { id: newId('link'), label: 'New link', url: 'https://' };
    onPatch({ links: [...designer.links, item] });
    setSelection({ area: 'link', linkId: item.id });
  }

  function addSocial(network: SocialNetwork = 'instagram') {
    const item: SocialItem = { id: newId('social'), network, url: '' };
    onPatch({ socials: [...designer.socials, item] });
    setSelection({ area: 'social', socialId: item.id });
  }

  function addSection(kind: SectionKind) {
    const item = { id: newId('section'), kind, title: KIND_LABEL[kind] };
    onPatch({ sections: [...designer.sections, item] });
    setSelection({ area: 'section', sectionId: item.id });
  }

  function deleteSection(id: string) {
    onPatch({ sections: designer.sections.filter((s) => s.id !== id) });
    setSelection({ area: 'sections' });
  }

  function patchProduct(id: string, patch: Partial<Product>) {
    onPatch({ products: designer.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }

  function patchLink(id: string, patch: Partial<LinkItem>) {
    onPatch({ links: designer.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }

  function patchSocial(id: string, patch: Partial<SocialItem>) {
    onPatch({ socials: designer.socials.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  function patchTheme(patch: Partial<DesignerState['theme']>) {
    onPatch({ theme: { ...designer.theme, ...patch } });
  }

  async function share() {
    const url = storeShareUrl(username);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    flash('Store link copied — paste it in your TikTok bio');
  }

  function publish() {
    onPublish();
    setPublished(true);
    window.setTimeout(() => setPublished(false), 2400);
    flash('Published ✓ — your store is live');
  }

  const t = designer.theme;

  return (
    <div className="cs-designer">
      {/* Top-right save cluster */}
      <div className="cs-savebar">
        <span className={`cs-savestate cs-savestate--${saveState}`} role="status">
          <i aria-hidden="true" />
          {saveState === 'saved' ? 'Saved ✓' : 'Saving…'}
        </span>
        <button type="button" className="cs-toolbtn" onClick={() => setPreviewOpen(true)}>
          <Eye size={14} /> Preview
        </button>
        <button type="button" className="cs-toolbtn" onClick={share}>
          <Share2 size={14} /> Share
        </button>
        <button type="button" className="cs-toolbtn cs-toolbtn--primary" onClick={publish}>
          <Globe size={14} /> {published || publishedAt ? 'Published ✓' : 'Publish'}
        </button>
      </div>

      {/* Left floating controls */}
      <div className="cs-controls">
        {active.area === 'sections' && (
          <div className="cs-card cs-card--enter" key="sections">
            <p className="cs-card__eyebrow">Page sections</p>
            <p className="cs-card__hint">Drag to reorder. Click a product or link in the preview to edit it.</p>
            <ul className="cs-seclist">
              {designer.sections.map((s, i) => (
                <li
                  key={s.id}
                  draggable
                  onDragStart={() => {
                    dragIndex.current = i;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex.current != null) moveSection(dragIndex.current, i);
                    dragIndex.current = null;
                  }}
                  onClick={() => setSelection({ area: 'section', sectionId: s.id })}
                  className={selectedKey === `section:${s.id}` ? 'is-selected' : ''}
                >
                  <GripVertical size={14} aria-hidden="true" />
                  <span>{s.title || KIND_LABEL[s.kind]}</span>
                  <em>{KIND_LABEL[s.kind]}</em>
                </li>
              ))}
            </ul>
            <div className="cs-card__row">
              <button type="button" className="cs-chipbtn" onClick={() => setSelection({ area: 'background' })}>
                Background
              </button>
              <button type="button" className="cs-chipbtn" onClick={() => setSelection({ area: 'buttons' })}>
                Buttons & text
              </button>
            </div>
            <div className="cs-addrow">
              <button type="button" className="cs-addbtn" onClick={addProduct}>
                <Plus size={14} /> Product
              </button>
              <button type="button" className="cs-addbtn" onClick={addLink}>
                <Plus size={14} /> Link
              </button>
              <button type="button" className="cs-addbtn" onClick={() => setSelection({ area: 'add' })}>
                <Plus size={14} /> Section
              </button>
            </div>
          </div>
        )}

        {active.area === 'add' && (
          <div className="cs-card cs-card--enter" key="add">
            <BackButton onClick={() => setSelection({ area: 'sections' })} />
            <p className="cs-card__eyebrow">Add a section</p>
            <div className="cs-kindgrid">
              {(['featured', 'products', 'links', 'social'] as SectionKind[]).map((kind) => (
                <button key={kind} type="button" className="cs-kindbtn" onClick={() => addSection(kind)}>
                  <Plus size={14} /> {KIND_LABEL[kind]}
                </button>
              ))}
            </div>
          </div>
        )}

        {active.area === 'section' && section && (
          <div className="cs-card cs-card--enter" key={section.id}>
            <BackButton onClick={() => setSelection({ area: 'sections' })} />
            <p className="cs-card__eyebrow">{KIND_LABEL[section.kind]} section</p>
            <label className="cs-label">
              Section title
              <input
                value={section.title}
                maxLength={30}
                onChange={(e) =>
                  onPatch({ sections: designer.sections.map((s) => (s.id === section.id ? { ...s, title: e.target.value } : s)) })
                }
              />
            </label>

            {section.kind === 'profile' && (
              <>
                <label className="cs-label">
                  Profile photo URL
                  <input
                    value={designer.avatar}
                    placeholder="https://…"
                    inputMode="url"
                    onChange={(e) => onPatch({ avatar: e.target.value })}
                  />
                </label>
                <label className="cs-label">
                  Display name
                  <input value={designer.displayName} maxLength={40} onChange={(e) => onPatch({ displayName: e.target.value })} />
                </label>
                <label className="cs-label">
                  Bio
                  <textarea value={designer.bio} rows={3} maxLength={140} onChange={(e) => onPatch({ bio: e.target.value })} />
                </label>
              </>
            )}

            {section.kind === 'featured' && (
              <div className="cs-label">
                <span>Featured product</span>
                <div className="cs-picklist">
                  {designer.products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={designer.featuredProductId === p.id ? 'is-on' : ''}
                      onClick={() => onPatch({ featuredProductId: p.id })}
                    >
                      {p.title} · {p.price}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {section.kind === 'products' && (
              <div className="cs-label">
                <span>Products</span>
                <div className="cs-picklist">
                  {designer.products.map((p) => (
                    <button key={p.id} type="button" onClick={() => setSelection({ area: 'product', productId: p.id })}>
                      {p.title} · {p.price}
                    </button>
                  ))}
                  <button type="button" className="cs-picklist__add" onClick={addProduct}>
                    <Plus size={13} /> Add product
                  </button>
                </div>
              </div>
            )}

            {section.kind === 'links' && (
              <div className="cs-label">
                <span>Links</span>
                <div className="cs-picklist">
                  {designer.links.map((l) => (
                    <button key={l.id} type="button" onClick={() => setSelection({ area: 'link', linkId: l.id })}>
                      {l.label}
                    </button>
                  ))}
                  <button type="button" className="cs-picklist__add" onClick={addLink}>
                    <Plus size={13} /> Add link
                  </button>
                </div>
              </div>
            )}

            {section.kind === 'social' && (
              <div className="cs-label">
                <span>Social links</span>
                <div className="cs-picklist">
                  {designer.socials.map((s) => (
                    <button key={s.id} type="button" onClick={() => setSelection({ area: 'social', socialId: s.id })}>
                      {s.network}
                      {s.url ? '' : ' — no URL yet'}
                    </button>
                  ))}
                  <button type="button" className="cs-picklist__add" onClick={() => addSocial()}>
                    <Plus size={13} /> Add social
                  </button>
                </div>
              </div>
            )}

            {section.kind !== 'profile' && (
              <button type="button" className="cs-danger" onClick={() => deleteSection(section.id)}>
                <Trash2 size={13} /> Remove section
              </button>
            )}
          </div>
        )}

        {active.area === 'product' && editingProduct && (
          <div className="cs-card cs-card--enter" key={editingProduct.id}>
            <BackButton onClick={() => setSelection({ area: 'sections' })} />
            <p className="cs-card__eyebrow">Edit product</p>
            <label className="cs-label">
              Product image URL
              <input
                value={editingProduct.image}
                placeholder="https://…"
                inputMode="url"
                onChange={(e) => patchProduct(editingProduct.id, { image: e.target.value })}
              />
            </label>
            <label className="cs-label">
              Title
              <input
                value={editingProduct.title}
                maxLength={50}
                onChange={(e) => patchProduct(editingProduct.id, { title: e.target.value })}
              />
            </label>
            <label className="cs-label">
              Description
              <textarea
                value={editingProduct.description}
                rows={2}
                maxLength={120}
                onChange={(e) => patchProduct(editingProduct.id, { description: e.target.value })}
              />
            </label>
            <label className="cs-label">
              Price
              <input
                value={editingProduct.price}
                maxLength={12}
                onChange={(e) => patchProduct(editingProduct.id, { price: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="cs-danger"
              onClick={() => {
                onPatch({ products: designer.products.filter((p) => p.id !== editingProduct.id) });
                setSelection({ area: 'sections' });
              }}
            >
              <Trash2 size={13} /> Delete product
            </button>
          </div>
        )}

        {active.area === 'link' && editingLink && (
          <div className="cs-card cs-card--enter" key={editingLink.id}>
            <BackButton onClick={() => setSelection({ area: 'sections' })} />
            <p className="cs-card__eyebrow">Edit link</p>
            <label className="cs-label">
              Label
              <input
                value={editingLink.label}
                maxLength={40}
                onChange={(e) => patchLink(editingLink.id, { label: e.target.value })}
              />
            </label>
            <label className="cs-label">
              URL
              <input
                value={editingLink.url}
                inputMode="url"
                onChange={(e) => patchLink(editingLink.id, { url: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="cs-danger"
              onClick={() => {
                onPatch({ links: designer.links.filter((l) => l.id !== editingLink.id) });
                setSelection({ area: 'sections' });
              }}
            >
              <Trash2 size={13} /> Delete link
            </button>
          </div>
        )}

        {active.area === 'social' && editingSocial && (
          <div className="cs-card cs-card--enter" key={editingSocial.id}>
            <BackButton onClick={() => setSelection({ area: 'sections' })} />
            <p className="cs-card__eyebrow">Edit social link</p>
            <label className="cs-label">
              Network
              <select
                value={editingSocial.network}
                onChange={(e) => patchSocial(editingSocial.id, { network: e.target.value as SocialNetwork })}
              >
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="x">X</option>
              </select>
            </label>
            <label className="cs-label">
              Profile URL
              <input
                value={editingSocial.url}
                placeholder="https://…"
                inputMode="url"
                onChange={(e) => patchSocial(editingSocial.id, { url: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="cs-danger"
              onClick={() => {
                onPatch({ socials: designer.socials.filter((s) => s.id !== editingSocial.id) });
                setSelection({ area: 'sections' });
              }}
            >
              <Trash2 size={13} /> Delete social
            </button>
          </div>
        )}

        {active.area === 'background' && (
          <div className="cs-card cs-card--enter" key="background">
            <BackButton onClick={() => setSelection({ area: 'sections' })} />
            <p className="cs-card__eyebrow">Background</p>
            <div className="cs-seg" role="group" aria-label="Background type">
              {(['color', 'gradient', 'image'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={t.bgMode === m ? 'is-on' : ''}
                  onClick={() => patchTheme({ bgMode: m })}
                >
                  {m === 'color' ? 'Solid' : m === 'gradient' ? 'Gradient' : 'Image'}
                </button>
              ))}
            </div>

            {t.bgMode === 'color' && (
              <div className="cs-swatches">
                {SOLID_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Background ${c}`}
                    className={t.bgColor === c ? 'is-on' : ''}
                    style={{ background: c }}
                    onClick={() => patchTheme({ bgColor: c })}
                  />
                ))}
                <input aria-label="Custom background colour" type="color" value={t.bgColor} onChange={(e) => patchTheme({ bgColor: e.target.value })} />
              </div>
            )}

            {t.bgMode === 'gradient' && (
              <div className="cs-gradients">
                {GRADIENTS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-label="Gradient preset"
                    className={t.gradient === g ? 'is-on' : ''}
                    style={{ background: g }}
                    onClick={() => patchTheme({ gradient: g })}
                  />
                ))}
              </div>
            )}

            {t.bgMode === 'image' && (
              <>
                <label className="cs-label">
                  Image URL
                  <input
                    value={t.bgImage}
                    placeholder="https://…"
                    inputMode="url"
                    onChange={(e) => patchTheme({ bgImage: e.target.value })}
                  />
                </label>
                <div className="cs-grid2">
                  <label className="cs-label">
                    Fit
                    <select value={t.bgSize} onChange={(e) => patchTheme({ bgSize: e.target.value as 'cover' | 'contain' })}>
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                    </select>
                  </label>
                  <label className="cs-label">
                    Position
                    <select value={t.bgPosition} onChange={(e) => patchTheme({ bgPosition: e.target.value })}>
                      <option value="center">Center</option>
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </label>
                </div>
                <Toggle label="Blurred background" on={t.bgBlur} onChange={(v) => patchTheme({ bgBlur: v })} />
              </>
            )}

            <Toggle label="Glass cards" on={t.bgGlass} onChange={(v) => patchTheme({ bgGlass: v })} />
            <Toggle label="Animated gradient" on={t.bgAnimated} onChange={(v) => patchTheme({ bgAnimated: v })} />
          </div>
        )}

        {active.area === 'buttons' && (
          <div className="cs-card cs-card--enter" key="buttons">
            <BackButton onClick={() => setSelection({ area: 'sections' })} />
            <p className="cs-card__eyebrow">Buttons & text</p>
            <div className="cs-seg" role="group" aria-label="Button style">
              {(['filled', 'soft', 'outline'] as const).map((s) => (
                <button key={s} type="button" className={t.buttonStyle === s ? 'is-on' : ''} onClick={() => patchTheme({ buttonStyle: s })}>
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <label className="cs-label">
              Corner radius · {t.buttonRadius}px
              <input
                type="range"
                min={4}
                max={28}
                value={t.buttonRadius}
                onChange={(e) => patchTheme({ buttonRadius: Number(e.target.value) })}
              />
            </label>
            <div className="cs-grid2">
              <label className="cs-label">
                Font
                <select value={t.font} onChange={(e) => patchTheme({ font: e.target.value as DesignerState['theme']['font'] })}>
                  <option value="modern">Modern</option>
                  <option value="serif">Editorial</option>
                  <option value="rounded">Rounded</option>
                </select>
              </label>
              <label className="cs-label cs-label--color">
                Text colour
                <input type="color" value={t.textColor} onChange={(e) => patchTheme({ textColor: e.target.value })} />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Right phone preview */}
      <div className="cs-preview">
        <PhonePreview
          designer={designer}
          username={username}
          selectedKey={selectedKey}
          hoverKey={hoverKey}
          onHover={setHoverKey}
          onPick={pickKey}
        />
        <p className="cs-preview__cap">
          <Link2 size={12} /> Live preview · {storeShareUrl(username)}
        </p>
      </div>

      {previewOpen && (
        <div className="cs-modal" role="dialog" aria-label="Store preview" onClick={() => setPreviewOpen(false)}>
          <div className="cs-modal__inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cs-modal__close" aria-label="Close preview" onClick={() => setPreviewOpen(false)}>
              <X size={16} />
            </button>
            <PhonePreview designer={designer} username={username} selectedKey={null} hoverKey={null} interactive={false} />
          </div>
        </div>
      )}

      {toast && (
        <p className="cs-toast" role="status">
          <Check size={14} /> {toast}
        </p>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="cs-back" onClick={onClick}>
      <ArrowLeft size={14} /> Back
    </button>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`cs-toggle${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="cs-toggle__track" aria-hidden="true">
        <i />
      </span>
      {label}
    </button>
  );
}
