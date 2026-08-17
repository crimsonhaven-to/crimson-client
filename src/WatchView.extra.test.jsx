// Pins the watch page's "extra" mode: a special / OVA / film of a show is a
// single self-contained item, so it must not be dressed up as an episode of the
// parent season whose metadata surrounds it.
//
// The regression this guards against is concrete: opening Overlord's "Ple Ple
// Pleiades" loaded season 1's /info for its art, and the page then announced
// itself as Overlord S1 E1, offered season 1's episode picker, and let Auto-Next
// walk into episode 2 of the show proper.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import WatchView from './WatchView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));

// The parent season's /info payload, which is what an extra actually renders with.
const PARENT_META = {
  title: 'Overlord',
  summary: 'The parent season summary.',
  episodes_list: [
    { episode_number: 1, title: 'The End and the Beginning', overview: 'Episode one.' },
    { episode_number: 2, title: 'Floor Guardians', overview: 'Episode two.' },
  ],
};

const SEASONS = [
  { season_number: 1, tmdb_id: 64196, tmdb_season: 1 },
  { season_number: 2, tmdb_id: 64196, tmdb_season: 2 },
];

function render(container, props) {
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter>
        <WatchView
          streams={[]}
          streamLoading={false}
          activeStreamIdx={0}
          onSelectStream={() => {}}
          poster=""
          playerStartAt={0}
          onPlayerProgress={() => {}}
          metadata={PARENT_META}
          totalSeasons={4}
          currentSeason={1}
          currentEpisode={1}
          availableSeasons={SEASONS}
          onEpisodeChange={() => {}}
          isAuthenticated={false}
          backUrl="/anime/21305"
          {...props}
        />
      </MemoryRouter>,
    );
  });
  return root;
}

describe('WatchView extra mode', () => {
  let container;
  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('names the extra, not the parent season it borrowed metadata from', () => {
    render(container, { isExtra: true, displayTitle: 'Overlord: Ple Ple Pleiades' });
    const text = container.textContent;

    expect(text).toContain('Overlord: Ple Ple Pleiades');
    // The parent's episode 1 title and the season badge both belong to the show,
    // never to the special.
    expect(text).not.toContain('The End and the Beginning');
    expect(text).not.toContain('S1');
  });

  it('offers no season or episode navigation', () => {
    render(container, { isExtra: true, displayTitle: 'Overlord: The Undead King' });
    const text = container.textContent;

    // The SN / EP stat boxes and the season-browsing rail are all episode furniture.
    expect(text).not.toContain('Archives');
    expect(text.includes('SN')).toBe(false);
  });

  it('leaves an ordinary episode rendering exactly as before', () => {
    render(container, { displayTitle: 'Overlord' });
    const text = container.textContent;

    expect(text).toContain('The End and the Beginning');
    expect(text).toContain('S1');
    expect(text).toContain('Archives');
  });
});
