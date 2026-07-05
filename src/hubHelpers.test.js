import { describe, it, expect } from 'vitest';

import { applyBrowse } from './hubHelpers';

const items = [
  { title: 'Breaking Bad', year: '2008', vote_average: 9.5, genres: ['Drama', 'Crime'] },
  { title: 'Chernobyl', year: '2019', vote_average: 9.4, genres: ['Drama', 'History'] },
  { title: 'The Office', year: '2005', vote_average: 8.9, genres: ['Comedy'] },
];

describe('applyBrowse', () => {
  it('returns the list unchanged with no filters', () => {
    expect(applyBrowse(items)).toEqual(items);
  });

  it('filters by case-insensitive title substring', () => {
    expect(applyBrowse(items, { searchTerm: 'the' }).map(i => i.title)).toEqual(['The Office']);
  });

  it('filters by exact genre (case-insensitive)', () => {
    expect(applyBrowse(items, { genre: 'drama' }).map(i => i.title))
      .toEqual(['Breaking Bad', 'Chernobyl']);
  });

  it('combines search and genre', () => {
    expect(applyBrowse(items, { searchTerm: 'cher', genre: 'History' }).map(i => i.title))
      .toEqual(['Chernobyl']);
  });

  it('sorts by title A–Z without mutating the input', () => {
    const before = items.map(i => i.title);
    expect(applyBrowse(items, { sort: 'title' }).map(i => i.title))
      .toEqual(['Breaking Bad', 'Chernobyl', 'The Office']);
    expect(items.map(i => i.title)).toEqual(before); // input untouched
  });

  it('sorts by year (newest first) and rating (highest first)', () => {
    expect(applyBrowse(items, { sort: 'year' }).map(i => i.year)).toEqual(['2019', '2008', '2005']);
    expect(applyBrowse(items, { sort: 'rating' })[0].title).toEqual('Breaking Bad');
  });

  it("leaves server order intact for 'popular'", () => {
    expect(applyBrowse(items, { sort: 'popular' })).toEqual(items);
  });
});
