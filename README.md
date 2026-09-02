# 御剑 · 试锋

修仙 2D 横版动作切片。

## 怎么跑

cd xiuxian-2d-action
npm install
npm run dev

http://localhost:5173

npm run build

## 操作说明

- A/D 或方向键：移动
- W/上/Space：跳跃（攻击可缓冲）
- J：轻击  K：重击  R：重开

受伤硬直中无法起手攻击。数值优先存档技能，否则 config.ts。

## 切片范围

slice_01/start：地面+浮台、木桩、HUD、Hitstop。不含完整关卡/联网/外部贴图。

## 存档

localStorage xiuxian.save.v1 先写 .tmp 再覆盖正式键。见 docs/save-v1.json。
