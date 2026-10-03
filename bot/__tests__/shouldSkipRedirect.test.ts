import { describe, expect, it } from '@jest/globals';
import shouldSkipRedirect from '../admin/shouldSkipRedirect';
import { WikiPage } from '../types';

function redirect(target: string, ns = 0, targetNs = 2): WikiPage {
  return {
    pageid: 1,
    title: 'הפניה',
    ns,
    extlinks: [],
    links: [{ ns: targetNs, title: target }],
  };
}

describe('shouldSkipRedirect', () => {
  it.each([
    'משתמש:יאצקין52/טיוטה',
    'משתמש:יאצקין52/טיוטה/פרק',
  ])('skips mainspace redirects to %s', (target) => {
    expect(shouldSkipRedirect(redirect(target))).toBe(true);
  });

  it.each([
    'משתמש:יאצקין52',
    'משתמש:יאצקין520/טיוטה',
    'משתמש:אחר/יאצקין52/טיוטה',
    'משתמש:אחר/טיוטה',
  ])('does not exempt redirects to %s', (target) => {
    expect(shouldSkipRedirect(redirect(target))).toBe(false);
  });

  it('does not exempt redirects from other namespaces', () => {
    expect(shouldSkipRedirect(redirect('משתמש:יאצקין52/טיוטה', 118))).toBe(false);
  });

  it('does not exempt targets outside the user namespace', () => {
    expect(shouldSkipRedirect(redirect('טיוטה:יאצקין52/טיוטה', 0, 118))).toBe(false);
  });

  it.each([undefined, [], [{ ns: 2, title: 'משתמש:יאצקין52/א' }, { ns: 2, title: 'משתמש:אחר/ב' }]])(
    'does not exempt pages without a single target: %p',
    (links) => {
      expect(shouldSkipRedirect({ ...redirect('משתמש:יאצקין52/טיוטה'), links })).toBe(false);
    },
  );
});
