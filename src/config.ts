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
  speed: 70,
  bodyWidth: 52,
  bodyHeight: 48,
  attackRange: 150,
  attackDamage: 12,
  windupMs: 280,
  activeMs: 140,
  recoverMs: 360,
  flashMs: 33,
} as const;

export const BOSS = {
  maxHp: 160,
  speed: 55,
  bodyWidth: 36,
  bodyHeight: 80,
  attackRange: 170,
  attackDamage: 18,
  windupMs: 420,
  activeMs: 180,
  recoverMs: 520,
  flashMs: 33,
  stunScale: 0.5,
} as const;

export const STAGE = {
  killCultivation: 8,
  clearCultivation: 15,
  bossCultivation: 40,
  roomWidth: 1280,
} as const;

export const SKILL = {
  duration: 480,
  activeStart: 160,
  activeEnd: 280,
  knockback: 280,
  hitstop: 150,
  damage: 40,
} as const;

export const REALM = {
  dualAt: 80,
  tripleAt: 160,
} as const;

export function realmFromTotal(total: number): 1 | 2 | 3 {
  if (total >= REALM.tripleAt) {
    return 3;
  }
  if (total >= REALM.dualAt) {
    return 2;
  }
  return 1;
}

export function realmBarFill(total: number): number {
  if (total >= REALM.tripleAt) {
    return 1;
  }
  if (total >= REALM.dualAt) {
    return (total - REALM.dualAt) / (REALM.tripleAt - REALM.dualAt);
  }
  return total / REALM.dualAt;
}

export function scaledDealt(base: number, realm: number): number {
  return Math.floor(base * (1 + 0.1 * (realm - 1)));
}
