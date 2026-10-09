import { FULL_TURN, BYTES_PER_KB } from './geometry-constants.js';

export const OUTLINE_COLOR = '#fff';
export const OUTLINE_WIDTH = 2;

const ACCENT_CHANNELS = '255, 140, 0';

export function accentColor(alpha) {
  return `rgba(${ACCENT_CHANNELS}, ${alpha})`;
}

export function logScale(bytes) {
  return Math.log2(bytes / BYTES_PER_KB + 1);
}

export function emphasisAlpha(rules, idleAlpha) {
  const rule = rules.find(candidate => candidate.isActive);

  if (!rule) return idleAlpha;

  return rule.isMatch ? rule.matchAlpha : rule.otherAlpha;
}

export function strokeRing(ctx, layout, radius) {
  ctx.beginPath();
  ctx.arc(layout.centerX, layout.centerY, radius, 0, FULL_TURN);
  ctx.stroke();
}

export function drawNode(ctx, node) {
  ctx.beginPath();
  ctx.arc(node.posX, node.posY, node.radius, 0, FULL_TURN);
  ctx.fillStyle = node.color;
  ctx.globalAlpha = node.alpha;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (node.isSelected) {
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.stroke();
  }
}

export function drawSideLabel(ctx, label) {
  const isOnRightSide = label.posX > label.centerX;

  ctx.fillStyle = accentColor(label.alpha);
  ctx.font = `${label.isSelected ? 'bold ' : ''}${label.fontSize}px monospace`;
  ctx.textAlign = isOnRightSide ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.text, label.posX + (isOnRightSide ? label.offset : -label.offset), label.posY);
}
