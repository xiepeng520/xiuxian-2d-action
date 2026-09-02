export type CombatState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'light'
  | 'heavy'
  | 'hurt'
  | 'dead';

export type AttackState = 'light' | 'heavy';

export function isAttackState(state: CombatState): state is AttackState {
  return state === 'light' || state === 'heavy';
}
