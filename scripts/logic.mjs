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

/**
 * Merges everything known about a shot into one description for the chat card.
 * Live data wins over the snapshot taken when the message was created (the snapshot is the only
 * source of the remainder, and a fallback when an item has been deleted or cannot be resolved).
 * @param {object} data
 * @param {{name?: string}|null} [data.weaponItem]               Weapon the attack was made with.
 * @param {{name?: string, img?: string}|null} [data.ammoItem]   Ammunition item (may be a copy of a destroyed one).
 * @param {{weapon?: string, name?: string, img?: string, left?: number}|null} [data.snapshot]
 * @returns {{weapon: string, ammo: string, img: string, left: number|null}|null}  null when no ammunition was used.
 */
export function describeShot({ weaponItem, ammoItem, snapshot } = {}) {
  const ammo = ammoItem?.name || snapshot?.name;
  if (!ammo) return null;
  return {
    weapon: weaponItem?.name || snapshot?.weapon || "",
    ammo,
    img: ammoItem?.img || snapshot?.img || "",
    left: Number.isFinite(snapshot?.left) ? snapshot.left : null
  };
}
