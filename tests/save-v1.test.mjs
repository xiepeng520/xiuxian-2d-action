import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SAVE,
  LIVE_KEY,
  TMP_KEY,
  cultivationTotal,
  hydrateSkills,
  isSkillUnlocked,
  loadSave,
  persistProgress,
  saveSave,
  unlockSkill,
  SKILL_CATALOG,
} from '../.test-out/save/SaveV1.js';

class MemoryStorage {
  constructor() {
    this.data = new Map();
    this.failOn = null;
    this.length = 0;
  }
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }
  setItem(key, value) {
    if (this.failOn === key) {
      throw new Error(`fail ${key}`);
    }
    this.data.set(key, value);
    this.length = this.data.size;
  }
  removeItem(key) {
    this.data.delete(key);
    this.length = this.data.size;
  }
  clear() {
    this.data.clear();
    this.length = 0;
  }
  key(index) {
    return [...this.data.keys()][index] ?? null;
  }
}

test('isSkillUnlocked uses the id list only', () => {
  const save = {
    ...DEFAULT_SAVE,
    unlockedSkillIds: ['light_1'],
    skills: hydrateSkills(['light_1']).map((s) =>
      s.skillId === 'heavy_1' ? { ...s, unlock: true } : s,
    ),
  };
  assert.equal(isSkillUnlocked(save, 'light_1'), true);
  assert.equal(isSkillUnlocked(save, 'heavy_1'), false);
});

test('load hydrates unlock flags from the list (list wins)', () => {
  const store = new MemoryStorage();
  store.setItem(
    LIVE_KEY,
    JSON.stringify({
      saveVersion: 1,
      character: { hp: 80, atk: 12 },
      checkpoint: { stageId: 'slice_01', spawnId: 'gate' },
      unlockedSkillIds: ['light_1'],
      skills: hydrateSkills(['light_1', 'heavy_1']).map((s) => ({ ...s, unlock: true })),
    }),
  );
  const loaded = loadSave(store);
  assert.deepEqual(loaded.unlockedSkillIds, ['light_1']);
  assert.equal(loaded.skills.find((s) => s.skillId === 'light_1')?.unlock, true);
  assert.equal(loaded.skills.find((s) => s.skillId === 'heavy_1')?.unlock, false);
  assert.equal(loaded.skills.find((s) => s.skillId === 'heavy_1')?.damage, 32);
});

test('unknown saveVersion is rejected', () => {
  const store = new MemoryStorage();
  const foreign = { ...DEFAULT_SAVE, saveVersion: 99, unlockedSkillIds: ['light_1'] };
  store.setItem(LIVE_KEY, JSON.stringify(foreign));
  const loaded = loadSave(store);
  assert.equal(loaded.saveVersion, 1);
  assert.deepEqual(loaded.unlockedSkillIds, DEFAULT_SAVE.unlockedSkillIds);
  const live = JSON.parse(store.getItem(LIVE_KEY));
  assert.equal(live.saveVersion, 99);
  assert.deepEqual(live.unlockedSkillIds, ['light_1']);
});

test('unlockSkill only appends the id list and persists', () => {
  const store = new MemoryStorage();
  const start = {
    ...DEFAULT_SAVE,
    unlockedSkillIds: ['light_1'],
    skills: hydrateSkills(['light_1']),
  };
  saveSave(start, store);
  const next = unlockSkill(start, 'heavy_1', store);
  assert.deepEqual(next.unlockedSkillIds, ['light_1', 'heavy_1']);
  assert.equal(next.skills.find((s) => s.skillId === 'heavy_1')?.unlock, true);
  const reloaded = loadSave(store);
  assert.deepEqual(reloaded.unlockedSkillIds, ['light_1', 'heavy_1']);
});

test('failed live write keeps the previous live blob', () => {
  const store = new MemoryStorage();
  const first = {
    ...DEFAULT_SAVE,
    unlockedSkillIds: ['light_1'],
    skills: hydrateSkills(['light_1']),
  };
  assert.equal(saveSave(first, store), true);
  store.failOn = LIVE_KEY;
  const second = {
    ...DEFAULT_SAVE,
    unlockedSkillIds: ['light_1', 'heavy_1'],
    skills: hydrateSkills(['light_1', 'heavy_1']),
  };
  assert.equal(saveSave(second, store), false);
  store.failOn = null;
  const live = JSON.parse(store.getItem(LIVE_KEY));
  assert.deepEqual(live.unlockedSkillIds, ['light_1']);
  assert.equal(store.getItem(TMP_KEY) !== null, true);
});

test('old v1 blobs default cultivation and stageProgress to zeros', () => {
  const store = new MemoryStorage();
  store.setItem(
    LIVE_KEY,
    JSON.stringify({
      saveVersion: 1,
      character: { hp: 100, atk: 10 },
      checkpoint: { stageId: 'slice_01', spawnId: 'start' },
      unlockedSkillIds: ['light_1'],
    }),
  );
  const loaded = loadSave(store);
  assert.deepEqual(loaded.cultivation, { kill: 0, clear: 0, boss: 0 });
  assert.equal(loaded.stageProgress.cleared, false);
  assert.equal(cultivationTotal(loaded.cultivation), 0);
});

test('persistProgress writes kill/clear and does not touch skill ids', () => {
  const store = new MemoryStorage();
  const start = loadSave(store);
  start.cultivation.kill = 8;
  start.cultivation.clear = 15;
  start.cultivation.boss = 40;
  start.stageProgress.cleared = true;
  persistProgress(start, store);
  const loaded = loadSave(store);
  assert.deepEqual(loaded.cultivation, { kill: 8, clear: 15, boss: 40 });
  assert.equal(loaded.stageProgress.cleared, true);
  assert.deepEqual(loaded.unlockedSkillIds, start.unlockedSkillIds);
});

test('unlockSkill preserves cultivation', () => {
  const store = new MemoryStorage();
  const start = {
    ...DEFAULT_SAVE,
    unlockedSkillIds: ['light_1'],
    skills: hydrateSkills(['light_1']),
    cultivation: { kill: 8, clear: 0, boss: 0 },
  };
  saveSave(start, store);
  const next = unlockSkill(start, 'heavy_1', store);
  assert.deepEqual(next.cultivation, { kill: 8, clear: 0, boss: 0 });
});

test('disk blob omits skills[]', () => {
  const store = new MemoryStorage();
  saveSave(DEFAULT_SAVE, store);
  const live = JSON.parse(store.getItem(LIVE_KEY));
  assert.equal(Object.hasOwn(live, 'skills'), false);
  assert.deepEqual(live.unlockedSkillIds, ['light_1', 'light_2', 'light_3', 'heavy_1']);
});

test('old blob skills[] is ignored; list and catalog win', () => {
  const store = new MemoryStorage();
  store.setItem(
    LIVE_KEY,
    JSON.stringify({
      saveVersion: 1,
      character: { hp: 100, atk: 10 },
      checkpoint: { stageId: 'slice_01', spawnId: 'start' },
      unlockedSkillIds: ['light_1'],
      skills: [
        {
          skillId: 'heavy_1',
          unlock: true,
          input: 'heavy',
          chainNext: null,
          cancelWindowMs: 1,
          hitstopMs: 1,
          damage: 999,
          stun: 1,
          animId: 'fake',
        },
      ],
    }),
  );
  const loaded = loadSave(store);
  assert.equal(isSkillUnlocked(loaded, 'heavy_1'), false);
  assert.equal(isSkillUnlocked(loaded, 'light_1'), true);
  const heavy = loaded.skills.find((s) => s.skillId === 'heavy_1');
  assert.equal(heavy.unlock, false);
  assert.equal(heavy.damage, 32);
  assert.equal(loaded.skills.some((s) => s.skillId === 'skill_1'), true);
  assert.equal(isSkillUnlocked(loaded, 'skill_1'), false);
});
test('old blob missing cultivation.boss defaults to 0', () => {
  const store = new MemoryStorage();
  store.setItem(
    LIVE_KEY,
    JSON.stringify({
      saveVersion: 1,
      character: { hp: 100, atk: 10 },
      checkpoint: { stageId: 'slice_01', spawnId: 'start' },
      unlockedSkillIds: ['light_1'],
      cultivation: { kill: 16, clear: 15 },
    }),
  );
  const loaded = loadSave(store);
  assert.deepEqual(loaded.cultivation, { kill: 16, clear: 15, boss: 0 });
  assert.equal(cultivationTotal(loaded.cultivation), 31);
});
test('default unlock is four basics; skill_1 stays locked', () => {
  assert.deepEqual(DEFAULT_SAVE.unlockedSkillIds, ['light_1', 'light_2', 'light_3', 'heavy_1']);
  assert.equal(isSkillUnlocked(DEFAULT_SAVE, 'skill_1'), false);
  const row = SKILL_CATALOG.find((s) => s.skillId === 'skill_1');
  assert.equal(row.input, 'skill');
  assert.equal(row.chainNext, null);
  assert.equal(row.cancelWindowMs, 100);
  assert.equal(row.hitstopMs, 150);
  assert.equal(row.damage, 40);
  assert.equal(row.stun, 200);
  assert.equal(row.animId, 'skill_1');
});

test('total >= 80 unlocks skill_1; realm and xiuwei stay off disk', () => {
  const store = new MemoryStorage();
  const start = {
    ...DEFAULT_SAVE,
    cultivation: { kill: 40, clear: 0, boss: 40 },
  };
  persistProgress(start, store);
  const live = JSON.parse(store.getItem(LIVE_KEY));
  assert.equal(live.unlockedSkillIds.includes('skill_1'), true);
  assert.equal(Object.hasOwn(live, 'realm'), false);
  assert.equal(Object.hasOwn(live.character, 'xiuwei'), false);
  assert.equal(Object.hasOwn(live, 'skills'), false);
  const loaded = loadSave(store);
  assert.equal(isSkillUnlocked(loaded, 'skill_1'), true);
  assert.equal(cultivationTotal(loaded.cultivation), 80);
});

test('total 79 does not unlock skill_1; 160 adds no extra id', () => {
  const store = new MemoryStorage();
  persistProgress({ ...DEFAULT_SAVE, cultivation: { kill: 24, clear: 15, boss: 40 } }, store);
  assert.equal(JSON.parse(store.getItem(LIVE_KEY)).unlockedSkillIds.includes('skill_1'), false);
  persistProgress({ ...DEFAULT_SAVE, cultivation: { kill: 80, clear: 45, boss: 40 } }, store);
  const ids = JSON.parse(store.getItem(LIVE_KEY)).unlockedSkillIds;
  assert.equal(ids.includes('skill_1'), true);
  assert.equal(ids.filter((id) => id === 'skill_1').length, 1);
  assert.deepEqual(ids.filter((id) => !['light_1','light_2','light_3','heavy_1','skill_1'].includes(id)), []);
});

