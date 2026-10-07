import { isNewerBuild, runningMainJs } from './appUpdate';

jest.mock('../firebase', () => ({ db: {} }));

test('a different main bundle on the server is a newer build', () => {
  const m = (main) => ({ files: { 'main.js': main } });
  expect(isNewerBuild(m('/static/js/main.abc123.js'), 'static/js/main.def456.js')).toBe(true);
  expect(isNewerBuild(m('/static/js/main.abc123.js'), 'static/js/main.abc123.js')).toBe(false);
  // Nothing to compare (dev server, a broken manifest): no banner.
  expect(isNewerBuild(m('/static/js/main.abc123.js'), null)).toBe(false);
  expect(isNewerBuild({}, 'static/js/main.abc123.js')).toBe(false);
});

test('the running bundle is read from the page', () => {
  document.body.innerHTML = '<script src="/static/js/runtime.js"></script><script defer src="/static/js/main.9f8e7d.js"></script>';
  expect(runningMainJs()).toBe('static/js/main.9f8e7d.js');
  document.body.innerHTML = '';
  expect(runningMainJs()).toBeNull();
});
