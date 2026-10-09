import { findDeviceCustomization, DEVICE_TYPES } from '../../state.js';

const ICON_LINE_WIDTH = 1.5;
const QUESTION_MARK = '?';
const FULL_CIRCLE = { startAngle: 0, endAngle: 2 };
const HELP_CIRCLE_STEPS = [
  { shape: 'arcs', paint: 'stroke', arcs: [{ offsetX: 0, offsetY: 0, radius: 0.7, ...FULL_CIRCLE }] }
];

const ICON_STEPS = {
  'monitor': [
    { shape: 'rect', left: -1, top: -0.7, width: 2, height: 1.2 },
    {
      shape: 'lines',
      segments: [
        { fromLeft: -0.3, fromTop: 0.5, toLeft: 0.3, toTop: 0.5 },
        { fromLeft: 0, fromTop: 0.5, toLeft: 0, toTop: 0.8 },
        { fromLeft: -0.5, fromTop: 0.8, toLeft: 0.5, toTop: 0.8 }
      ]
    }
  ],
  'laptop': [
    { shape: 'rect', left: -0.8, top: -0.5, width: 1.6, height: 0.9 },
    { shape: 'lines', segments: [{ fromLeft: -1, fromTop: 0.5, toLeft: 1, toTop: 0.5 }] }
  ],
  'smartphone': [
    { shape: 'rect', left: -0.4, top: -0.8, width: 0.8, height: 1.6 },
    { shape: 'arcs', paint: 'stroke', arcs: [{ offsetX: 0, offsetY: 0.5, radius: 0.1, ...FULL_CIRCLE }] }
  ],
  'tablet': [
    { shape: 'rect', left: -0.6, top: -0.8, width: 1.2, height: 1.6 },
    { shape: 'arcs', paint: 'stroke', arcs: [{ offsetX: 0, offsetY: 0.5, radius: 0.1, ...FULL_CIRCLE }] }
  ],
  'tv': [
    { shape: 'rect', left: -1, top: -0.6, width: 2, height: 1.2 }
  ],
  'speaker': [
    { shape: 'rect', left: -0.5, top: -0.8, width: 1, height: 1.6 },
    { shape: 'arcs', paint: 'stroke', arcs: [{ offsetX: 0, offsetY: 0.2, radius: 0.25, ...FULL_CIRCLE }] }
  ],
  'cpu': [
    { shape: 'rect', left: -0.5, top: -0.5, width: 1, height: 1 },
    {
      shape: 'lines',
      segments: [
        { fromLeft: -0.5, fromTop: -0.3, toLeft: -0.7, toTop: -0.3 },
        { fromLeft: -0.5, fromTop: 0.3, toLeft: -0.7, toTop: 0.3 },
        { fromLeft: 0.5, fromTop: -0.3, toLeft: 0.7, toTop: -0.3 },
        { fromLeft: 0.5, fromTop: 0.3, toLeft: 0.7, toTop: 0.3 }
      ]
    }
  ],
  'camera': [
    { shape: 'rect', left: -0.7, top: -0.4, width: 1.4, height: 0.8 },
    { shape: 'arcs', paint: 'stroke', arcs: [{ offsetX: 0, offsetY: 0, radius: 0.25, ...FULL_CIRCLE }] }
  ],
  'printer': [
    { shape: 'rect', left: -0.7, top: -0.3, width: 1.4, height: 0.6 },
    { shape: 'rect', left: -0.5, top: -0.7, width: 1, height: 0.4 }
  ],
  'gamepad-2': [
    {
      shape: 'arcs',
      paint: 'stroke',
      arcs: [
        { offsetX: -0.4, offsetY: 0, radius: 0.35, ...FULL_CIRCLE },
        { offsetX: 0.4, offsetY: 0, radius: 0.35, ...FULL_CIRCLE }
      ]
    }
  ],
  'wifi': [
    { shape: 'arcs', paint: 'stroke', arcs: [{ offsetX: 0, offsetY: 0.3, radius: 0.8, startAngle: -0.8, endAngle: -0.2 }] },
    { shape: 'arcs', paint: 'stroke', arcs: [{ offsetX: 0, offsetY: 0.3, radius: 0.5, startAngle: -0.8, endAngle: -0.2 }] },
    { shape: 'arcs', paint: 'fill', arcs: [{ offsetX: 0, offsetY: 0.3, radius: 0.15, ...FULL_CIRCLE }] }
  ],
  'router': [
    { shape: 'rect', left: -0.8, top: -0.3, width: 1.6, height: 0.6 },
    {
      shape: 'lines',
      segments: [
        { fromLeft: -0.4, fromTop: -0.3, toLeft: -0.4, toTop: -0.7 },
        { fromLeft: 0.4, fromTop: -0.3, toLeft: 0.4, toTop: -0.7 }
      ]
    }
  ],
  'server': [
    { shape: 'rect', left: -0.6, top: -0.8, width: 1.2, height: 0.5 },
    { shape: 'rect', left: -0.6, top: -0.25, width: 1.2, height: 0.5 },
    { shape: 'rect', left: -0.6, top: 0.3, width: 1.2, height: 0.5 }
  ],
  'hard-drive': [
    { shape: 'rect', left: -0.8, top: -0.4, width: 1.6, height: 0.8 },
    { shape: 'arcs', paint: 'stroke', arcs: [{ offsetX: 0.4, offsetY: 0, radius: 0.15, ...FULL_CIRCLE }] }
  ]
};

const SHAPE_PAINTERS = { rect: paintRect, lines: paintLines, arcs: paintArcs };

export function getDeviceIconName(mac, hostname) {
  const custom = findDeviceCustomization(mac, hostname);
  const typeId = custom?.type || 'unknown';
  const deviceType = DEVICE_TYPES.find(type => type.id === typeId);

  return deviceType?.icon || 'help-circle';
}

export function drawDeviceIcon(ctx, { originX, originY, size, iconName, color, alpha }) {
  const frame = { originX, originY, size };

  ctx.save();
  applyIconStyle(ctx, color, alpha);

  const isKnownIcon = Object.hasOwn(ICON_STEPS, iconName);
  const steps = isKnownIcon ? ICON_STEPS[iconName] : HELP_CIRCLE_STEPS;

  steps.forEach(step => SHAPE_PAINTERS[step.shape](ctx, step, frame));

  if (!isKnownIcon) {
    drawQuestionMark(ctx, frame);
  }

  ctx.restore();
}

function applyIconStyle(ctx, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = ICON_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawQuestionMark(ctx, frame) {
  ctx.font = `bold ${frame.size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(QUESTION_MARK, frame.originX, frame.originY);
}

function paintRect(ctx, step, frame) {
  const { originX, originY, size } = frame;

  ctx.strokeRect(originX + step.left * size, originY + step.top * size, step.width * size, step.height * size);
}

function paintLines(ctx, step, frame) {
  const { originX, originY, size } = frame;

  ctx.beginPath();

  step.segments.forEach(segment => {
    ctx.moveTo(originX + segment.fromLeft * size, originY + segment.fromTop * size);
    ctx.lineTo(originX + segment.toLeft * size, originY + segment.toTop * size);
  });

  ctx.stroke();
}

function paintArcs(ctx, step, frame) {
  const { originX, originY, size } = frame;

  ctx.beginPath();

  step.arcs.forEach(arc => {
    ctx.arc(originX + arc.offsetX * size, originY + arc.offsetY * size, arc.radius * size, arc.startAngle * Math.PI, arc.endAngle * Math.PI);
  });

  ctx[step.paint]();
}
