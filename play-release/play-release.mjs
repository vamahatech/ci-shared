// Edits a Play track (promote / set-fraction / halt / complete) without uploading a build.
// Inputs arrive as env vars from action.yml. Exits non-zero with Play's message on failure.
import { google } from 'googleapis';
import { planPromote, planSetFraction, planHalt, planComplete } from './plan.mjs';

const env = (name) => (process.env[name] ?? '').trim();
const packageName = env('PACKAGE_NAME');
const action = env('ACTION');
const toTrackName = env('TO_TRACK');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(env('SERVICE_ACCOUNT_JSON')),
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const play = google.androidpublisher({ version: 'v3', auth });

const { data: edit } = await play.edits.insert({ packageName });
const editId = edit.id;
const getTrack = async (track) => {
  const { data } = await play.edits.tracks.get({ packageName, editId, track });
  return { track, releases: data.releases ?? [] };
};

const toTrack = await getTrack(toTrackName);
let releases;
switch (action) {
  case 'promote':
    releases = planPromote({
      fromTrack: await getTrack(env('FROM_TRACK')),
      toTrack,
      versionCode: env('VERSION_CODE'),
      userFraction: env('USER_FRACTION'),
    });
    break;
  case 'set-fraction':
    releases = planSetFraction(toTrack, env('USER_FRACTION'));
    break;
  case 'halt':
    releases = planHalt(toTrack);
    break;
  case 'complete':
    releases = planComplete(toTrack);
    break;
  default:
    throw new Error(`Unknown action "${action}".`);
}

await play.edits.tracks.update({ packageName, editId, track: toTrackName, requestBody: { track: toTrackName, releases } });
await play.edits.commit({ packageName, editId });
console.log(`${action} → ${toTrackName}:`);
console.log(JSON.stringify(releases, null, 2));
