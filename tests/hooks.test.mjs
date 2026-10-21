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

const fakeEl = (tag) => ({
  tag, className: "", children: [], parentElement: null, textContent: "", src: "", alt: "",
  append(...c) { c.forEach((x) => { x.parentElement = this; this.children.push(x); }); },
  insertBefore(n, ref) { n.parentElement = this; this.children.splice(this.children.indexOf(ref), 0, n); },
  querySelector(sel) {
    const cls = sel.replace(/^\./, "");
    for (const c of this.children) {
      if (c.className.split(" ").includes(cls)) return c;
      const deep = c.querySelector(sel);
      if (deep) return deep;
    }
    return null;
  }
});
globalThis.document = { createElement: fakeEl };

const message = (over = {}) => {
  const flags = {};
  const ammo = { name: "Arrow +2", img: "a.webp", system: { quantity: 5, properties: new Set() } };
  return {
    flags, ammo,
    type: "attack", system: { ammunition: "a1", ammunitionItem: ammo }, speaker: {}, isContentVisible: true,
    getAssociatedActor: () => ({ items: { get: () => ammo } }),
    getAssociatedItem: () => ({ name: "Longbow" }),
    getFlag: (_id, key) => flags[key],
    updateSource(d) { flags.ammo = d["flags.ammo-required.ammo"]; },
    ...over
  };
};

test("the card remembers weapon, ammunition and what is left before it is consumed", () => {
  const m = message();
  handlers.get("preCreateChatMessage")(m);
  assert.deepEqual(m.flags.ammo, { weapon: "Longbow", name: "Arrow +2", img: "a.webp", left: 4 });

  const retrievable = message();
  retrievable.ammo.system.properties = new Set(["ret"]);
  handlers.get("preCreateChatMessage")(retrievable);
  assert.equal(retrievable.flags.ammo.left, 5);

  const noAmmo = message({ system: { ammunition: null } });
  handlers.get("preCreateChatMessage")(noAmmo);
  assert.equal(noAmmo.flags.ammo, undefined);
});

test("the chat row is inserted above the roll, shows weapon, ammunition and remainder, and is added once", () => {
  const m = message();
  handlers.get("preCreateChatMessage")(m);

  const html = fakeEl("div");
  const card = fakeEl("div"); card.className = "chat-card";
  const roll = fakeEl("div"); roll.className = "dice-roll";
  card.append(roll); html.append(card);

  handlers.get("dnd5e.renderChatMessage")(m, html);
  handlers.get("renderChatMessageHTML")(m, html);
  const rows = card.children.filter((c) => c.className.includes("ammo-required"));
  assert.equal(rows.length, 1);
  assert.ok(card.children.indexOf(rows[0]) < card.children.indexOf(roll));
  const text = rows[0].children.at(-1).textContent;
  assert.match(text, /^AMMO_REQUIRED\.Chat\.FiredLeft /);
  assert.match(text, /"weapon":"Longbow".*"ammo":"Arrow \+2".*"n":4/);
});

test("the row still renders without the snapshot, from live message data", () => {
  const html = fakeEl("div");
  const card = fakeEl("div"); card.className = "chat-card"; html.append(card);
  handlers.get("dnd5e.renderChatMessage")(message(), html);
  const row = card.children.find((c) => c.className.includes("ammo-required"));
  assert.ok(row);
  assert.match(row.children.at(-1).textContent, /Longbow/);
});

test("nothing is shown for messages without ammunition", () => {
  const html = fakeEl("div");
  handlers.get("dnd5e.renderChatMessage")(message({ system: { ammunition: null } }), html);
  assert.equal(html.children.length, 0);
});
