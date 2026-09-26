import { FolderHeart, Sparkles, Users } from 'lucide-react';
import '../automation/automation.css';

/**
 * Library (/library).
 *
 * A place to find things again — saved products, saved creators, and past
 * generations. Nothing is stored yet: the generator (src/pages/inside) keeps
 * no history today, and Bots (src/pages/bots) has no "save" action, so each
 * card says so rather than showing an empty list that looks broken.
 */
const SECTIONS = [
  {
    id: 'saved-products',
    icon: <FolderHeart size={18} />,
    title: 'Saved Products',
    note: 'Keep products you generate for so you can come back to them.',
  },
  {
    id: 'saved-creators',
    icon: <Users size={18} />,
    title: 'Saved Creators',
    note: 'Bookmark creators you look up on the Bots page.',
  },
  {
    id: 'generated-content',
    icon: <Sparkles size={18} />,
    title: 'Generated Content',
    note: 'Every image and video you’ve generated, in one place.',
  },
];

export function LibraryPage() {
  return (
    <div className="simple-page">
      <header className="simple-page__header">
        <h1>Library</h1>
        <p>Nothing is saved yet — these are the tools coming to this section.</p>
      </header>
      <div className="simple-page__grid">
        {SECTIONS.map((s) => (
          <article key={s.id} className="simple-page__card">
            <div className="simple-page__card-icon">{s.icon}</div>
            <h2>{s.title}</h2>
            <p>{s.note}</p>
            <span className="simple-page__badge">Not built yet</span>
          </article>
        ))}
      </div>
    </div>
  );
}
