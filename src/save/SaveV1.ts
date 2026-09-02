/**
 * SaveV1 — browser persistence for the 试锋 slice.
 *
 * Atomic write: we write JSON to `xiuxian.save.v1.tmp` first, then copy to
 * `xiuxian.save.v1`, then drop the tmp key. In a real filesystem this would be
 * write-tmp + fsync + rename; localStorage is already per-key atomic for a
 * single setItem, so the tmp key is belt-and-suspenders against a crash
 * between serialization and the live-key write. Load prefers the live key and
 * falls back to tmp if the live blob is missing/corrupt.
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
const LIVE_KEY = 'xiuxian.save.v1';
const TMP_KEY = 'xiuxian.save.v1.tmp';

export const DEFAULT_SAVE: SaveV1Data = {
  saveVersion: 1,
  character: { hp: 100, atk: 10 },
  checkpoint: { stageId: 'slice_01', spawnId: 'start' },
  unlockedSkillIds: ['light_1', 'light_2', 'light_3', 'heavy_1'],
  skills: [
    {
      skillId: 'light_1',
      unlock: true,
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
      unlock: true,
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
      unlock: true,
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
      unlock: true,
      input: 'heavy',
      chainNext: null,
      cancelWindowMs: 80,
      hitstopMs: 130,
      damage: 32,
      stun: 220,
      animId: 'heavy_1',
    },
  ],
};

function isSkill(value: unknown): value is SkillV1 {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const s = value as Record<string, unknown>;
  return (
    typeof s.skillId === 'string' &&
    typeof s.unlock === 'boolean' &&
    (s.input === 'light' || s.input === 'heavy' || s.input === 'skill') &&
    (s.chainNext === null || typeof s.chainNext === 'string') &&
    typeof s.cancelWindowMs === 'number' &&
    typeof s.hitstopMs === 'number' &&
    typeof s.damage === 'number' &&
    typeof s.stun === 'number' &&
    typeof s.animId === 'string'
  );
}

function parseSave(raw: string): SaveV1Data | null {
  try {
    const data = JSON.parse(raw) as Partial<SaveV1Data>;
    if (data.saveVersion !== 1) {
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
    if (!Array.isArray(data.skills) || !data.skills.every(isSkill)) {
      return null;
    }
    return {
      saveVersion: 1,
      character: { hp: data.character.hp, atk: data.character.atk },
      checkpoint: { stageId: data.checkpoint.stageId, spawnId: data.checkpoint.spawnId },
      unlockedSkillIds: [...data.unlockedSkillIds],
      skills: data.skills.map((s) => ({ ...s })),
    };
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): SaveV1Data {
  const store = storage();
  if (!store) {
    return structuredClone(DEFAULT_SAVE);
  }
  const live = store.getItem(LIVE_KEY);
  if (live) {
    const parsed = parseSave(live);
    if (parsed) {
      return parsed;
    }
  }
  const tmp = store.getItem(TMP_KEY);
  if (tmp) {
    const parsed = parseSave(tmp);
    if (parsed) {
      store.setItem(LIVE_KEY, tmp);
      return parsed;
    }
  }
  const fresh = structuredClone(DEFAULT_SAVE);
  saveSave(fresh);
  return fresh;
}

export function saveSave(data: SaveV1Data): void {
  const store = storage();
  if (!store) {
    return;
  }
  const json = JSON.stringify(data);
  store.setItem(TMP_KEY, json);
  store.setItem(LIVE_KEY, json);
  store.removeItem(TMP_KEY);
}

export function skillById(save: SaveV1Data, skillId: string): SkillV1 | undefined {
  return save.skills.find((s) => s.skillId === skillId);
}

export function isSkillUnlocked(save: SaveV1Data, skillId: string): boolean {
  const skill = skillById(save, skillId);
  if (skill?.unlock) {
    return true;
  }
  return save.unlockedSkillIds.includes(skillId);
}
