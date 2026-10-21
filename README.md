# Required Ammunition (ammo-required)

A module for Foundry VTT 14 and the D&D 5e system 6.0.x. You cannot fire a bow without arrows.

## What it does

- In the attack roll dialog, weapons with the Ammunition property have no empty option: you cannot pick "no ammunition".
- If there is no usable ammunition at all (none in the inventory, or all with quantity 0), the attack is blocked with a warning.
- The same applies to quick rolls without the dialog (Shift-click): an empty choice remembered from the last attack is replaced with a usable ammunition.
- Every attack message in chat gets a line above the roll result, for example "Fired Longbow with Arrow +2 (7 left)". It shows the weapon and the ammunition that was actually chosen, so the GM can see at a glance what the player used. The ammunition name is highlighted in purple so it stands out; the colour is the CSS variable `--ammo-required-color` (for example, set it in a custom CSS module). The remainder is recorded at the moment of the shot.
- The module does not check that the ammunition type matches the weapon (a pistol bullet in a bow goes through). That is left to the GM, who reviews the chat line and rolls the attack back by hand if the choice is wrong.
- The GM can turn the requirement off for a specific weapon, for example a bow that conjures its own arrows into a quiver.

## Settings (Game Settings → Configure Settings → Module Settings)

| Setting | Default | What it does |
|---|---|---|
| Require ammunition | on | Master switch for the module. |
| Apply to NPCs | off | Monster weapons usually have no ammunition items, so NPC attacks are not checked by default. |

## Turning the requirement off for one weapon (GM)

Open the weapon sheet (on a character), open the "⋮" menu in the window header and click "Ammunition required (click to stop requiring)". The lock turns into an open lock. Click again to require ammunition once more. Only the GM sees this entry, and only on weapons with the Ammunition property.

The flag is stored on the item owned by that character, not in the compendium.

Fallback from the browser console (F12):

```js
game.modules.get("ammo-required").api.setOptional(item, true)   // not required
game.modules.get("ammo-required").api.setOptional(item, false)  // required
```

## Testing in a test world

You need a character with a longbow (Ammunition property enabled) and an "Arrow" item (consumable, type "Ammunition").

1. Arrows in the inventory: the attack dialog has no empty option, and the quantity drops by 1 after the roll.
2. Set the arrow quantity to 0: the attack is blocked and a warning appears.
3. Delete the arrows from the inventory entirely: the attack is blocked too.
4. Fire once with arrows selected, then Shift-click without the dialog: a usable ammunition is substituted.
5. Chat: above the roll result there is a line with the weapon, the arrow and the number left. Pick a +2 arrow once and check the line says so.
6. The GM turns the requirement off for the bow with 0 arrows: the attack goes through as before.
7. An NPC attack with a bow is not blocked (unless "Apply to NPCs" is on).

If something does not work, open the console (F12) and look for red lines starting with `ammo-required |`.

## Installation

In Foundry: Game Settings → Add-on Modules → Install Module, and paste this into the Manifest URL field:

```
https://github.com/GeorgeMaxwellGitHub/ammo-required/releases/latest/download/module.json
```

## Development

Tests run against Foundry stubs, without Foundry:

```bash
node --test tests/
```

Built against dnd5e 6.0.6 sources: the `dnd5e.preRollAttackV2` hook, the `dialog.options.ammunitionOptions` array and the `system.ammunition` field of the attack message.

The module ships English and Russian translations (`lang/`).
