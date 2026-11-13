import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

const idsInMarkup = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

/**
 * Every element the app code looks up for the student-facing features, keyed
 * by the feature that renders into it.
 *
 * The lookups are all optional (`?.`), so a deleted element silently removes
 * a button nobody clicks any more. A new feature must add its ids here in the
 * same change that adds the markup; the test below is the only thing that
 * notices the difference.
 */
export const REQUIRED_IDS = {
  chrome: [
    'groupChip',
    'groupChipLabel',
    'netDot',
    'searchBtn',
    'settingsBtn',
    'changesDot',
    'themeToggle',
    'themeIcon',
  ],
  status: ['statusBanner'],
  feed: ['feed', 'dayStrip', 'feedBody'],
  search: ['searchOverlay', 'searchInput', 'searchClose', 'searchResults'],
  toast: ['toast'],
  shell: ['app'],
};

const allRequired = Object.values(REQUIRED_IDS).flat();

describe('index.html markup contract', () => {
  it.each(Object.entries(REQUIRED_IDS))('has the ids of the %s', (_feature, ids) => {
    const missing = ids.filter((id) => !idsInMarkup.has(id));
    expect(missing).toEqual([]);
  });

  it('has no duplicate ids', () => {
    const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const duplicates = all.filter((id, index) => all.indexOf(id) !== index);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('points every <label for> at an element that exists', () => {
    const targets = [...html.matchAll(/\sfor="([^"]+)"/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((id) => !idsInMarkup.has(id))).toEqual([]);
  });

  it('declares every id the app code looks up, so the list cannot rot', () => {
    const source = readFileSync(resolve(root, 'src', 'main.ts'), 'utf8');
    const looked = new Set([...source.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]));
    expect([...looked].sort()).toEqual([...new Set(allRequired)].sort());
  });
});
