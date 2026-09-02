/**
 * SaveV1 — browser persistence for the 试锋 slice.
 *
 * Unlock source of truth is `unlockedSkillIds` only. `skills[]` is a static
 * catalog: writes never mutate its structure; load hydrates `unlock` from the
 * id list (list wins if they disagree).
 *
 * Atomic write: JSON goes to `xiuxian.save.v1.tmp` first, then the live key
 * `xiuxian.save.v1`, then the tmp key is dropped. If the live write throws,
 * the previous live blob is left intact and tmp is kept for recovery.
 * Load prefers live, then tmp.
 */

export type SkillInput = 'light' | 'heavy' | 'skill';

export interface SkillV1 {
  skillId: string;
  unlock: boolean;
  input: SkillInput;
  chainNext: string | null;
  cancelWindowMs: number;
  hitstopMs: number;
  damage: number;
  stun: number;
  animId: string;
}

export interface CharacterV1 {
  hp: number;
  atk: number;
}

export interface CheckpointV1 {
  stageId: string;
  spawnId: string;
}

export interface SaveV1Data {
  saveVersion: 1;
  character: CharacterV1;
  checkpoint: CheckpointV1;
  unlockedSkillIds: string[];
  skills: SkillV1[];
}

export const SAVE_VERSION = 1 as const;
export const LIVE_KEY = 'xiuxian.save.v1';
export const TMP_KEY = 'xiuxian.save.v1.tmp';

/** Static skill catalog. Not mutated by save/unlock. */
export const SKILL_CATALOG: ReadonlyArray<Omit<SkillV1, 'unlock'>> = [
  {
    skillId: 'light_1',
    input: 'light',
    chainNext: 'light_2',
    cancelWindowMs: 80,
    hitstopMs: 70,
    damage: 12,
    stun: 80,
    animId: 'light_1',
  },
  {
    skillId: 'light_2',
    input: 'light',
    chainNext: 'light_3',
    cancelWindowMs: 80,
    hitstopMs: 70,
    damage: 14,
    stun: 90,
    animId: 'light_2',
  },
  {
    skillId: 'light_3',
    input: 'light',
    chainNext: null,
    cancelWindowMs: 100,
    hitstopMs: 100,
    damage: 22,
    stun: 160,
    animId: 'light_3',
  },
  {
    skillId: 'heavy_1',
    input: 'heavy',
    chainNext: null,
    cancelWindowMs: 80,
    hitstopMs: 130,
    damage: 32,
    stun: 220,
    animId: 'heavy_1',
  },
];

const DEFAULT_UNLOCKED = ['light_1', 'light_2', 'light_3', 'heavy_1'] as const;

export function hydrateSkills(unlockedSkillIds: readonly string[]): SkillV1[] {
  const unlocked = new Set(unlockedSkillIds);
  return SKILL_CATALOG.map((skill) => ({
    ...skill,
    unlock: unlocked.has(skill.skillId),
  }));
}

export function assembleSave(
  character: CharacterV1,
  checkpoint: CheckpointV1,
  unlockedSkillIds: readonly string[],
): SaveV1Data {
  const ids = [...unlockedSkillIds];
  return {
    saveVersion: 1,
    character: { hp: character.hp, atk: character.atk },
    checkpoint: { stageId: checkpoint.stageId, spawnId: checkpoint.spawnId },
    unlockedSkillIds: ids,
    skills: hydrateSkills(ids),
  };
}

export const DEFAULT_SAVE: SaveV1Data = assembleSave(
  { hp: 100, atk: 10 },
  { stageId: 'slice_01', spawnId: 'start' },
  DEFAULT_UNLOCKED,
);

function catalogHas(skillId: string): boolean {
  return SKILL_CATALOG.some((s) => s.skillId === skillId);
}

function parseSave(raw: string): SaveV1Data | null {
  try {
    const data = JSON.parse(raw) as Partial<SaveV1Data>;
    if (data.saveVersion !== SAVE_VERSION) {
      return null;
    }
    if (!data.character || typeof data.character.hp !== 'number' || typeof data.character.atk !== 'number') {
      return null;
    }
    if (
      !data.checkpoint ||
      typeof data.checkpoint.stageId !== 'string' ||
      typeof data.checkpoint.spawnId !== 'string'
    ) {
      return null;
    }
    if (!Array.isArray(data.unlockedSkillIds) || !data.unlockedSkillIds.every((id) => typeof id === 'string')) {
      return null;
    }
    const ids = data.unlockedSkillIds.filter((id) => catalogHas(id));
    return assembleSave(data.character, data.checkpoint, ids);
  } catch {
    return null;
  }
}

export function storage(store?: Storage | null): Storage | null {
  if (store) {
    return store;
  }
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

function emptySave(): SaveV1Data {
  return assembleSave(DEFAULT_SAVE.character, DEFAULT_SAVE.checkpoint, DEFAULT_SAVE.unlockedSkillIds);
}

export function loadSave(store?: Storage | null): SaveV1Data {
  const s = storage(store ?? undefined);
  if (!s) {
    return emptySave();
  }
  const live = s.getItem(LIVE_KEY);
  if (live) {
    const parsed = parseSave(live);
    if (parsed) {
      return parsed;
    }
    return emptySave();
  }
  const tmp = s.getItem(TMP_KEY);
  if (tmp) {
    const parsed = parseSave(tmp);
    if (parsed) {
      try {
        s.setItem(LIVE_KEY, JSON.stringify(parsed));
      } catch {
        // keep tmp
      }
      return parsed;
    }
  }
  const fresh = emptySave();
  saveSave(fresh, s);
  return fresh;
}

export function saveSave(data: SaveV1Data, store?: Storage | null): boolean {
  const s = storage(store ?? undefined);
  if (!s) {
    return false;
  }
  if (data.saveVersion !== SAVE_VERSION) {
    return false;
  }
  const payload = assembleSave(data.character, data.checkpoint, data.unlockedSkillIds);
  const json = JSON.stringify(payload);
  try {
    s.setItem(TMP_KEY, json);
  } catch {
    return false;
  }
  try {
    s.setItem(LIVE_KEY, json);
  } catch {
    return false;
  }
  try {
    s.removeItem(TMP_KEY);
  } catch {
    // live is already good
  }
  return true;
}

export function unlockSkill(save: SaveV1Data, skillId: string, store?: Storage | null): SaveV1Data {
  if (!catalogHas(skillId) || save.unlockedSkillIds.includes(skillId)) {
    return save;
  }
  const next = assembleSave(save.character, save.checkpoint, [...save.unlockedSkillIds, skillId]);
  saveSave(next, store ?? undefined);
  return next;
}

export function skillById(save: SaveV1Data, skillId: string): SkillV1 | undefined {
  return save.skills.find((s) => s.skillId === skillId);
}

export function isSkillUnlocked(save: SaveV1Data, skillId: string): boolean {
  return save.unlockedSkillIds.includes(skillId);
}
