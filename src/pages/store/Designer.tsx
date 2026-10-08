import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  Globe,
  GripVertical,
  Link2,
  LogOut,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Block,
  BlockType,
  DesignerState,
  LinkItem,
  Product,
  SocialItem,
  SocialNetwork,
  TiktokVideo,
} from './store';
import { GRADIENTS, SOLID_COLORS, THEME_PRESETS, blankBlock, newId, storeShareUrl } from './store';
import { PhonePreview } from './PhonePreview';

type GroupId = 'page' | 'design' | 'content' | 'products';

const BLOCK_LABEL: Record<BlockType, string> = {
  profile: 'Profile',
  products: 'Products',
  links: 'Links',
  social: 'Social',
  tiktok: 'TikTok videos',
  video: 'Video',
  image: 'Image',
  text: 'Text',
  newsletter: 'Newsletter',
};

interface DesignerProps {
  designer: DesignerState;
  username: string;
  saveState: 'saved' | 'saving';
  publishedAt: string | null;
  onPatch: (patch: Partial<DesignerState>) => void;
  onPublish: () => void;
  onDisconnect: () => void;
}

export function Designer({ designer, username, saveState, publishedAt, onPatch, onPublish, onDisconnect }: DesignerProps) {
  const [open, setOpen] = useState<Record<GroupId, boolean>>({ page: true, design: false, content: true, products: false });
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  // Focus mode: clicking the preview shows ONE editing box instead of the full panel.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  const t = designer.theme;
  const handle = (designer.username || username).replace(/^@+/, '');

  function toggleGroup(g: GroupId) {
    setOpen((o) => ({ page: false, design: false, content: false, products: false, [g]: !o[g] }));
  }

  function flash(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  }

  function scrollToEdit(id: string) {
    window.setTimeout(() => {
      document.getElementById(`cs-edit-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }

  /** Clicking the preview opens ONE focused editing box on the left. */
  function pick(key: string) {
    const [kind, id] = key.split(':');
    const exists =
      kind === 'product'
        ? designer.blocks.some((b) => (b.products ?? []).some((p) => p.id === id))
        : kind === 'link'
          ? designer.blocks.some((b) => (b.links ?? []).some((l) => l.id === id))
          : kind === 'tiktok'
            ? designer.blocks.some((b) => (b.videos ?? []).some((v) => v.id === id))
            : designer.blocks.some((b) => b.id === id);
    if (!exists) return;
    setSelectedKey(key);
    setFocusKey(key);
  }

  function exitFocus() {
    setFocusKey(null);
  }

  function openProductEditor(blockId: string, productId: string) {
    setFocusKey(null);
    setOpen({ page: false, design: false, content: false, products: true });
    setExpandedProductId(productId);
    scrollToEdit(productId);
  }

  function editInPage() {
    setFocusKey(null);
    setOpen({ page: true, design: false, content: false, products: false });
    scrollToEdit('page');
  }

  function patchBlock(id: string, patch: Partial<Block>) {
    onPatch({ blocks: designer.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  }

  function moveBlock(from: number, to: number) {
    if (from === to) return;
    const blocks = [...designer.blocks];
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    onPatch({ blocks });
  }

  function deleteBlock(id: string) {
    onPatch({ blocks: designer.blocks.filter((b) => b.id !== id) });
    if (expandedBlockId === id) setExpandedBlockId(null);
  }

  function productsBlock(): Block | undefined {
    return designer.blocks.find((b) => b.type === 'products');
  }

  function ensureProductsBlock(): Block {
    const existing = productsBlock();
    if (existing) return existing;
    const block = { ...blankBlock('products'), products: [] };
    onPatch({ blocks: [...designer.blocks, block] });
    return block;
  }

  function addProduct(toBlockId?: string) {
    const item: Product = { id: newId('product'), title: 'New product', description: '', price: '$9', image: '', link: '', cta: 'Get it' };
    const target = toBlockId
      ? designer.blocks.find((b) => b.id === toBlockId)
      : ensureProductsBlock();
    if (!target || target.type !== 'products') return;
    patchBlock(target.id, { products: [...(target.products ?? []), item] });
    setOpen((o) => ({ ...o, products: true }));
    setExpandedProductId(item.id);
    scrollToEdit(item.id);
  }

  function deleteProduct(blockId: string, productId: string) {
    const block = designer.blocks.find((b) => b.id === blockId);
    if (!block) return;
    patchBlock(blockId, { products: (block.products ?? []).filter((p) => p.id !== productId) });
    if (expandedProductId === productId) setExpandedProductId(null);
  }

  function patchProduct(blockId: string, productId: string, patch: Partial<Product>) {
    const block = designer.blocks.find((b) => b.id === blockId);
    if (!block) return;
    patchBlock(blockId, { products: (block.products ?? []).map((p) => (p.id === productId ? { ...p, ...patch } : p)) });
  }

  function linksBlock(): Block | undefined {
    return designer.blocks.find((b) => b.type === 'links');
  }

  function addLink() {
    const target = linksBlock() ?? { ...blankBlock('links'), links: [] };
    const item: LinkItem = { id: newId('link'), label: 'New link', url: 'https://' };
    if (!linksBlock()) onPatch({ blocks: [...designer.blocks, { ...target, links: [item] }] });
    else patchBlock(target.id, { links: [...(target.links ?? []), item] });
    setOpen((o) => ({ ...o, content: true }));
    setExpandedBlockId(target.id);
    setSelectedKey(`link:${item.id}`);
    scrollToEdit(item.id);
  }

  function addTiktok() {
    const existing = designer.blocks.find((b) => b.type === 'tiktok');
    const item: TiktokVideo = { id: newId('tiktok'), url: 'https://tiktok.com/@', thumb: '', views: '' };
    if (existing) {
      patchBlock(existing.id, { videos: [...(existing.videos ?? []), item] });
      setExpandedBlockId(existing.id);
    } else {
      const block = { ...blankBlock('tiktok'), videos: [item] };
      onPatch({ blocks: [...designer.blocks, block] });
      setExpandedBlockId(block.id);
    }
    setOpen((o) => ({ ...o, content: true }));
    setSelectedKey(`tiktok:${item.id}`);
    scrollToEdit(item.id);
  }

  function addBlock(type: BlockType) {
    const block = blankBlock(type);
    onPatch({ blocks: [...designer.blocks, block] });
    setOpen((o) => ({ ...o, content: true }));
    setExpandedBlockId(block.id);
    scrollToEdit(block.id);
  }

  function patchTheme(patch: Partial<DesignerState['theme']>) {
    onPatch({ theme: { ...designer.theme, ...patch } });
  }

  async function share() {
    const url = storeShareUrl(handle || username);
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

  /** Single focused editing box shown when picking from the preview. */
  function renderFocus(): React.ReactNode | null {
    if (!focusKey) return null;
    const [kind, id] = focusKey.split(':');
    const back = (
      <button type="button" className="cs-back" onClick={exitFocus}>
        <ArrowLeft size={14} /> All controls
      </button>
    );
    const wrap = (eyebrow: string, body: React.ReactNode) => (
      <div className="cs-controls">
        <div className="cs-card cs-focus">
          {back}
          <p className="cs-card__eyebrow">{eyebrow}</p>
          {body}
        </div>
      </div>
    );
    if (kind === 'product') {
      const block = designer.blocks.find((b) => (b.products ?? []).some((p) => p.id === id));
      const product = block?.products?.find((p) => p.id === id);
      if (!block || !product) return null;
      return wrap(
        'Edit product',
        <ProductFields
          product={product}
          onPatch={(patch) => patchProduct(block.id, product.id, patch)}
          onDelete={() => {
            deleteProduct(block.id, product.id);
            exitFocus();
          }}
        />
      );
    }
    if (kind === 'link') {
      const block = designer.blocks.find((b) => (b.links ?? []).some((l) => l.id === id));
      const link = block?.links?.find((l) => l.id === id);
      if (!block || !link) return null;
      return wrap(
        'Edit link',
        <LinkFields
          items={[link]}
          selectedKey={selectedKey}
          onAdd={addLink}
          onPatch={(lid, patch) => patchBlock(block.id, { links: (block.links ?? []).map((l) => (l.id === lid ? { ...l, ...patch } : l)) })}
          onDelete={(lid) => {
            patchBlock(block.id, { links: (block.links ?? []).filter((l) => l.id !== lid) });
            exitFocus();
          }}
        />
      );
    }
    if (kind === 'tiktok') {
      const block = designer.blocks.find((b) => (b.videos ?? []).some((v) => v.id === id));
      const video = block?.videos?.find((v) => v.id === id);
      if (!block || !video) return null;
      return wrap(
        'Edit TikTok video',
        <TiktokFields
          items={[video]}
          selectedKey={selectedKey}
          onAdd={addTiktok}
          onPatch={(vid, patch) => patchBlock(block.id, { videos: (block.videos ?? []).map((v) => (v.id === vid ? { ...v, ...patch } : v)) })}
          onDelete={(vid) => {
            patchBlock(block.id, { videos: (block.videos ?? []).filter((v) => v.id !== vid) });
            exitFocus();
          }}
        />
      );
    }
    const block = designer.blocks.find((b) => b.id === id);
    if (!block) return null;
    return wrap(
      `${BLOCK_LABEL[block.type]} block`,
      <BlockEditor
        block={block}
        selectedKey={selectedKey}
        onPatchBlock={(patch) => patchBlock(block.id, patch)}
        onAddProduct={() => addProduct(block.id)}
        onAddLink={addLink}
        onAddTiktok={addTiktok}
        onDeleteBlock={() => {
          deleteBlock(block.id);
          exitFocus();
        }}
        onOpenProduct={(productId) => openProductEditor(block.id, productId)}
        onEditInPage={editInPage}
      />
    );
  }

  const focusView = renderFocus();

  return (
    <div className="cs-builder">
      {/* Top bar */}
      <div className="cs-topbar">
        <strong>Creator Store</strong>
        <div className="cs-topbar__right">
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
      </div>

      <div className="cs-designer">
        {/* Left editor: one focused box, or the full panel */}
        {focusView ?? (<div className="cs-controls">
          <Group id="page" title="Page" open={open} onToggle={toggleGroup}>
            <div id="cs-edit-page">
              <label className="cs-label">
                Profile photo URL
                <input value={designer.avatar} placeholder="https://…" inputMode="url" onChange={(e) => onPatch({ avatar: e.target.value })} />
              </label>
              <div className="cs-grid2">
                <label className="cs-label">
                  Display name
                  <input value={designer.displayName} maxLength={40} onChange={(e) => onPatch({ displayName: e.target.value })} />
                </label>
                <label className="cs-label">
                  Username
                  <input
                    value={designer.username}
                    maxLength={24}
                    placeholder={username}
                    onChange={(e) => onPatch({ username: e.target.value.replace(/[^a-zA-Z0-9_.]/g, '') })}
                  />
                </label>
              </div>
              <label className="cs-label">
                Bio
                <textarea value={designer.bio} rows={3} maxLength={140} onChange={(e) => onPatch({ bio: e.target.value })} />
              </label>
              <SocialEditor designer={designer} onPatch={onPatch} />
              <button type="button" className="cs-danger" onClick={onDisconnect}>
                <LogOut size={13} /> Switch account
              </button>
            </div>
          </Group>

          <Group id="design" title="Design" open={open} onToggle={toggleGroup}>
            <div className="cs-label">
              <span>Theme presets</span>
              <div className="cs-picklist">
                {THEME_PRESETS.map((p) => (
                  <button key={p.name} type="button" onClick={() => patchTheme(p.theme)}>
                    {p.name} — {p.hint}
                  </button>
                ))}
              </div>
            </div>
            <div className="cs-seg" role="group" aria-label="Background type">
              {(['color', 'gradient', 'image'] as const).map((m) => (
                <button key={m} type="button" className={t.bgMode === m ? 'is-on' : ''} onClick={() => patchTheme({ bgMode: m })}>
                  {m === 'color' ? 'Colour' : m === 'gradient' ? 'Gradient' : 'Image'}
                </button>
              ))}
            </div>
            {t.bgMode === 'color' && (
              <div className="cs-swatches">
                {SOLID_COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Background ${c}`} className={t.bgColor === c ? 'is-on' : ''} style={{ background: c }} onClick={() => patchTheme({ bgColor: c })} />
                ))}
                <input aria-label="Custom background colour" type="color" value={t.bgColor} onChange={(e) => patchTheme({ bgColor: e.target.value })} />
              </div>
            )}
            {t.bgMode === 'gradient' && (
              <div className="cs-gradients">
                {GRADIENTS.map((g) => (
                  <button key={g} type="button" aria-label="Gradient preset" className={t.gradient === g ? 'is-on' : ''} style={{ background: g }} onClick={() => patchTheme({ gradient: g })} />
                ))}
              </div>
            )}
            {t.bgMode === 'image' && (
              <>
                <label className="cs-label">
                  Background image URL
                  <input value={t.bgImage} placeholder="https://…" inputMode="url" onChange={(e) => patchTheme({ bgImage: e.target.value })} />
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
            <div className="cs-seg" role="group" aria-label="Button style">
              {(['filled', 'soft', 'outline'] as const).map((s) => (
                <button key={s} type="button" className={t.buttonStyle === s ? 'is-on' : ''} onClick={() => patchTheme({ buttonStyle: s })}>
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
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
            <div className="cs-grid2">
              <label className="cs-label cs-label--color">
                Button colour
                <input type="color" value={t.buttonColor} onChange={(e) => patchTheme({ buttonColor: e.target.value })} />
              </label>
              <label className="cs-label">
                Border radius · {t.buttonRadius}px
                <input type="range" min={4} max={28} value={t.buttonRadius} onChange={(e) => patchTheme({ buttonRadius: Number(e.target.value) })} />
              </label>
            </div>
          </Group>

          <Group id="content" title="Content" open={open} onToggle={toggleGroup}>
            <div className="cs-addgrid">
              <button type="button" className="cs-addbtn" onClick={() => addProduct()}><Plus size={14} /> Product</button>
              <button type="button" className="cs-addbtn" onClick={addLink}><Plus size={14} /> Link</button>
              <button type="button" className="cs-addbtn" onClick={addTiktok}><Plus size={14} /> TikTok</button>
              <button type="button" className="cs-addbtn" onClick={() => addBlock('video')}><Plus size={14} /> Video</button>
              <button type="button" className="cs-addbtn" onClick={() => addBlock('image')}><Plus size={14} /> Image</button>
              <button type="button" className="cs-addbtn" onClick={() => addBlock('text')}><Plus size={14} /> Text</button>
              <button type="button" className="cs-addbtn" onClick={() => addBlock('text')}><Plus size={14} /> Section</button>
            </div>
            <p className="cs-card__hint">Drag blocks to reorder. Click anything in the preview to edit it here.</p>
            <ul className="cs-seclist">
              {designer.blocks.map((b, i) => (
                <li
                  key={b.id}
                  draggable
                  onDragStart={() => { dragIndex.current = i; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIndex.current != null) moveBlock(dragIndex.current, i); dragIndex.current = null; }}
                  className={expandedBlockId === b.id ? 'is-expanded' : ''}
                >
                  <div className="cs-blockrow" id={`cs-edit-${b.id}`}>
                    <GripVertical size={14} aria-hidden="true" />
                    <button type="button" className="cs-blockrow__title" onClick={() => setExpandedBlockId(expandedBlockId === b.id ? null : b.id)}>
                      {b.type === 'text' ? b.heading || b.title || 'Text' : b.title || BLOCK_LABEL[b.type]}
                    </button>
                    <em>{BLOCK_LABEL[b.type]}</em>
                    {b.type !== 'profile' && (
                      <button type="button" className="cs-mini" aria-label={`Remove ${BLOCK_LABEL[b.type]} block`} onClick={() => deleteBlock(b.id)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  {expandedBlockId === b.id && (
                    <div className="cs-blockedit">
                      <BlockEditor
                        block={b}
                        selectedKey={selectedKey}
                        onPatchBlock={(patch) => patchBlock(b.id, patch)}
                        onAddProduct={() => addProduct(b.id)}
                        onAddLink={addLink}
                        onAddTiktok={addTiktok}
                        onDeleteBlock={() => deleteBlock(b.id)}
                        onOpenProduct={(productId) => openProductEditor(b.id, productId)}
                        onEditInPage={editInPage}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Group>

          <Group id="products" title="Products" open={open} onToggle={toggleGroup}>
            {designer.blocks.filter((b) => b.type === 'products').every((b) => (b.products ?? []).length === 0) && (
              <p className="cs-card__hint">No products yet — add your first one.</p>
            )}
            {designer.blocks
              .filter((b) => b.type === 'products')
              .flatMap((b) => (b.products ?? []).map((p) => ({ block: b, product: p })))
              .map(({ block, product: p }) => (
                <div key={p.id} id={`cs-edit-${p.id}`} className={`cs-productedit${expandedProductId === p.id ? ' is-open' : ''}`}>
                  <button type="button" className="cs-productedit__head" onClick={() => setExpandedProductId(expandedProductId === p.id ? null : p.id)}>
                    <span>{p.title || 'Untitled product'}</span>
                    <em>{p.price}</em>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {expandedProductId === p.id && (
                    <ProductFields
                      product={p}
                      onPatch={(patch) => patchProduct(block.id, p.id, patch)}
                      onDelete={() => deleteProduct(block.id, p.id)}
                    />
                  )}
                </div>
              ))}
            <button type="button" className="cs-addbtn" onClick={() => addProduct()}><Plus size={14} /> Product</button>
          </Group>
        </div>)}

        {/* Right live preview */}
        <div className="cs-preview">
          <PhonePreview
            designer={designer}
            username={handle || username}
            selectedKey={selectedKey}
            hoverKey={hoverKey}
            onHover={setHoverKey}
            onPick={pick}
            onClear={() => setSelectedKey(null)}
          />
          <p className="cs-preview__cap">
            <Link2 size={12} /> Live preview · {storeShareUrl(handle || username)}
          </p>
        </div>

        {previewOpen && (
          <div className="cs-modal" role="dialog" aria-label="Store preview" onClick={() => setPreviewOpen(false)}>
            <div className="cs-modal__inner" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="cs-modal__close" aria-label="Close preview" onClick={() => setPreviewOpen(false)}>
                <X size={16} />
              </button>
              <PhonePreview designer={designer} username={handle || username} selectedKey={null} hoverKey={null} interactive={false} />
            </div>
          </div>
        )}

        {toast && (
          <p className="cs-toast" role="status">
            <Check size={14} /> {toast}
          </p>
        )}
      </div>
    </div>
  );
}

function BlockEditor({
  block: b,
  selectedKey,
  onPatchBlock,
  onAddProduct,
  onAddLink,
  onAddTiktok,
  onDeleteBlock,
  onOpenProduct,
  onEditInPage,
}: {
  block: Block;
  selectedKey: string | null;
  onPatchBlock: (patch: Partial<Block>) => void;
  onAddProduct: () => void;
  onAddLink: () => void;
  onAddTiktok: () => void;
  onDeleteBlock: () => void;
  onOpenProduct: (productId: string) => void;
  onEditInPage: () => void;
}) {
  return (
    <>
      {b.type !== 'profile' && (
        <label className="cs-label">
          Block title
          <input value={b.title} maxLength={30} onChange={(e) => onPatchBlock({ title: e.target.value })} />
        </label>
      )}
      {b.type === 'profile' && (
        <button type="button" className="cs-chipbtn" onClick={onEditInPage}>
          Edit profile in Page
        </button>
      )}
      {b.type === 'products' && (
        <>
          {(b.products ?? []).length > 0 && (
            <div className="cs-picklist">
              {(b.products ?? []).map((p) => (
                <button key={p.id} type="button" onClick={() => onOpenProduct(p.id)}>
                  {p.title} · {p.price}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="cs-addbtn" onClick={onAddProduct}><Plus size={13} /> Add product here</button>
        </>
      )}
      {b.type === 'links' && (
        <LinkFields
          items={b.links ?? []}
          selectedKey={selectedKey}
          onAdd={onAddLink}
          onPatch={(id, patch) => onPatchBlock({ links: (b.links ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)) })}
          onDelete={(id) => onPatchBlock({ links: (b.links ?? []).filter((l) => l.id !== id) })}
        />
      )}
      {b.type === 'tiktok' && (
        <TiktokFields
          items={b.videos ?? []}
          selectedKey={selectedKey}
          onAdd={onAddTiktok}
          onPatch={(id, patch) => onPatchBlock({ videos: (b.videos ?? []).map((v) => (v.id === id ? { ...v, ...patch } : v)) })}
          onDelete={(id) => onPatchBlock({ videos: (b.videos ?? []).filter((v) => v.id !== id) })}
        />
      )}
      {b.type === 'video' && (
        <>
          <label className="cs-label">Video URL<input value={b.url ?? ''} placeholder="https://…" inputMode="url" onChange={(e) => onPatchBlock({ url: e.target.value })} /></label>
          <label className="cs-label">Thumbnail URL<input value={b.image ?? ''} placeholder="https://…" inputMode="url" onChange={(e) => onPatchBlock({ image: e.target.value })} /></label>
          <label className="cs-label">Caption<input value={b.caption ?? ''} maxLength={80} onChange={(e) => onPatchBlock({ caption: e.target.value })} /></label>
        </>
      )}
      {b.type === 'image' && (
        <>
          <label className="cs-label">Image URL<input value={b.image ?? ''} placeholder="https://…" inputMode="url" onChange={(e) => onPatchBlock({ image: e.target.value })} /></label>
          <label className="cs-label">Caption<input value={b.caption ?? ''} maxLength={80} onChange={(e) => onPatchBlock({ caption: e.target.value })} /></label>
          <label className="cs-label">Link URL (optional)<input value={b.url ?? ''} placeholder="https://…" inputMode="url" onChange={(e) => onPatchBlock({ url: e.target.value })} /></label>
        </>
      )}
      {b.type === 'text' && (
        <>
          <label className="cs-label">Heading<input value={b.heading ?? ''} maxLength={60} onChange={(e) => onPatchBlock({ heading: e.target.value })} /></label>
          <label className="cs-label">Body<textarea value={b.body ?? ''} rows={3} maxLength={280} onChange={(e) => onPatchBlock({ body: e.target.value })} /></label>
        </>
      )}
      {b.type === 'newsletter' && (
        <>
          <label className="cs-label">Heading<input value={b.heading ?? ''} maxLength={60} onChange={(e) => onPatchBlock({ heading: e.target.value })} /></label>
          <label className="cs-label">Subtext<textarea value={b.subtext ?? ''} rows={2} maxLength={140} onChange={(e) => onPatchBlock({ subtext: e.target.value })} /></label>
          <div className="cs-grid2">
            <label className="cs-label">Button label<input value={b.buttonLabel ?? ''} maxLength={20} onChange={(e) => onPatchBlock({ buttonLabel: e.target.value })} /></label>
            <label className="cs-label">Placeholder<input value={b.placeholder ?? ''} maxLength={30} onChange={(e) => onPatchBlock({ placeholder: e.target.value })} /></label>
          </div>
        </>
      )}
      {b.type !== 'profile' && (
        <button type="button" className="cs-danger" onClick={onDeleteBlock}><Trash2 size={13} /> Remove section</button>
      )}
    </>
  );
}

function Group({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: GroupId;
  title: string;
  open: Record<GroupId, boolean>;
  onToggle: (g: GroupId) => void;
  children: React.ReactNode;
}) {
  const isOpen = open[id];
  return (
    <div className="cs-card">
      <button type="button" className="cs-acc__head" aria-expanded={isOpen} onClick={() => onToggle(id)}>
        <span>{title}</span>
        <ChevronDown size={15} aria-hidden="true" className={isOpen ? 'is-open' : ''} />
      </button>
      {isOpen && <div className="cs-acc__body">{children}</div>}
    </div>
  );
}

function SocialEditor({ designer, onPatch }: { designer: DesignerState; onPatch: (p: Partial<DesignerState>) => void }) {
  const socialsByBlock = designer.blocks.filter((b) => b.type === 'social');
  const target = socialsByBlock[0];
  function ensure(): Block | undefined {
    if (target) return target;
    const block = { ...blankBlock('social'), socials: [] };
    onPatch({ blocks: [...designer.blocks, block] });
    return { ...block };
  }
  function update(fn: (items: SocialItem[]) => SocialItem[]) {
    const t = ensure();
    if (!t) return;
    onPatch({ blocks: designer.blocks.map((b) => (b.id === t.id ? { ...b, socials: fn(b.socials ?? []) } : b)) });
  }
  const items = target?.socials ?? [];
  return (
    <div className="cs-label">
      <span>Social links</span>
      <div className="cs-itemrows">
        {items.map((s) => (
          <div key={s.id} className="cs-itemrow">
            <select aria-label="Network" value={s.network} onChange={(e) => update((list) => list.map((x) => (x.id === s.id ? { ...x, network: e.target.value as SocialNetwork } : x)))}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="x">X</option>
            </select>
            <input aria-label="Social URL" value={s.url} placeholder="https://…" inputMode="url" onChange={(e) => update((list) => list.map((x) => (x.id === s.id ? { ...x, url: e.target.value } : x)))} />
            <button type="button" className="cs-mini" aria-label="Delete social link" onClick={() => update((list) => list.filter((x) => x.id !== s.id))}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="cs-addbtn"
          onClick={() => update((list) => [...list, { id: newId('social'), network: 'instagram' as SocialNetwork, url: '' }])}
        >
          <Plus size={13} /> Add social
        </button>
      </div>
    </div>
  );
}

function ProductFields({
  product: p,
  onPatch,
  onDelete,
}: {
  product: Product;
  onPatch: (patch: Partial<Product>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="cs-subform">
      <label className="cs-label">Product image URL<input value={p.image} placeholder="https://…" inputMode="url" onChange={(e) => onPatch({ image: e.target.value })} /></label>
      <label className="cs-label">Product name<input value={p.title} maxLength={50} onChange={(e) => onPatch({ title: e.target.value })} /></label>
      <div className="cs-grid2">
        <label className="cs-label">Price<input value={p.price} maxLength={12} onChange={(e) => onPatch({ price: e.target.value })} /></label>
        <label className="cs-label">CTA button<input value={p.cta} maxLength={16} placeholder="Get it" onChange={(e) => onPatch({ cta: e.target.value })} /></label>
      </div>
      <label className="cs-label">Description<textarea value={p.description} rows={2} maxLength={120} onChange={(e) => onPatch({ description: e.target.value })} /></label>
      <label className="cs-label">Product link<input value={p.link} placeholder="https://…" inputMode="url" onChange={(e) => onPatch({ link: e.target.value })} /></label>
      <button type="button" className="cs-danger" onClick={onDelete}><Trash2 size={13} /> Delete product</button>
    </div>
  );
}

function LinkFields({
  items,
  selectedKey,
  onAdd,
  onPatch,
  onDelete,
}: {
  items: LinkItem[];
  selectedKey: string | null;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<LinkItem>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="cs-itemrows">
      {items.map((l) => (
        <div key={l.id} id={`cs-edit-${l.id}`} className={`cs-itemcard${selectedKey === `link:${l.id}` ? ' is-selected' : ''}`}>
          <label className="cs-label">Label<input value={l.label} maxLength={40} onChange={(e) => onPatch(l.id, { label: e.target.value })} /></label>
          <label className="cs-label">URL<input value={l.url} inputMode="url" onChange={(e) => onPatch(l.id, { url: e.target.value })} /></label>
          <button type="button" className="cs-danger" onClick={() => onDelete(l.id)}><Trash2 size={13} /> Delete link</button>
        </div>
      ))}
      <button type="button" className="cs-addbtn" onClick={onAdd}><Plus size={13} /> Add link</button>
    </div>
  );
}

function TiktokFields({
  items,
  selectedKey,
  onAdd,
  onPatch,
  onDelete,
}: {
  items: TiktokVideo[];
  selectedKey: string | null;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<TiktokVideo>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="cs-itemrows">
      {items.map((v, i) => (
        <div key={v.id} id={`cs-edit-${v.id}`} className={`cs-itemcard${selectedKey === `tiktok:${v.id}` ? ' is-selected' : ''}`}>
          <p className="cs-card__eyebrow">Video {i + 1}</p>
          <label className="cs-label">TikTok URL<input value={v.url} placeholder="https://tiktok.com/@…/video/…" inputMode="url" onChange={(e) => onPatch(v.id, { url: e.target.value })} /></label>
          <label className="cs-label">Thumbnail URL<input value={v.thumb} placeholder="https://…" inputMode="url" onChange={(e) => onPatch(v.id, { thumb: e.target.value })} /></label>
          <label className="cs-label">Views label<input value={v.views} maxLength={12} placeholder="12.4K" onChange={(e) => onPatch(v.id, { views: e.target.value })} /></label>
          <button type="button" className="cs-danger" onClick={() => onDelete(v.id)}><Trash2 size={13} /> Delete video</button>
        </div>
      ))}
      <button type="button" className="cs-addbtn" onClick={onAdd}><Plus size={13} /> Add TikTok</button>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`cs-toggle${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="cs-toggle__track" aria-hidden="true"><i /></span>
      {label}
    </button>
  );
}
