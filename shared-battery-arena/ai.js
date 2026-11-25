/**
 * Scripted opponent. It only returns an input. The match applies that input
 * with the same step used for the human, including the shared battery.
 */

import { RULES } from './sim.js';

export function decideAi(state) {
  const idle = { x: 0, y: 0, sprint: false, kick: false };
  if (!state || state.phase !== 'play') return idle;
  const me = state.players[1];
  const ball = state.ball;
  const gateY = state.h / 2;
  const defending = ball.x > state.w * 0.62;
  let tx = ball.x + 36;
  let ty = ball.y + (gateY - ball.y) * 0.2;
  if (defending) {
    tx = Math.min(state.w - 56, ball.x + 52);
    ty = ball.y + (gateY - ball.y) * 0.4;
  }
  ty += Math.sin(state.simTicks * 0.05) * 10;
  ty = Math.max(40, Math.min(state.h - 40, ty));

  let dx = tx - me.x;
  let dy = ty - me.y;
  const dist = Math.hypot(dx, dy) || 1;
  dx /= dist;
  dy /= dist;

  const toBall = Math.hypot(ball.x - me.x, ball.y - me.y);
  const onAttackSide = me.x > ball.x - 4;
  const sprint = state.sprintArmed && state.battery > 46 && dist > 125;
  if (toBall < me.r + ball.r + RULES.kickRange && state.kickCd[1] <= 0 && onAttackSide) {
    let ax = ball.x - me.x;
    let ay = ball.y - me.y;
    const mag = Math.hypot(ax, ay) || 1;
    ax /= mag;
    ay /= mag;
    return { x: ax, y: ay, sprint: false, kick: true };
  }
  return { x: dx, y: dy, sprint, kick: false };
}
