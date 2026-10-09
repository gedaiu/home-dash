export const EKG_WIDTH = 200;
export const EKG_BEAT_WIDTH = 25;

const BASE_Y = 50;
const BEAT_START = { offsetX: 0, offsetY: 0 };
const BEAT_POINTS = [
  { offsetX: 2, offsetY: 0 },
  { offsetX: 4, offsetY: -5 },
  { offsetX: 6, offsetY: 3 },
  { offsetX: 8, offsetY: -40 },
  { offsetX: 10, offsetY: 15 },
  { offsetX: 12, offsetY: -8 },
  { offsetX: 14, offsetY: 0 },
  { offsetX: 17, offsetY: 5 },
  { offsetX: 20, offsetY: 0 },
  { offsetX: EKG_BEAT_WIDTH, offsetY: 0 }
];
const BEAT_CURVE = [BEAT_START, ...BEAT_POINTS];

export function generateWaveform(amplitude) {
  let path = `M 0 ${BASE_Y}`;

  for (let beatX = 0; beatX < EKG_WIDTH + EKG_BEAT_WIDTH; beatX += EKG_BEAT_WIDTH) {
    path += beatSegment(beatX, amplitude);
  }

  return path;
}

export function getYAtX(positionX, amplitude) {
  const beatX = ((positionX % EKG_BEAT_WIDTH) + EKG_BEAT_WIDTH) % EKG_BEAT_WIDTH;
  const nextIndex = BEAT_CURVE.findIndex((point) => beatX <= point.offsetX);

  if (nextIndex < 1) {
    return BASE_Y;
  }

  const previous = BEAT_CURVE[nextIndex - 1];
  const next = BEAT_CURVE[nextIndex];
  const progress = (beatX - previous.offsetX) / (next.offsetX - previous.offsetX);

  return BASE_Y + amplitude * (previous.offsetY + (next.offsetY - previous.offsetY) * progress);
}

function beatSegment(beatX, amplitude) {
  return BEAT_POINTS
    .map((point) => ` L ${beatX + point.offsetX} ${BASE_Y + point.offsetY * amplitude}`)
    .join('');
}
