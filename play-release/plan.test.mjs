import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestVersionCode, planPromote, planSetFraction, planHalt, planComplete } from './plan.mjs';

const notes = [{ language: 'en-IN', text: 'Faster billing' }];
const alpha = { track: 'alpha', releases: [
  { name: '0.0.1.56', versionCodes: ['56'], status: 'completed' },
  { name: '0.0.1.57', versionCodes: ['57'], status: 'completed', releaseNotes: notes },
] };

test('latestVersionCode picks the highest live version code', () => {
  assert.equal(latestVersionCode(alpha), '57');
});

test('latestVersionCode ignores drafts and fails on an empty track', () => {
  assert.equal(latestVersionCode({ track: 'a', releases: [{ versionCodes: ['60'], status: 'draft' }, { versionCodes: ['58'], status: 'completed' }] }), '58');
  assert.throws(() => latestVersionCode({ track: 'beta', releases: [] }), /No live release on beta/);
});

test('promote with no fraction is a full rollout carrying the source notes', () => {
  const releases = planPromote({ fromTrack: alpha, toTrack: { track: 'beta', releases: [] } });
  assert.deepEqual(releases, [{ name: '0.0.1.57', versionCodes: ['57'], status: 'completed', releaseNotes: notes }]);
});

test('promote with a fraction below 1 is a staged rollout', () => {
  const [r] = planPromote({ fromTrack: alpha, toTrack: { track: 'production', releases: [] }, userFraction: '0.1' });
  assert.equal(r.status, 'inProgress');
  assert.equal(r.userFraction, 0.1);
});

test('promote of an explicit version code must exist on the source track', () => {
  assert.throws(() => planPromote({ fromTrack: alpha, toTrack: { track: 'beta', releases: [] }, versionCode: '99' }), /99 is not on alpha/);
});

test('promote rejects a fraction outside (0, 1]', () => {
  assert.throws(() => planPromote({ fromTrack: alpha, toTrack: { track: 'production', releases: [] }, userFraction: '1.5' }), /between 0 and 1/);
});

const staged = { track: 'production', releases: [
  { name: '0.0.1.50', versionCodes: ['50'], status: 'completed' },
  { name: '0.0.1.57', versionCodes: ['57'], status: 'inProgress', userFraction: 0.1 },
] };

test('set-fraction raises the in-progress fraction and keeps the completed release', () => {
  const releases = planSetFraction(staged, '0.5');
  assert.equal(releases.find((r) => r.status === 'inProgress').userFraction, 0.5);
  assert.equal(releases.find((r) => r.status === 'completed').versionCodes[0], '50');
});

test('set-fraction to 1 completes the rollout', () => {
  const releases = planSetFraction(staged, '1.0');
  assert.deepEqual(releases, [{ name: '0.0.1.57', versionCodes: ['57'], status: 'completed' }]);
});

test('set-fraction refuses to lower the fraction or act without a rollout', () => {
  assert.throws(() => planSetFraction(staged, '0.05'), /higher than the current 0.1/);
  assert.throws(() => planSetFraction({ track: 'production', releases: [] }, '0.5'), /No staged rollout/);
});

test('halt stops the in-progress release', () => {
  assert.equal(planHalt(staged).find((r) => r.versionCodes[0] === '57').status, 'halted');
  assert.throws(() => planHalt({ track: 'production', releases: [] }), /No staged rollout/);
});

test('complete finishes an in-progress or halted release', () => {
  assert.deepEqual(planComplete(staged), [{ name: '0.0.1.57', versionCodes: ['57'], status: 'completed' }]);
  const halted = { track: 'production', releases: [{ versionCodes: ['57'], status: 'halted', userFraction: 0.2 }] };
  assert.deepEqual(planComplete(halted), [{ versionCodes: ['57'], status: 'completed' }]);
});
