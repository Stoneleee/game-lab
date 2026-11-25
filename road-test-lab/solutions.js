// Example inputs. These drive the same step function as the page.
// They are not a replay button.

export const SOLUTIONS = [
  {
    id: 'lip',
    edits: [{ op: 'rotate', index: 2 }],
    script: [{ t: 0, throttle: true }],
    unedited: [{ t: 0, throttle: true }],
  },
  {
    id: 'wall',
    edits: [{ op: 'replace', index: 2, type: 'ramp' }],
    script: [{ t: 0, throttle: true }],
    unedited: [{ t: 0, throttle: true }],
    coast: [{ t: 0 }],
  },
  {
    id: 'window',
    edits: [{ op: 'rotate', index: 3 }],
    script: [{ t: 0, throttle: true }, { t: 0.7, throttle: false }],
    unedited: [{ t: 0, throttle: true }, { t: 0.7, throttle: false }],
    tooFast: [{ t: 0, throttle: true }],
    tooSlow: [{ t: 0, throttle: true }, { t: 0.12, throttle: false }],
  },
];
