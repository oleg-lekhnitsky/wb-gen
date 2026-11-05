/** Approved Smooth curve with a subtle braking settle. */
export const motionEasingPresets = [
  { label: 'Smooth', values: [.76, 0, .073, 1.012] }
] as const
export const defaultMotionCurve = { x1: .76, y1: 0, x2: .073, y2: 1.012 }
