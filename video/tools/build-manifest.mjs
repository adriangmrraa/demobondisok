import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

const captureDir = path.resolve(import.meta.dirname, '..', 'capture');
const targets = [10, 18, 30, 25, 35, 38, 35, 22];
const shows = [
  'Live app opening', 'Home, navigation and history', 'First-arrival paths', 'Same home state after trip',
  'Real access paths and tap counts', 'Network diagram and selected map route', 'Modo Viaje', 'Live product closing montage',
];
const manifest = targets.map((targetDuration, index) => {
  const scene = index + 1;
  const file = `scene-${String(scene).padStart(2, '0')}.mp4`;
  const result = spawnSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', path.join(captureDir, file),
  ], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(result.stderr);
  const probe = JSON.parse(result.stdout);
  const duration = Number(probe.format.duration);
  return {
    scene,
    file,
    source: file.replace(/\.mp4$/, '.webm'),
    frames: Number(probe.streams[0].nb_frames ?? Math.floor(duration * 30)),
    duration,
    width: probe.streams[0].width,
    height: probe.streams[0].height,
    fps: probe.streams[0].r_frame_rate,
    trimStartSeconds: 3,
    targetDuration,
    shows: shows[index],
  };
});

await writeFile(path.join(captureDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
