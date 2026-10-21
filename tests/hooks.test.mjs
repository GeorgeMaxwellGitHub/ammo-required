// Tests the module hooks against Foundry stubs (Foundry itself is not started).
import test from "node:test";
import assert from "node:assert/strict";

const handlers = new Map();
const notes = [];
const settings = { enforce: true, includeNpc: false };

globalThis.Hooks = {
  once: (name, fn) => handlers.set(`once:${name}`, fn),
  on: (name, fn) => handlers.set(name, fn)
};
globalThis.game = {
  user: { isGM: true },
  modules: new Map(),
  settings: { register() {}, get: (id, key) => settings[key] },
  i18n: { localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d)}` }
};
globalThis.ui = { notifications: { warn: (m) => notes.push(["warn", m]), info: (m) => notes.push(["info", m]), error: (m) => notes.push(["error", m]) } };
globalThis.foundry = { utils: { setProperty: (obj, path, value) => { const parts = path.split("."); let o = obj; for (const p of parts.slice(0, -1)) o = o[p] ??= {}; o[parts.at(-1)] = value; } } };
globalThis.ChatMessage = { getSpeakerActor: () => null };

await import("../scripts/ammo-required.mjs");

const weapon = (flags = {}, props = ["amm"]) => ({
  type: "weapon", name: "Longbow", documentName: "Item",
  system: { properties: new Set(props) },
  getFlag: (_id, key) => flags[key],
  setFlag: async (_id, key, v) => { flags[key] = v; },
  unsetFlag: async (_id, key) => { delete flags[key]; }
});
const actor = (type = "character") => ({ type, name: "Elwin" });
const opt = (value, extra = {}) => ({ value, label: value, ...extra });

const run = (item, act, options, current, extra = {}) => {
  const config = { subject: { item, actor: act }, ammunition: current, rolls: [{ options: { ammunition: current } }], ...extra };
  const dialog = { options: { ammunitionOptions: options } };
  const result = handlers.get("dnd5e.preRollAttackV2")(config, dialog);
  return { config, dialog, result };
};

test("an empty choice is removed from the dialog and replaced with an ammunition", () => {
  const { config, dialog, result } = run(weapon(), actor(), [opt(""), opt("a1"), opt("a2")], "");
  assert.equal(result, undefined);
  assert.deepEqual(dialog.options.ammunitionOptions.map((o) => o.value), ["a1", "a2"]);
  assert.equal(config.ammunition, "a1");
  assert.equal(config.rolls[0].options.ammunition, "a1");
});

test("without ammunition the attack is blocked (hook returns false) and a warning is shown", () => {
  notes.length = 0;
  const { result } = run(weapon(), actor(), [], undefined);
  assert.equal(result, false);
  assert.equal(notes[0][0], "warn");
});

test("the GM flag turns the requirement off: the dialog is left alone", () => {
  const opts = [opt(""), opt("a1")];
  const { config, result } = run(weapon({ optional: true }), actor(), opts, "");
  assert.equal(result, undefined);
  assert.equal(opts.length, 2);
  assert.equal(config.ammunition, "");
});

test("NPCs without the setting and weapons without the Ammunition property are untouched", () => {
  const opts = [opt(""), opt("a1")];
  assert.equal(run(weapon(), actor("npc"), opts, "").result, undefined);
  assert.equal(opts.length, 2);
  assert.equal(run(weapon({}, []), actor(), [], undefined).result, undefined);
});

test("config.ammunition === false (ammunition disabled by a macro) is skipped", () => {
  assert.equal(run(weapon(), actor(), [], false).result, undefined);
});

test("the item sheet menu entry is GM-only and only for weapons with ammunition", () => {
  const hook = handlers.get("getHeaderControlsApplicationV2");
  const controls = [];
  hook({ document: weapon() }, controls);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].label, "AMMO_REQUIRED.Toggle.Required");

  const optional = [];
  hook({ document: weapon({ optional: true }) }, optional);
  assert.equal(optional[0].label, "AMMO_REQUIRED.Toggle.Optional");

  const none = [];
  hook({ document: weapon({}, []) }, none);
  assert.equal(none.length, 0);

  game.user.isGM = false;
  hook({ document: weapon() }, none);
  assert.equal(none.length, 0);
  game.user.isGM = true;
});

test("the toggle sets and clears the flag", async () => {
  game.modules.set("ammo-required", {});
  handlers.get("once:ready")();
  const flags = {};
  const item = weapon(flags);
  await game.modules.get("ammo-required").api.setOptional(item, true);
  assert.equal(flags.optional, true);
  await game.modules.get("ammo-required").api.setOptional(item, false);
  assert.equal("optional" in flags, false);
});

test("the card remembers the ammunition and what is left before it is consumed", () => {
  const ammo = { name: "Arrow", img: "a.webp", system: { quantity: 5, properties: new Set() } };
  const updates = [];
  const message = {
    type: "attack", system: { ammunition: "a1" }, speaker: {},
    getAssociatedActor: () => ({ items: { get: () => ammo } }),
    updateSource: (d) => updates.push(d)
  };
  handlers.get("preCreateChatMessage")(message);
  assert.deepEqual(updates[0]["flags.ammo-required.ammo"], { name: "Arrow", img: "a.webp", left: 4 });

  updates.length = 0;
  ammo.system.properties = new Set(["ret"]);
  handlers.get("preCreateChatMessage")(message);
  assert.equal(updates[0]["flags.ammo-required.ammo"].left, 5);

  updates.length = 0;
  handlers.get("preCreateChatMessage")({ ...message, type: "usage" });
  assert.equal(updates.length, 0);
});
