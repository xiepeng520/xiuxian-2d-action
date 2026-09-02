export const GAME = {
  width: 1280,
  height: 720,
  gravity: 1800,
} as const;

export const PLAYER = {
  maxHp: 100,
  speed: 320,
  jumpVelocity: -620,
  bodyWidth: 36,
  bodyHeight: 72,
  attackLunge: 90,
} as const;

export const COMBAT = {
  bufferMs: 220,
  comboResetMs: 1600,
  lightHitstopMs: 70,
  heavyHitstopMs: 130,
  killHitstopMs: 180,
} as const;

export const LIGHT_COMBO = [
  { duration: 220, activeStart: 70, activeEnd: 140, damage: 12, knockback: 80, hitstop: COMBAT.lightHitstopMs },
  { duration: 240, activeStart: 80, activeEnd: 160, damage: 14, knockback: 100, hitstop: COMBAT.lightHitstopMs },
  { duration: 320, activeStart: 90, activeEnd: 200, damage: 22, knockback: 220, hitstop: 100 },
] as const;

export const HEAVY = {
  duration: 420,
  activeStart: 140,
  activeEnd: 260,
  damage: 32,
  knockback: 340,
  hitstop: COMBAT.heavyHitstopMs,
} as const;

export const ENEMY = {
  maxHp: 80,
  speed: 40,
  bodyWidth: 40,
  bodyHeight: 78,
} as const;
