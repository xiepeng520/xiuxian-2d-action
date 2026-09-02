export type CombatState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'heavy'
  | 'hurt'
  | 'dead';

export type AttackState = 'attack1' | 'attack2' | 'attack3' | 'heavy';

export function isAttackState(state: CombatState): state is AttackState {
  return state === 'attack1' || state === 'attack2' || state === 'attack3' || state === 'heavy';
}

export function nextLightState(current: CombatState): AttackState {
  if (current === 'attack1') {
    return 'attack2';
  }
  if (current === 'attack2') {
    return 'attack3';
  }
  return 'attack1';
}

export function attackIndex(state: AttackState): number {
  if (state === 'attack1') {
    return 0;
  }
  if (state === 'attack2') {
    return 1;
  }
  if (state === 'attack3') {
    return 2;
  }
  return -1;
}
