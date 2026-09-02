export type CombatState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'light'
  | 'heavy'
  | 'skill'
  | 'hurt'
  | 'dead';

export type AttackState = 'light' | 'heavy' | 'skill';

export function isAttackState(state: CombatState): state is AttackState {
  return state === 'light' || state === 'heavy' || state === 'skill';
}
