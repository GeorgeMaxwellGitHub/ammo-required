import { ammoLeft, isEnforced, resolveAmmunition } from "./logic.mjs";

const ID = "ammo-required";
const TOGGLE_ACTION = `${ID}-toggle`;

/* -------------------------------------------- */
/*  Settings and API                             */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(ID, "enforce", {
    name: "AMMO_REQUIRED.Settings.Enforce.Name",
    hint: "AMMO_REQUIRED.Settings.Enforce.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(ID, "includeNpc", {
    name: "AMMO_REQUIRED.Settings.IncludeNpc.Name",
    hint: "AMMO_REQUIRED.Settings.IncludeNpc.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});

Hooks.once("ready", () => {
  const module = game.modules.get(ID);
  if (module) module.api = { setOptional };
});

/**
 * Turns the ammunition requirement on or off for a specific weapon (GM only).
 * Also available from the console: game.modules.get("ammo-required").api.setOptional(item, true)
 * @param {Item} item
 * @param {boolean} optional  true: ammunition is not required.
 */
async function setOptional(item, optional) {
  if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("AMMO_REQUIRED.Notify.GmOnly"));
  try {
    if (optional) await item.setFlag(ID, "optional", true);
    else await item.unsetFlag(ID, "optional");
    ui.notifications.info(game.i18n.format(optional ? "AMMO_REQUIRED.Notify.Optional" : "AMMO_REQUIRED.Notify.Required", { weapon: item.name }));
  } catch (err) {
    console.error(`${ID} | could not change the weapon setting`, err);
    ui.notifications.error(game.i18n.localize("AMMO_REQUIRED.Notify.Failed"));
  }
}

/* -------------------------------------------- */
/*  Attack dialog                                  */
/* -------------------------------------------- */

Hooks.on("dnd5e.preRollAttackV2", (config, dialog) => {
  try {
    const activity = config?.subject;
    const item = activity?.item;
    const actor = activity?.actor;
    if (!item || config.ammunition === false) return;

    const enforced = isEnforced({
      enforce: game.settings.get(ID, "enforce"),
      includeNpc: game.settings.get(ID, "includeNpc"),
      itemType: item.type,
      hasAmmoProp: !!item.system?.properties?.has?.("amm"),
      actorType: actor?.type,
      optional: !!item.getFlag(ID, "optional")
    });
    if (!enforced) return;

    const options = dialog?.options?.ammunitionOptions;
    const result = resolveAmmunition({ options: Array.isArray(options) ? options : [], current: config.ammunition });
    if (result.block) {
      ui.notifications.warn(game.i18n.format("AMMO_REQUIRED.Notify.NoAmmo", { actor: actor.name, weapon: item.name }));
      return false;
    }

    // Remove the empty option in the dialog's own array and select a real ammunition.
    options.splice(0, options.length, ...result.options);
    config.ammunition = result.value;
    if (config.rolls?.[0]) foundry.utils.setProperty(config.rolls[0], "options.ammunition", result.value);
  } catch (err) {
    console.error(`${ID} | ammunition check failed, attack not blocked`, err);
  }
});

/* -------------------------------------------- */
/*  Attack card in chat                       */
/* -------------------------------------------- */

// Remember the ammunition and what is left at the moment of the shot: it has not been consumed yet, so the remainder is computed here.
Hooks.on("preCreateChatMessage", (message) => {
  try {
    if (message.type !== "attack") return;
    const id = message.system?.ammunition;
    if (!id) return;
    let actor = null;
    try { actor = message.getAssociatedActor?.(); } catch { /* fallback below */ }
    actor ??= ChatMessage.getSpeakerActor(message.speaker);
    const ammo = actor?.items.get(id);
    if (!ammo) return;
    const consumed = !ammo.system.properties?.has?.("ret");
    message.updateSource({
      [`flags.${ID}.ammo`]: { name: ammo.name, img: ammo.img, left: ammoLeft(ammo.system.quantity, consumed) }
    });
  } catch (err) {
    console.warn(`${ID} | could not remember the ammunition for the card`, err);
  }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  try {
    const ammo = message.getFlag(ID, "ammo");
    if (!ammo || message.isContentVisible === false) return;
    const host = html.querySelector(".chat-card") ?? html.querySelector(".message-content") ?? html;
    if (host.querySelector(".ammo-required")) return;

    const row = document.createElement("section");
    row.className = "icon-row ammo-required";
    const img = document.createElement("img");
    img.src = ammo.img;
    img.alt = "";
    const text = document.createElement("span");
    text.textContent = `${game.i18n.localize("AMMO_REQUIRED.Chat.Ammunition")}: ${ammo.name} `
      + `(${game.i18n.format("AMMO_REQUIRED.Chat.Left", { n: ammo.left })})`;
    row.append(img, text);
    host.append(row);
  } catch (err) {
    console.warn(`${ID} | could not show the ammunition in the card`, err);
  }
});

/* -------------------------------------------- */
/*  GM toggle in the item sheet   */
/* -------------------------------------------- */

Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
  const item = app.document;
  if (!game.user.isGM || item?.documentName !== "Item" || item.type !== "weapon") return;
  if (!item.system?.properties?.has?.("amm")) return;
  if (controls.some((c) => c.action === TOGGLE_ACTION)) return;

  const optional = !!item.getFlag(ID, "optional");
  controls.push({
    icon: optional ? "fa-solid fa-lock-open" : "fa-solid fa-lock",
    label: optional ? "AMMO_REQUIRED.Toggle.Optional" : "AMMO_REQUIRED.Toggle.Required",
    action: TOGGLE_ACTION,
    visible: () => game.user.isGM,
    onClick: () => setOptional(item, !optional)
  });
});
