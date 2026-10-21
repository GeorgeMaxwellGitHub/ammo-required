import test from "node:test";
import assert from "node:assert/strict";
import { ammoLeft, isEnforced, resolveAmmunition } from "../scripts/logic.mjs";

const opt = (value, extra = {}) => ({ value, label: value, ...extra });

test("the empty option is removed and a valid selection is kept", () => {
  const r = resolveAmmunition({ options: [opt(""), opt("a1"), opt("a2")], current: "a2" });
  assert.deepEqual(r, { block: false, options: [opt("a1"), opt("a2")], value: "a2" });
});

test("an empty current value is replaced with the first usable ammunition", () => {
  const r = resolveAmmunition({ options: [opt(""), opt("a1"), opt("a2")], current: "" });
  assert.equal(r.value, "a1");
});

test("a remembered ammunition that no longer exists is replaced with a usable one", () => {
  const r = resolveAmmunition({ options: [opt(""), opt("a1")], current: "gone" });
  assert.equal(r.value, "a1");
});

test("ammunition with zero quantity (disabled) is not selected by default", () => {
  const r = resolveAmmunition({ options: [opt(""), opt("a0", { disabled: true }), opt("a1")], current: "a0" });
  assert.equal(r.value, "a1");
  assert.equal(r.options.length, 2);
});

test("no options at all: the attack is blocked", () => {
  assert.equal(resolveAmmunition({ options: [], current: undefined }).block, true);
  assert.equal(resolveAmmunition().block, true);
});

test("all ammunition is used up: the attack is blocked", () => {
  const r = resolveAmmunition({ options: [opt(""), opt("a0", { disabled: true })], current: "a0" });
  assert.equal(r.block, true);
});

const base = { enforce: true, includeNpc: false, itemType: "weapon", hasAmmoProp: true, actorType: "character", optional: false };

test("the requirement applies to a character's weapon with the Ammunition property", () => {
  assert.equal(isEnforced(base), true);
});

test("a disabled setting, the GM flag, a non-weapon or a missing property turn the requirement off", () => {
  assert.equal(isEnforced({ ...base, enforce: false }), false);
  assert.equal(isEnforced({ ...base, optional: true }), false);
  assert.equal(isEnforced({ ...base, itemType: "consumable" }), false);
  assert.equal(isEnforced({ ...base, hasAmmoProp: false }), false);
});

test("NPCs and ownerless items: only by setting", () => {
  assert.equal(isEnforced({ ...base, actorType: "npc" }), false);
  assert.equal(isEnforced({ ...base, actorType: "npc", includeNpc: true }), true);
  assert.equal(isEnforced({ ...base, actorType: undefined, includeNpc: true }), false);
});

test("ammunition left", () => {
  assert.equal(ammoLeft(8, true), 7);
  assert.equal(ammoLeft(8, false), 8);
  assert.equal(ammoLeft(0, true), 0);
  assert.equal(ammoLeft(undefined, true), 0);
});
