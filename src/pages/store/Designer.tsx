import { useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Eye,
  Globe,
  Image as ImageIcon,
  Link2,
  Mail,
  Music2,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  ShoppingBag,
  Trash2,
  Type,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import type {
  Block,
  BlockType,
  CreatorStoreUi,
  DesignerState,
  LinkItem,
  Product,
  SocialItem,
  SocialNetwork,
  TiktokVideo,
} from './store';
import { blankBlock, newId, storeShareUrl } from './store';
import { PhonePreview } from './PhonePreview';

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

/** Sections a user can restore/add. Profile is permanent so it is excluded. */
const ADDABLE_TYPES: BlockType[] = ['products', 'links', 'image', 'text', 'video', 'tiktok', 'social', 'newsletter'];

const ADD_META: Record<BlockType, { label: string; desc: string; Icon: typeof ShoppingBag }> = {
  profile: { label: 'Profile', desc: '', Icon: Users },
  products: { label: 'Products', desc: 'Sell presets & orders', Icon: ShoppingBag },
  links: { label: 'Buttons / Links', desc: 'Link buttons stack', Icon: Link2 },
  image: { label: 'Image', desc: 'Photo with caption', Icon: ImageIcon },
  text: { label: 'Text', desc: 'Heading + paragraph', Icon: Type },
  video: { label: 'Video', desc: 'Embed with thumbnail', Icon: Play },
  tiktok: { label: 'TikTok videos', desc: 'Grid of TikToks', Icon: Music2 },
  social: { label: 'Social icons', desc: 'Profile row', Icon: Users },
  newsletter: { label: 'Newsletter', desc: 'Email capture', Icon: Mail },
};

export const ADD_SECTION_KEY = '__add__';

interface DesignerProps {
  designer: DesignerState;
  username: string;
  saveState: 'saved' | 'saving';
  publishedAt: string | null;
  ui: CreatorStoreUi;
  onPatch: (patch: Partial<DesignerState>) => void;
  onPatchUi: (patch: Partial<CreatorStoreUi>) => void;
  onPublish: () => void;
  onDisconnect: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Designer({ designer, username, saveState, publishedAt, ui, onPatch, onPatchUi, onPublish, onUndo, onRedo, canUndo, canRedo }: DesignerProps) {
  // The left panel is always exactly one box ("Editor Tools") whose body
  // follows whatever is picked in the phone preview.
  const focusKey = ui.focusKey;
  const setFocusKey = (next: string | null) => onPatchUi({ focusKey: next });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [published, setPublished] = useState(false);
  // Phone frame width (null = default responsive size). The centre
  // divider stays fixed between panels while the phone scales fluidly.
  const [phoneWidth, setPhoneWidth] = useState<number | null>(null);
  // Reveals every section type so users can intentionally add duplicates.
  const [showAllTypes, setShowAllTypes] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const handle = (designer.username || username).replace(/^@+/, '');

  function flash(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  }

  function exitFocus() {
    setSelectedKey(null);
    setFocusKey(null);
  }

  function openProductEditor(_blockId: string, productId: string) {
    setSelectedKey(`product:${productId}`);
    setFocusKey(`product:${productId}`);
  }

  /** Clicking the preview swaps the Editor Tools box to that item's options. */
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
    setShowAllTypes(false);
    setSelectedKey(key);
    setFocusKey(key);
  }

  function patchBlock(id: string, patch: Partial<Block>) {
    onPatch({ blocks: designer.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  }

  function resetBlock(id: string) {
    const b = designer.blocks.find((x) => x.id === id);
    if (!b) return;
    const blank = blankBlock(b.type);
    patchBlock(id, { ...blank, id: b.id, title: b.title });
  }

  function resetProduct(blockId: string, productId: string) {
    patchProduct(blockId, productId, { title: 'New product', description: '', price: '$9', image: '', link: '', cta: 'Get it' });
  }

  function moveBlockTo(dragId: string, targetId: string) {
    const from = designer.blocks.findIndex((b) => b.id === dragId);
    const to = designer.blocks.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const blocks = [...designer.blocks];
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    onPatch({ blocks });
  }

  /** Exact reorder: drop the dragged block at toIndex in the post-removal
      list (0 = top). Supports moving up, down, between, and to the ends. */
  function moveBlockToIndex(dragId: string, toIndex: number) {
    const from = designer.blocks.findIndex((b) => b.id === dragId);
    if (from < 0) return;
    const without = designer.blocks.filter((b) => b.id !== dragId);
    const clamped = Math.max(0, Math.min(toIndex, without.length));
    const next = [...without];
    next.splice(clamped, 0, designer.blocks[from]);
    if (next.map((b) => b.id).join('|') === designer.blocks.map((b) => b.id).join('|')) return;
    onPatch({ blocks: next });
    setSelectedKey(`block:${dragId}`);
    setFocusKey(`block:${dragId}`);
  }

  /** Section types currently missing from the page — the only ones the
      Add Section box offers by default, so duplicates never appear unless
      the user explicitly asks for them. */
  const missingTypes = ADDABLE_TYPES.filter((t) => !designer.blocks.some((b) => b.type === t));

  /** Empty-space clicks return to the overview so the left box never looks empty. */
  function handleEmptyClick() {
    setShowAllTypes(false);
    exitFocus();
  }

  function pickBlock(id: string) {
    pick(`block:${id}`);
  }

  /** Default overview shown when nothing is selected — sections to edit + quick add. */
  function renderDefaultTools() {
    const visibleTypes = showAllTypes ? ADDABLE_TYPES : missingTypes;
    return (
      <div className="cs-overview">
        <p className="cs-card__hint">Click anything in the phone preview to edit it here.</p>
        {designer.blocks.length > 0 && (
          <>
            <p className="cs-overview__label">Your sections · {designer.blocks.length}</p>
            <div className="cs-picklist">
              {designer.blocks.map((b) => {
                const meta = ADD_META[b.type];
                const Icon = meta.Icon;
                const title = b.title || meta.label;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={selectedKey === `block:${b.id}` ? 'is-on' : ''}
                    onClick={() => pickBlock(b.id)}
                    title={`Edit ${title}`}
                  >
                    <span className="cs-overview__row">
                      <Icon size={13} aria-hidden="true" />
                      <span className="cs-overview__name">{title}</span>
                      <span className="cs-overview__tag">{meta.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {visibleTypes.length > 0 && (
          <>
            <p className="cs-overview__label">{missingTypes.length > 0 ? 'Add a section' : 'Add more'}</p>
            <div className="cs-addgrid">
              {visibleTypes.map((t) => {
                const meta = ADD_META[t];
                const Icon = meta.Icon;
                return (
                  <button
                    key={t}
                    type="button"
                    className="cs-kindbtn cs-addcard"
                    onClick={() => addSection(t)}
                    aria-label={`Add ${meta.label} section`}
                    title={`Add ${meta.label}`}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span className="cs-addcard__label">{meta.label}</span>
                    <small>{meta.desc}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {!showAllTypes && missingTypes.length === 0 && (
          <button type="button" className="cs-btn-quiet" onClick={() => setShowAllTypes(true)}>
            <Plus size={13} /> Show all types
          </button>
        )}
        {showAllTypes && missingTypes.length === 0 && (
          <button type="button" className="cs-btn-quiet" onClick={() => setShowAllTypes(false)}>
            Show overview
          </button>
        )}
      </div>
    );
  }

  function addSection(type: BlockType) {
    const block = blankBlock(type);
    onPatch({ blocks: [...designer.blocks, block] });
    setShowAllTypes(false);
    setSelectedKey(`block:${block.id}`);
    setFocusKey(`block:${block.id}`);
    flash(`${ADD_META[type]?.label ?? 'Section'} added — drag it anywhere`);
  }

  function deleteBlock(id: string) {
    onPatch({ blocks: designer.blocks.filter((b) => b.id !== id) });
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
    setSelectedKey(`product:${item.id}`);
    setFocusKey(`product:${item.id}`);
  }

  function deleteProduct(blockId: string, productId: string) {
    const block = designer.blocks.find((b) => b.id === blockId);
    if (!block) return;
    patchBlock(blockId, { products: (block.products ?? []).filter((p) => p.id !== productId) });
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
    setSelectedKey(`link:${item.id}`);
    setFocusKey(`link:${item.id}`);
  }

  function addTiktok() {
    const existing = designer.blocks.find((b) => b.type === 'tiktok');
    const item: TiktokVideo = { id: newId('tiktok'), url: 'https://tiktok.com/@', thumb: '', views: '' };
    if (existing) {
      patchBlock(existing.id, { videos: [...(existing.videos ?? []), item] });
    } else {
      const block = { ...blankBlock('tiktok'), videos: [item] };
      onPatch({ blocks: [...designer.blocks, block] });
    }
    setSelectedKey(`tiktok:${item.id}`);
    setFocusKey(`tiktok:${item.id}`);
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

  /** Body of the single Editor Tools box for whatever is picked in the preview. */
  function renderEditorBody(): { eyebrow: string; body: React.ReactNode } | null {
    if (!focusKey) return null;
    if (focusKey === ADD_SECTION_KEY) {
      if (missingTypes.length === 0) return null;
      const visible = showAllTypes ? ADDABLE_TYPES : missingTypes;
      return {
        eyebrow: 'Add section',
        body: (
          <div className="cs-addwrap">
            <p className="cs-card__hint">
              {designer.blocks.length === 0 || designer.blocks.every((b) => b.type === 'profile')
                ? 'Your page is empty — pick a section to add it to the phone preview.'
                : 'Pick a removed section to restore it. It appears instantly and you can drag it anywhere.'}
            </p>
            <div className="cs-addgrid">
              {visible.map((t) => {
                const meta = ADD_META[t];
                const already = !missingTypes.includes(t);
                const Icon = meta.Icon;
                return (
                  <button key={t} type="button" className="cs-kindbtn cs-addcard" onClick={() => addSection(t)}>
                    <Icon size={15} />
                    <span className="cs-addcard__label">{meta.label}</span>
                    <small>{already ? 'Add another' : meta.desc}</small>
                  </button>
                );
              })}
            </div>
            {!showAllTypes && ADDABLE_TYPES.length > missingTypes.length && (
              <button type="button" className="cs-btn-quiet" onClick={() => setShowAllTypes(true)}>
                <Plus size={13} /> Show all types (add duplicates)
              </button>
            )}
            {showAllTypes && (
              <button type="button" className="cs-btn-quiet" onClick={() => setShowAllTypes(false)}>
                Show missing only
              </button>
            )}
          </div>
        ),
      };
    }
    const [kind, id] = focusKey.split(':');
    if (kind === 'product') {
      const block = designer.blocks.find((b) => (b.products ?? []).some((p) => p.id === id));
      const product = block?.products?.find((p) => p.id === id);
      if (!block || !product) return null;
      return {
        eyebrow: 'Edit product',
        body: (
          <ProductFields
            product={product}
            onPatch={(patch) => patchProduct(block.id, product.id, patch)}
            onReset={() => resetProduct(block.id, product.id)}
            onDelete={() => {
              deleteProduct(block.id, product.id);
              exitFocus();
            }}
          />
        ),
      };
    }
    if (kind === 'link') {
      const block = designer.blocks.find((b) => (b.links ?? []).some((l) => l.id === id));
      const link = block?.links?.find((l) => l.id === id);
      if (!block || !link) return null;
      return {
        eyebrow: 'Edit link',
        body: (
          <>
            <label className="cs-label">
              Section title
              <input value={block.title} maxLength={30} onChange={(e) => patchBlock(block.id, { title: e.target.value })} />
            </label>
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
          </>
        ),
      };
    }
    if (kind === 'tiktok') {
      const block = designer.blocks.find((b) => (b.videos ?? []).some((v) => v.id === id));
      const video = block?.videos?.find((v) => v.id === id);
      if (!block || !video) return null;
      return {
        eyebrow: 'Edit TikTok video',
        body: (
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
        ),
      };
    }
    const block = designer.blocks.find((b) => b.id === id);
    if (!block) return null;
    return {
      eyebrow: `${BLOCK_LABEL[block.type]} block`,
      body: (
        <BlockEditor
          block={block}
          designer={designer}
          usernamePlaceholder={username}
          selectedKey={selectedKey}
          onPatchBlock={(patch) => patchBlock(block.id, patch)}
          onPatchDesigner={onPatch}
          onAddProduct={() => addProduct(block.id)}
          onAddLink={addLink}
          onAddTiktok={addTiktok}
          onDeleteBlock={() => {
            deleteBlock(block.id);
            exitFocus();
          }}
          onResetBlock={() => resetBlock(block.id)}
          onOpenProduct={(productId) => openProductEditor(block.id, productId)}
        />
      ),
    };
  }

  const editorSelection = renderEditorBody();

  return (
    <div className="cs-builder">
      {/* Top bar */}
      <div className="cs-topbar">
        <strong>Creator Store</strong>
        <div className="cs-topbar__right">
          <button type="button" className="cs-toolbtn cs-toolbtn--icon" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={onUndo}>
            <Undo2 size={14} />
          </button>
          <button type="button" className="cs-toolbtn cs-toolbtn--icon" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={onRedo}>
            <Redo2 size={14} />
          </button>
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
        {/* Left: exactly one Editor Tools box — body follows the preview pick */}
        <div className="cs-controls">
          <div className="cs-card cs-focus cs-editor-tools">
            <div className="cs-editor-tools__head">
              <p className="cs-card__eyebrow">Editor Tools</p>
              {editorSelection && (
                <button type="button" className="cs-editor-tools__clear" onClick={exitFocus} aria-label="Clear selection">
                  <X size={14} />
                </button>
              )}
            </div>
            {editorSelection ? (
              <>
                <p className="cs-card__eyebrow cs-editor-tools__context">{editorSelection.eyebrow}</p>
                {editorSelection.body}
              </>
            ) : (
              renderDefaultTools()
            )}
          </div>
        </div>

        <div className="cs-divider" aria-hidden="true" />

        {/* Right live preview — fixed on the right, only the page inside pans */}
        <div className="cs-preview">
          <div className="cs-preview__fixed">
            <PhonePreview
              designer={designer}
              username={handle || username}
              selectedKey={selectedKey}
              hoverKey={hoverKey}
              width={phoneWidth}
              onWidthChange={setPhoneWidth}
              onHover={setHoverKey}
              onPick={pick}
              onClear={handleEmptyClick}
              onMoveBlock={moveBlockTo}
              onMoveBlockAt={moveBlockToIndex}
            />
            <p className="cs-preview__cap">
              <Link2 size={12} /> Live preview · {storeShareUrl(handle || username)}
              {missingTypes.length === 0 ? '' : ' · drag sections anywhere'}
            </p>
          </div>
        </div>

        {previewOpen && (
          <div
            className="cs-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Live store preview"
            onClick={() => setPreviewOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setPreviewOpen(false);
            }}
          >
            <div className="cs-modal__inner cs-modal__card" onClick={(e) => e.stopPropagation()}>
              <div className="cs-modal__head">
                <div className="cs-modal__titlewrap">
                  <p className="cs-modal__eyebrow">
                    <Eye size={12} aria-hidden="true" /> Live preview
                  </p>
                  <p className="cs-modal__url" title={storeShareUrl(handle || username)}>
                    @{handle || username} · {storeShareUrl(handle || username)}
                  </p>
                </div>
                <button type="button" className="cs-modal__close" aria-label="Close preview" onClick={() => setPreviewOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="cs-modal__phone">
                <PhonePreview designer={designer} username={handle || username} selectedKey={null} hoverKey={null} interactive={false} />
              </div>
              <div className="cs-modal__actions">
                <span className={`cs-savestate cs-savestate--${saveState}`} role="status">
                  <i aria-hidden="true" />
                  {saveState === 'saved' ? 'Saved ✓' : 'Saving…'}
                </span>
                <button type="button" className="cs-toolbtn" onClick={share}>
                  <Share2 size={14} /> Share
                </button>
                <button type="button" className="cs-toolbtn cs-toolbtn--primary" onClick={publish}>
                  <Globe size={14} /> {published || publishedAt ? 'Published ✓' : 'Publish'}
                </button>
              </div>
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
  designer,
  usernamePlaceholder,
  selectedKey,
  onPatchBlock,
  onPatchDesigner,
  onAddProduct,
  onAddLink,
  onAddTiktok,
  onDeleteBlock,
  onResetBlock,
  onOpenProduct,
}: {
  block: Block;
  designer: DesignerState;
  usernamePlaceholder: string;
  selectedKey: string | null;
  onPatchBlock: (patch: Partial<Block>) => void;
  onPatchDesigner: (patch: Partial<DesignerState>) => void;
  onAddProduct: () => void;
  onAddLink: () => void;
  onAddTiktok: () => void;
  onDeleteBlock: () => void;
  onResetBlock: () => void;
  onOpenProduct: (productId: string) => void;
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
        <ProfileFields designer={designer} usernamePlaceholder={usernamePlaceholder} onPatch={onPatchDesigner} />
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
      {b.type === 'social' && (
        <SocialBlockFields
          items={b.socials ?? []}
          onPatch={(id, patch) => onPatchBlock({ socials: (b.socials ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) })}
          onDelete={(id) => onPatchBlock({ socials: (b.socials ?? []).filter((s) => s.id !== id) })}
          onAdd={() => onPatchBlock({ socials: [...(b.socials ?? []), { id: newId('social'), network: 'instagram' as SocialNetwork, url: '' }] })}
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
          <label className="cs-label">
            Text size · {b.fontSize ?? 15}px
            <input type="range" min={11} max={24} value={b.fontSize ?? 15} onChange={(e) => onPatchBlock({ fontSize: Number(e.target.value) })} />
          </label>
          <div className="cs-grid2">
            <div className="cs-seg" role="group" aria-label="Text alignment">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} type="button" aria-label={`Align ${a}`} className={(b.align ?? 'center') === a ? 'is-on' : ''} onClick={() => onPatchBlock({ align: a })}>
                  {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                </button>
              ))}
            </div>
            <label className="cs-label cs-label--color">
              Colour
              <input type="color" value={b.color ?? '#0f172a'} onChange={(e) => onPatchBlock({ color: e.target.value })} />
            </label>
          </div>
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
      <div className="cs-card__row">
        <button type="button" className="cs-chipbtn" onClick={onResetBlock}><RotateCcw size={13} /> Reset</button>
        {b.type !== 'profile' && (
          <button type="button" className="cs-danger" onClick={onDeleteBlock}><Trash2 size={13} /> Remove</button>
        )}
      </div>
    </>
  );
}

function ProfileFields({
  designer,
  usernamePlaceholder,
  onPatch,
}: {
  designer: DesignerState;
  usernamePlaceholder: string;
  onPatch: (p: Partial<DesignerState>) => void;
}) {
  return (
    <>
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
            placeholder={usernamePlaceholder}
            onChange={(e) => onPatch({ username: e.target.value.replace(/[^a-zA-Z0-9_.]/g, '') })}
          />
        </label>
      </div>
      <label className="cs-label">
        Bio
        <textarea value={designer.bio} rows={3} maxLength={140} onChange={(e) => onPatch({ bio: e.target.value })} />
      </label>
    </>
  );
}

function SocialBlockFields({
  items,
  onPatch,
  onDelete,
  onAdd,
}: {
  items: SocialItem[];
  onPatch: (id: string, patch: Partial<SocialItem>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="cs-label">
      <span>Social links</span>
      <div className="cs-itemrows">
        {items.map((s) => (
          <div key={s.id} className="cs-itemrow">
            <select aria-label="Network" value={s.network} onChange={(e) => onPatch(s.id, { network: e.target.value as SocialNetwork })}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="x">X</option>
            </select>
            <input aria-label="Social URL" value={s.url} placeholder="https://…" inputMode="url" onChange={(e) => onPatch(s.id, { url: e.target.value })} />
            <button type="button" className="cs-mini" aria-label="Delete social link" onClick={() => onDelete(s.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="cs-addbtn"
          onClick={onAdd}
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
  onReset,
  onDelete,
}: {
  product: Product;
  onPatch: (patch: Partial<Product>) => void;
  onReset: () => void;
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
      <div className="cs-card__row">
        <button type="button" className="cs-chipbtn" onClick={onReset}><RotateCcw size={13} /> Reset</button>
        <button type="button" className="cs-danger" onClick={onDelete}><Trash2 size={13} /> Delete product</button>
      </div>
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
