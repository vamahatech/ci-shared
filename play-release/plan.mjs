// Pure Play track-edit logic: takes the current track state and returns the new `releases`
// array to PUT back. No network here, so it's unit-tested with `node --test`.

const LIVE = new Set(['completed', 'inProgress', 'halted']);

export function latestVersionCode(track) {
  const codes = track.releases
    .filter((r) => LIVE.has(r.status))
    .flatMap((r) => r.versionCodes ?? [])
    .map(Number);
  if (codes.length === 0) throw new Error(`No live release on ${track.track}.`);
  return String(Math.max(...codes));
}

function parseFraction(value) {
  const f = Number(value);
  if (!(f > 0 && f <= 1)) throw new Error(`user-fraction must be between 0 and 1 (got ${value}).`);
  return f;
}

function rollout(base, fraction) {
  const { userFraction: _drop, ...rest } = base;
  return fraction === undefined || fraction === 1
    ? { ...rest, status: 'completed' }
    : { ...rest, status: 'inProgress', userFraction: fraction };
}

export function planPromote({ fromTrack, toTrack, versionCode, userFraction }) {
  const code = versionCode || latestVersionCode(fromTrack);
  const source = fromTrack.releases.find((r) => (r.versionCodes ?? []).includes(code));
  if (!source) throw new Error(`Version code ${code} is not on ${fromTrack.track}.`);
  const fraction = userFraction ? parseFraction(userFraction) : undefined;
  const base = { versionCodes: [code] };
  if (source.name) base.name = source.name;
  if (source.releaseNotes) base.releaseNotes = source.releaseNotes;
  return [rollout(base, fraction)];
}

function stagedRelease(track, statuses) {
  const release = track.releases.find((r) => statuses.includes(r.status));
  if (!release) throw new Error(`No staged rollout on ${track.track}.`);
  return release;
}

export function planSetFraction(track, userFraction) {
  const current = stagedRelease(track, ['inProgress']);
  const fraction = parseFraction(userFraction);
  if (fraction === 1) return planComplete(track);
  if (fraction <= current.userFraction) {
    throw new Error(`New fraction ${fraction} must be higher than the current ${current.userFraction}.`);
  }
  return track.releases.map((r) => (r === current ? { ...r, userFraction: fraction } : r));
}

export function planHalt(track) {
  const current = stagedRelease(track, ['inProgress']);
  return track.releases.map((r) => (r === current ? { ...r, status: 'halted' } : r));
}

export function planComplete(track) {
  const current = stagedRelease(track, ['inProgress', 'halted']);
  // Completing replaces the older completed release: Play serves only the new one.
  return [rollout(current, 1)];
}
