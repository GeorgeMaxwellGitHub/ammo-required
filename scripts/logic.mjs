/**
 * Pure module logic with no Foundry calls, so it can be unit-tested.
 */

/**
 * Decides what to do with the ammunition options in the attack dialog.
 * @param {object} data
 * @param {{value: string, label: string, disabled?: boolean}[]} data.options  Options from the attack dialog (an empty one may come first).
 * @param {string|undefined} data.current                                      Current value (including the one remembered from the last attack).
 * @returns {{block: boolean, options: object[], value: string}}
 *   block: nothing to fire; options: options without the empty one; value: the selected ammunition.
 */
export function resolveAmmunition({ options = [], current } = {}) {
  const real = options.filter((o) => o && o.value);
  const usable = real.filter((o) => !o.disabled);
  if (!usable.length) return { block: true, options: [], value: "" };
  const value = usable.some((o) => o.value === current) ? current : usable[0].value;
  return { block: false, options: real, value };
}

/**
 * Whether the requirement applies to this weapon.
 * @param {object} data
 * @param {boolean} data.enforce        World setting "Require ammunition".
 * @param {boolean} data.includeNpc     World setting "Apply to NPCs".
 * @param {string} data.itemType        Item type.
 * @param {boolean} data.hasAmmoProp    Whether the weapon has the Ammunition property.
 * @param {string|undefined} data.actorType  Owner actor type (character, npc, ...); undefined when there is no owner.
 * @param {boolean} data.optional       The GM turned the requirement off for this weapon.
 * @returns {boolean}
 */
export function isEnforced({ enforce, includeNpc, itemType, hasAmmoProp, actorType, optional }) {
  if (!enforce || optional) return false;
  if (itemType !== "weapon" || !hasAmmoProp) return false;
  if (actorType === "character") return true;
  return actorType === "npc" && !!includeNpc;
}

/**
 * Ammunition left after a shot.
 * @param {number} quantity   Quantity before the shot.
 * @param {boolean} consumed  Whether the ammunition is consumed (retrievable ammunition is not).
 * @returns {number}
 */
export function ammoLeft(quantity, consumed) {
  return Math.max(0, (Number(quantity) || 0) - (consumed ? 1 : 0));
}
