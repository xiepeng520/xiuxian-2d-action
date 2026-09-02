/**
 * SaveV1 — browser persistence for the 试锋 slice.
 *
 * Unlock source of truth is `unlockedSkillIds` only. `SKILL_CATALOG` is static
 * (numbers/fields unchanged; no skill_1). Runtime hydrates `save.skills` from
 * the catalog. Disk blobs omit `skills[]`; a leftover array in old blobs is
 * ignored (list still wins).
 *
 * Cultivation this knife is two integers only: `cultivation.kill` and
 * `cultivation.clear`. They are not a skill tree. Missing fields on old v1
 * blobs default to 0 / not-cleared. Unknown saveVersion still refuses and
 * does not clobber live.
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

export interface CultivationV1 {
  kill: number;
  clear: number;
}

export interface StageProgressV1 {
  stageId: string;
  cleared: boolean;
}

export interface SaveV1Data {
  saveVersion: 1;
  character: CharacterV1;
  checkpoint: CheckpointV1;
  stageProgress: StageProgressV1;
  cultivation: CultivationV1;
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

function asInt(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function cultivationTotal(cultivation: CultivationV1): number {
  return cultivation.kill + cultivation.clear;
}

export function assembleSave(
  character: CharacterV1,
  checkpoint: CheckpointV1,
  unlockedSkillIds: readonly string[],
  cultivation: CultivationV1 = { kill: 0, clear: 0 },
  stageProgress: StageProgressV1 = { stageId: checkpoint.stageId, cleared: false },
): SaveV1Data {
  const ids = [...unlockedSkillIds];
  return {
    saveVersion: 1,
    character: { hp: character.hp, atk: character.atk },
    checkpoint: { stageId: checkpoint.stageId, spawnId: checkpoint.spawnId },
    stageProgress: { stageId: stageProgress.stageId, cleared: !!stageProgress.cleared },
    cultivation: { kill: asInt(cultivation.kill), clear: asInt(cultivation.clear) },
    unlockedSkillIds: ids,
    skills: hydrateSkills(ids),
  };
}

export const DEFAULT_SAVE: SaveV1Data = assembleSave(
  { hp: 100, atk: 10 },
  { stageId: 'slice_01', spawnId: 'start' },
  DEFAULT_UNLOCKED,
  { kill: 0, clear: 0 },
  { stageId: 'slice_01', cleared: false },
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
    // Ignore leftover skills[] on disk; hydrate from SKILL_CATALOG only.
    const cultivation: CultivationV1 = {
      kill: asInt(data.cultivation?.kill),
      clear: asInt(data.cultivation?.clear),
    };
    const stageProgress: StageProgressV1 = {
      stageId:
        typeof data.stageProgress?.stageId === 'string'
          ? data.stageProgress.stageId
          : data.checkpoint.stageId,
      cleared: data.stageProgress?.cleared === true,
    };
    return assembleSave(data.character, data.checkpoint, ids, cultivation, stageProgress);
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
  return assembleSave(
    DEFAULT_SAVE.character,
    DEFAULT_SAVE.checkpoint,
    DEFAULT_SAVE.unlockedSkillIds,
    DEFAULT_SAVE.cultivation,
    DEFAULT_SAVE.stageProgress,
  );
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
    // Live blob exists but is unreadable or a foreign version: refuse and
    // do not clobber it. Session continues on an in-memory default.
    return emptySave();
  }
  const tmp = s.getItem(TMP_KEY);
  if (tmp) {
    const parsed = parseSave(tmp);
    if (parsed) {
      try {
        s.setItem(LIVE_KEY, JSON.stringify(toDiskBlob(parsed)));
      } catch {
        // keep tmp; caller still gets a usable save
      }
      return parsed;
    }
  }
  const fresh = emptySave();
  saveSave(fresh, s);
  return fresh;
}

function toDiskBlob(save: SaveV1Data): Omit<SaveV1Data, 'skills'> {
  const { skills: _skills, ...blob } = save;
  return blob;
}

export function saveSave(data: SaveV1Data, store?: Storage | null): boolean {
  const s = storage(store ?? undefined);
  if (!s) {
    return false;
  }
  if (data.saveVersion !== SAVE_VERSION) {
    return false;
  }
  const payload = assembleSave(
    data.character,
    data.checkpoint,
    data.unlockedSkillIds,
    data.cultivation ?? { kill: 0, clear: 0 },
    data.stageProgress ?? { stageId: data.checkpoint.stageId, cleared: false },
  );
  const json = JSON.stringify(toDiskBlob(payload));
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
  const next = assembleSave(
    save.character,
    save.checkpoint,
    [...save.unlockedSkillIds, skillId],
    save.cultivation,
    save.stageProgress,
  );
  saveSave(next, store ?? undefined);
  return next;
}

export function persistProgress(save: SaveV1Data, store?: Storage | null): SaveV1Data {
  const next = assembleSave(
    save.character,
    save.checkpoint,
    save.unlockedSkillIds,
    save.cultivation,
    save.stageProgress,
  );
  saveSave(next, store ?? undefined);
  return next;
}

export function skillById(save: SaveV1Data, skillId: string): SkillV1 | undefined {
  return save.skills.find((s) => s.skillId === skillId);
}

export function isSkillUnlocked(save: SaveV1Data, skillId: string): boolean {
  return save.unlockedSkillIds.includes(skillId);
}
