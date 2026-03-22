# Juju Simulator -- Complete Mechanics Reference

This document describes every mechanic implemented in the Juju dungeon-crawler simulator as of the latest codebase. Written for game designers who need to compare the simulator against the physical rulebook and spot discrepancies.

Source files covered:
- `js/data.js` -- hero definitions, card pools, equipment, hydra heads, relics
- `js/hex.js` -- hex grid model, pathfinding, exploration direction AI
- `js/engine.js` -- all game logic

---

## 1. Game Setup

### initState()

Creates the global game state `G` and returns it.

**Tile Deck:** Fixed distribution of 36 tiles -- 12 Wonder, 12 Common, 12 Dread. The deck is shuffled. This is not configurable through tweaks (tile percentages were removed).

**Hex Map:** `createHexMap(3)` creates a confined hex grid with radius 3 (axial coordinates). The map can hold up to 37 hexes (1 center + 6 + 12 + 18). The entrance tile is placed at `(0, 0)` with type `'entrance'`.

**Hero Initialization:** Each of the four heroes (Juju, Gigi, Lulu, Eggo) is initialized with:
- `hp: 1` (binary alive/KO)
- `pos: {q:0, r:0}` (start at entrance)
- Empty arrays for equipment, followers, stalkers, heldRelics
- All 4 skills set to `'ready'`
- Flags: `ko: false`, `talentUsedThisTurn: false`, `dodgeActive: false`, `giftedFlame: false`, `runningToHydra: false`
- Gil set to 0 (Gil system is optional, controlled by tweaks)

Base STR values: Juju 3, Gigi 2, Lulu 1, Eggo 2 (tweakable).

Flame faces per hero (which die faces trigger Flame):
- Juju: 4, 5, 6
- Gigi: 2, 3, 4
- Lulu: 1, 3, 6
- Eggo: 1, 2, 3

**Relic Pool:** 4 relics (Hero, Ranger, Wizard, Rogue) shuffled. Each relic is assigned an `owner` field matching a hero id.

**Card Decks:** Wonder, Mishap, Misfortune, and Legendary Equipment decks are each created as shuffled index arrays into their respective data arrays.

**Other state:** `enemiesOnBoard: []`, `crownUsedThisRound: false`, `hydraMaxHeads: 6`, `exitPlaced: false`, `exitRevealed: false`, `hydraActive: false`.

---

## 2. Turn Structure

### runTurn()

Called once per hero turn. Flow:

1. **Select hero** from `G.heroes[G.currentHero]`. Increment `G.turn`. Reset `talentUsedThisTurn`, `dodgeActive`, and `ko` to false.

2. **Grimoire Failsafe:** If the active hero holds the Ancestral Grimoire (Lulu's relic) AND has 0 ready skills, recharge 1 skill. Source: `'grimoire_failsafe'`.

3. **Gil Spending:** If at entrance and Gil system is enabled, spend Gil (see Gil section).

4. **Wizard Hat:** If equipped, roll 1d6. On 4+, recharge 1 skill. Source: `'wizard_hat'`.

5. **Herbalist (cross-turn):** Gigi checks whether to use Herbalist regardless of whose turn it is. If ready and `shouldUseSkill` approves, Gigi recharges 1 skill for the hero with the most exhausted skills (ties broken by favoring the active hero). Source: `'herbalist'`.

6. **Copycat to Herbalist:** If the active hero is Eggo and has Copycat ready, and Gigi has Herbalist ready, and Eggo has 2+ exhausted skills, Eggo uses Copycat to copy Herbalist. Recharges 1 skill for the neediest hero.

7. **Wild Call (Gigi only):** If the active hero is Gigi and `shouldUseSkill` approves, use Wild Call. Draws through the Wonder deck until a follower is found. Non-followers are returned and the deck is reshuffled. If a follower is found, it joins Gigi and triggers Forest Amulet bonus draw if applicable.

8. **Hound Following:** If `hero.houndFollowing` is set from a previous turn, the Hound catches up and forces combat. If the hero is KO'd or game ends, skip to `nextHero()`.

9. **Branch based on hero state:**
   - If `hero.runningToHydra`: call `runToHydra(hero)`
   - If Hydra active and hero is in Hydra area: call `hydraAttack(hero)`
   - Otherwise: call `movePhase(hero)`, then check Taunt and Shadowstep

10. **Taunt (Juju, post-move, dungeon only):** If Juju, not KO'd, Hydra not active, and enemies exist on the board, Juju targets the weakest board enemy (closest if tied), removes it from the board, and fights it via `combat()`.

11. **Shadowstep (Eggo, post-move, dungeon only):** If Eggo, not KO'd, Hydra not active, and `shouldUseSkill` approves, Eggo uses Shadowstep to take an additional turn. Resets `talentUsedThisTurn` and `dodgeActive`, then calls `movePhase(hero)` again.

12. If game not over, call `nextHero()`.

### nextHero()

Advances `G.currentHero` by 1 (mod 4). When it wraps to 0, a new round begins:
- Increment `G.round`
- Reset `crownUsedThisRound` to false
- Run `monsterMovementPhase()`
- If Hydra is active, check if any hero is in the Hydra area. If the area is empty and exit is revealed, grow a head (source: `'hydra_area_empty'`). Then flag all non-running, non-Hydra heroes to start running (immediately, or after preparation if `prepareFirst` tweak is on).

**Hero order is fixed:** Juju (0), Gigi (1), Lulu (2), Eggo (3), repeating.

---

## 3. Movement

### movePhase(hero)

1. **Roll:** `heroRollDie(hero)` -- rolls 1d6 with Leprechaun transformation (swap 1 and 6 if Leprechaun follower present). Check Assassin stalker (roll 1 = instant KO).

2. **Flame check:** `isFlame = roll.isFlame || hero.giftedFlame`. Clear gifted flame.

3. **Modifiers applied in order:**
   - **Baba Yaga** stalker: caps movement to 1
   - **Spectral Horse** follower: +2 to movement value
   - **Ninja Tabi** equipment: roll a second die, keep the higher value (reapply Baba Yaga and Spectral Horse to the new value if relevant)

4. **Talent on movement Flame:** If Flame rolled and talent not yet used this turn, trigger talent.

5. **Awakening check:** If Flame AND `tilesPlaced >= 10`, call `awakenEffect(hero)`.

6. **Movement intent:** `decideMovementIntent(hero, moveVal)` decides between `'explore'` and `'return_entrance'`.

### Straight-Line Movement (explore intent)

Movement follows a single hex direction chosen by `chooseExploreDirection()`. The hero moves up to `moveVal` steps in that direction:

- Each step moves to the next hex in the chosen direction.
- If the next hex is **out of bounds**, stop at current position.
- If the next hex is **explored** and is a **Dread Dungeon**, stop there (Dread always stops movement).
- If the next hex is **explored** and not Dread, pass through it. If it is the final step (`stepsUsed >= moveVal`), land there.
- If the next hex is **unexplored**, place a new tile from the deck. If it is a Dread Dungeon, stop immediately. Otherwise, if more steps remain, continue in the same direction (the hero passes through newly placed tiles too).

There is no "jump-over" in the traditional sense -- movement is step-by-step in a straight line, and explored non-Dread tiles are simply passed through until the hero exhausts their movement points.

### Return-to-Entrance (Gil intent)

Used when the Gil AI decides to return to the entrance. Walks step-by-step along the shortest BFS path (`findPathAvoidDD`) toward `(0, 0)`, up to `moveVal` steps. Stops when reaching entrance or running out of steps.

### Direction Choice AI

`chooseExploreDirection(hexMap, q, r)` scores all 6 hex directions:
- +10 if the adjacent hex is unexplored
- +distance from center (bias outward)
- +count of unexplored neighbors of the target hex (look-ahead)

Top candidates within 2 points of the best score are chosen randomly.

`findExploreStep()` handles fallbacks when the primary direction is blocked or out of bounds, trying clockwise and counter-clockwise alternatives.

### Post-Movement

After landing, the hero's position is updated. If at entrance, Gil spending triggers. Room resolution follows via `resolveRoom()`. Before room resolution:

- **Reality Warp (Lulu):** If landing on a non-Wonder tile and `shouldUseSkill` approves (Dread tiles always, Common tiles if hero STR < 4), Lulu warps away, skipping room resolution entirely.
- **Floor Equipment:** 30% chance per move to encounter dropped equipment on the dungeon floor. If guarded, AI evaluates whether to fight based on STR comparison and loot value. Unguarded piles are free pickups.
- **Vanga weapon:** If landing on Wonder tile and hero has Vanga, draw an additional Legendary item.

---

## 4. Room Resolution

### resolveRoom(hero, roomType)

Increments `roomsVisited[roomType]`, then:
- **Wonder:** `drawWonder(hero)` -- draw from Wonder deck
- **Common:** `drawMishap(hero)` -- draw from Mishap deck
- **Dread:** `drawDread(hero)` -- special Dread Dungeon resolution

### drawDread(hero)

1. **Seasoned Adventurer check:** If the hero has this follower, draw 2 Misfortune cards, resolve only the lesser-danger one. Danger ranking: enemy (100 + STR) > stalker (50) > trap (10).

2. **Guarded Legendary Equipment:** If the Legendary deck has enabled items, draw one and show it. The hero gets it only if they survive the Misfortune.

3. **Misfortune:** Draw and resolve a Misfortune card (or the lesser of two if Seasoned Adventurer is active).

4. If the hero survives (not KO'd), equip the guarded Legendary item.

### Card Types and Resolution

**Wonder cards** can be encounters (recharge all skills, recharge 1 skill, draw legendary, equip full slots, swap equipment, remove stalker, remove enemy, etc.) or followers (join the hero, trigger Forest Amulet bonus draw).

**Mishap cards** can be encounters (minor effects), followers, stalkers (attach to hero), traps, or enemies (combat at Mishap tier).

**Misfortune cards** can be stalkers, traps, or enemies (combat at Misfortune tier).

---

## 5. Combat System

### combat(hero, enemyCard, tier)

The main combat orchestrator. Flow:

1. **Enemy STR calculation:** Base STR from card, plus tweak modifiers by tier. Special cases:
   - The Faceless One: random STR 1-6
   - Fishguard: STR = 2 * total party relics

2. **Pre-combat avoidance:**
   - Bully: if hero total STR > Bully base, Bully flees. Otherwise Bully fights at STR 6.
   - Rat Swarm: if hero total STR > enemy STR, auto-avoid.
   - The Sphinx: AI guesses 3 or 4. If correct (1/6 chance), auto-win.
   - Bandit: if hero has removable equipment and STR gap is tight, discard worst equipment to avoid fight.

3. **Spell Mirror:** `trySpellMirror(enemyCard.effect)` attempts to cancel dangerous enemy special effects.

4. **Pre-combat effects** (if not Spell Mirrored):
   - Snakerogue: exhaust 1 hero skill
   - Stormcaller: each hero rolls, on 1-2 exhaust 1 skill
   - Mana Leech: exhaust 2 skills or -2 STR penalty
   - Frogman: swallows 1 removable equipment (returned on win)

5. **Skill activations:**
   - Second Nature (Gigi): +3 STR if no equipment
   - Siphon (Lulu): -2 to enemy STR (can help any hero's fight)
   - Copycat (Eggo): copies Siphon from Lulu for additional -2, or Pack Leader from Gigi
   - Pack Leader (Gigi): +1 STR per follower
   - Overload (Lulu): exhaust all remaining ready skills (after Overload itself), gain +2 per each exhausted
   - Daredevil (Eggo): roll 2 dice. Both Flame = auto-win. Otherwise keep worst die, resolve normally. If at least one die is Flame, Dodge triggers.
   - Battlecry (Juju): roll 2 dice, keep worst. On win, all heroes recharge 2 skills.
   - Doomhammer: roll 1d6. On 1-2: instant KO. On 3-4: +1 STR. On 5-6: +3 STR.
   - Firebane: exhaust 1 skill for +1 STR (only if 2+ ready skills and enemy STR >= 4)
   - Demon Sword: +1 STR on Dread Dungeon tiles
   - Warlord Armour: double base STR if enemy STR > hero total STR

6. **Run fight(s):** Slayer enemy requires 2 wins (`fight_twice`). Each round calls `singleFight()`.

7. **On-win effects:** Gil reward, Battlecry team recharge, Mystic Wand full recharge, Supernova Gun (roll 6 = clear all board enemies), enemy-specific effects (Golem follower on die result 3, Stone Golem converts adjacent tiles to Dread, Mimic draws legendary, etc.).

### singleFight()

1. **Enemy roll:** Standard 1d6, or special:
   - Jack o' Lantern: 2d6 keep best, doubles = auto-lose for hero
   - Ghoul: 2d6 keep best

2. **Mummy:** If enemy rolls Flame, hero gets -2 penalty.

3. **Mud Golem:** Hero must beat enemy by 2+ (beat margin = 2).

4. **Hero roll:** Determined by equipment/followers/skills:
   - Triple Axe: 3d6 keep best
   - Veteran follower or Cheap Shot skill: 2d6 keep best
   - Battlecry: 2d6 keep worst
   - Daredevil: uses pre-rolled worst die (or auto-win if both were Flame)
   - Default: 1d6

5. **Assassin check** on hero combat roll (roll 1 with Assassin stalker = instant KO).

6. **Roll modifiers** (if not Spell Mirrored):
   - Mycoid: Flame counts as 0, no talent trigger
   - Djin: non-Flame roll counts as 0
   - Longlegs Spider: odd roll counts as 0
   - Stone Gargoyle: roll below 3 counts as 0

7. **Talent trigger** on Flame (if not already used this turn and no Cursed Beggar stalker).

8. **Auto-win checks:**
   - Wooden Spoon: roll 1 = auto win
   - Archangel follower: Flame = auto win (non-boss only)
   - Daredevil auto-win (both Flame)

9. **Combat bonuses applied:** Siphon Blade (+1 hero / -1 enemy), Arcane Parrot (exhaust 1 skill for +1 if enemy STR >= 4), Blob penalty (weapon STR negated), Squelette (base STR only).

10. **Faithful Dog reroll:** If hero has Faithful Dog follower, rolled Flame, talent already used this turn, roll value is 1-2, and would lose -- reroll the die. The new die replaces the Flame die (sacrificing the Flame trigger). Only used if the new total is higher. Cannot combine with Skill Burn.

11. **Skill Burn:** If losing and at least 1 ready skill, the AI simulates two options:
    - Option A: Reroll hero die (exhaust 1 skill)
    - Option B: Reroll enemy die (exhaust 1 skill)

    Picks whichever option is more likely to result in a win. If neither wins, picks the better improvement. Does not fire if the fight is not "worth it" (prehydra phase, weak enemy, low loadout value) or if Faithful Dog was just used.

12. **Resolution:** If `heroTotal >= enemyTotal + beatMargin`, hero wins. Otherwise loss.

### totalStr(hero, opts)

Calculates hero's total STR:
- Base hero STR
- +STR from all equipment (skip weapons if `opts.noWeapons`)
- +STR from followers
- -2 per Fear Ghost stalker
- +min(readySkillCount, 2) if Virtuous Sword equipped
- +1 per held relic (flat, all relics)
- Equipment tweak STR modifiers
- If `opts.baseOnly`, return just `hero.str`

### handleCombatLoss()

Called when the hero loses a fight:

1. **Crown of Courage bodyguard:** If Crown hasn't been used this round and is not at Hydra, check if any other non-KO hero holds the Crown. The Crown holder intervenes if their total STR (plus +2 if they are Juju) exceeds the losing hero's STR. The Crown holder then fights the enemy directly. `crownUsedThisRound` is set to true. One use per round.

2. **Shield Wall (Juju):** If `shouldPreventKO` returns true, Juju uses Shield Wall to prevent KO on self or ally.

3. **Copycat Shield Wall (Eggo):** Eggo copies Juju's Shield Wall if available.

4. **Warden Angel:** Follower sacrifices himself, turns loss into win (with full on-win effects).

5. **Dodge (Eggo talent):** If `dodgeActive` is true, hero avoids KO.

6. **Berserker Helmet:** Retry the fight -- both hero and enemy roll fresh. If hero wins the retry, treated as a win.

7. **Special enemy on-loss effects:**
   - Dragon: gains +1 STR permanently
   - Hound: follows hero to next turn (no KO, deferred combat)
   - Ogre: no respawn, hero stays on tile

8. **Board persistence:** Post-Awakening (tiles >= 10), defeated-by enemies persist on the board at the hero's position.

9. **KO:** Call `applyKO(hero)`.

---

## 6. Skills

Every skill, organized by hero, with exact implementation details:

### Juju (The Hero)

**Battlecry** (Combat): Activated pre-fight via `shouldUseSkill`. Roll 2 dice, keep the worst. If the fight is won, ALL heroes recharge 2 skills each. AI uses it when `totalStr(hero) >= enemyStr + 2` (likely to win even with worst die). At Hydra: when `totalStr(hero) + 1 >= headStr`.

**Shield Wall** (Reactive): Prevents a KO on any hero. Checked in `handleCombatLoss()` and at Hydra after a failed attack. AI uses it if the hero has equipment or relics to protect (dungeon) or always at Hydra.

**Not Today!** (Combat): If any hero loses a fight by margin 1-2, Juju can turn it into a win. Checked after `singleFight()` returns a loss. Full on-win effects apply (Gil, equipment recovery, Mystic Wand recharge).

**Taunt** (Combat): After movement in the dungeon, Juju fights the weakest enemy on the board (sorted by STR ascending, distance as tiebreaker). The enemy is removed from `enemiesOnBoard` before the fight. At Hydra: grants an extra `hydraAttack()` call (additional attack this turn). AI uses it in early/mid phases or always at Hydra.

### Gigi (The Elf)

**Herbalist** (Support, cross-turn): Fires at the start of EVERY hero's turn (not just Gigi's). Recharges 1 exhausted skill for the hero with the most exhausted skills. Ties broken by favoring the currently active hero. AI always uses it when a valid target exists. Source: `'herbalist'`.

**Wild Call** (Support): Fires at turn start when active hero is Gigi. Draws through the Wonder deck until a follower-type card is found. Non-followers are returned and deck is reshuffled. AI uses it when Gigi has fewer than 2 followers and not in prehydra phase.

**Second Nature** (Combat): +3 STR for this fight if Gigi has no equipment. AI uses it whenever the condition is met (no equipment). Works in both dungeon and Hydra.

**Pack Leader** (Combat): +1 STR per follower for this combat. AI uses it at Hydra if any followers exist, or in dungeon if followers > 0 and enemy STR >= 2.

### Lulu (The Mage)

**Siphon** (Combat): -2 STR to the enemy in ANY hero's combat (cross-hero support). Lulu's Siphon can help any hero who is currently fighting. AI thresholds: early phase enemy STR >= 2, mid >= 3, prehydra >= 4, Hydra always.

**Overload** (Combat): Exhausts all remaining ready skills. Gains +2 STR for each skill exhausted this way (NOT counting Overload itself, which is exhausted by `useSkill()` first). Requires at least 2 ready skills (Overload + 1 other). AI uses at Hydra always, in dungeon only with 3+ ready skills and enemy STR >= 5.

**Reality Warp** (Utility): After landing on a tile, if it is Dread or (Common with hero STR < 4), Lulu warps to safety -- room resolution is skipped entirely. Not used in prehydra or Hydra phases.

**Spell Mirror** (Reactive): Cancels special effects of encounters, traps, or Hydra heads. Called via `trySpellMirror()`. Always used at Hydra. In dungeon: always used on lethal effects (`ko_or_exhaust_all`, `roll_1_3_ko`, `fewer_2_skills_ko`, `fight_self_4dice`). Used on dangerous effects in early/mid phases. Not used in prehydra for non-lethal effects.

### Eggo (The Rogue)

**Cheap Shot** (Utility): Roll an extra die in combat, keep the best result. Not used if Triple Axe is equipped (already rolling 3 dice). AI uses on enemy STR >= 3 in dungeon, always at Hydra.

**Copycat** (Utility): Copies any ally's ready skill. The copied skill stays ready on the original hero -- only Copycat is exhausted. Used in multiple contexts:
- Turn start: copies Herbalist from Gigi if Eggo has 2+ exhausted skills
- Combat: copies Siphon (if Lulu has it ready and enemy STR >= 3) or Pack Leader (if hero has 2+ followers)
- Loss prevention: copies Shield Wall from Juju
- Hydra: copies Siphon, Shield Wall, or other useful skills

**Daredevil** (Combat): Roll 2 fate dice. If both are Flame, auto-win the fight. Otherwise, keep the worst die and resolve normally. If at least one die is Flame, Eggo's Dodge talent triggers. AI uses when `enemyStr > totalStr(hero) + 2` in dungeon, always at Hydra.

**Shadowstep** (Utility): End turn immediately and begin a new turn from scratch. In practice: resets `talentUsedThisTurn` and `dodgeActive`, then calls `movePhase(hero)` again (dungeon) or `hydraAttack(hero)` again (Hydra). AI uses in early/mid dungeon phases and always at Hydra.

---

## 7. Talents

Triggered by rolling Flame. Once per turn (`talentUsedThisTurn` flag). Blocked by Cursed Beggar stalker (`no_flame_effect`) or Parasite Sword equipment.

### Juju -- Unwavering Power
+2 to combat total. Applied as `combatBonus += 2` when `hero.id === 'juju' && isFlame && hero.talentUsedThisTurn`. Only affects combat, not movement.

### Gigi -- Nature's Gift
Gift Flame to another hero's next turn. Sets `target.giftedFlame = true`. The gifted hero's next die roll (movement or combat) is treated as Flame regardless of the actual roll.

AI targeting priority (dungeon): Eggo > Juju > Lulu > self (Gigi).
At Hydra: gift to the next hero in turn order who is in the Hydra area and not KO'd.

The gifted hero can target themselves if no other hero is available.

### Lulu -- Arcane Recharge
Recharge 1 exhausted skill. Source: `'talent_lulu'`.
With Ancestral Grimoire: recharge 2 instead of 1 (second source: `'talent_lulu_grimoire'`).

### Eggo -- Dodge
Sets `hero.dodgeActive = true`. When the hero would be KO'd (in `handleCombatLoss` or Hydra combat), the KO is prevented. Dodge also triggers from Daredevil's Flame rolls.

---

## 8. Relic System

### STR Bonus
Every held relic gives +1 STR flat. Implemented in `totalStr()` as `hero.heldRelics.forEach(r => { s += 1; })`.

### Passive Effects

**Crown of Courage (Juju's relic, `owner: 'juju'`):**
- Bodyguard intervention: When any hero loses a fight in the dungeon, the Crown holder can fight in their place. Only if Crown holder's total STR (plus +2 if they are Juju) exceeds the losing hero's STR. Limited to once per round (`crownUsedThisRound`). Not active at Hydra.
- +2 STR bonus when the Crown holder (if Juju) intervenes: `totalStr(crownHolder) + (crownHolder.id === 'juju' ? 2 : 0)`.

**Forest Amulet (Gigi's relic, `owner: 'gigi'`):**
- Followers immune to removal: `removeFollowers()` checks `heroHasRelicFromOwner(hero, 'gigi')` and if true, all followers are protected. Faithful Dog is always kept regardless.
- Bonus follower draw: `forestAmuletBonusDraw(hero)` fires whenever Gigi gains a follower. Draws 1 Wonder card; if it is a follower, Gigi keeps it too. If not, returned to deck.

**Ancestral Grimoire (Lulu's relic, `owner: 'lulu'`):**
- Failsafe recharge: At turn start, if hero has 0 ready skills, recharge 1. Checked in `runTurn()` before anything else.
- Talent enhancement: Lulu's Arcane Recharge talent recharges 2 skills instead of 1.

**Shadow Cloak (Eggo's relic, `owner: 'eggo'`):**
- Keep equipment on KO: In `applyKO()`, if hero has Shadow Cloak, equipment is NOT dropped. Both dungeon and Hydra KOs.
- 3 equipment slots for Eggo: `maxEquipSlots()` returns 3 if `hero.id === 'eggo' && heroHasRelicFromOwner(hero, 'eggo')`.

### Relic Room Placement

Relic rooms are placed as hex tiles adjacent to the hero's destination when `awakenEffect()` fires. Preference is for unexplored hexes farthest from the entrance. If no unexplored neighbors exist, an explored non-entrance neighbor is used.

### Relic Distribution

When a relic is claimed, the matched hero gets it if their relic count is less than or equal to the hero with fewest relics. Otherwise the hero with fewest relics gets it.

---

## 9. Equipment System

### Slots
- Base: 2 slots per hero
- Page follower: increases to 3 slots (via `maxEquipSlots()`, `Math.max(base, 3)`)
- Shadow Cloak (Eggo): 3 slots for Eggo specifically

### Equipping -- equipItem(hero, item)

If equipment count >= max slots, the hero discards the lowest-STR removable item (Parasite Sword cannot be removed: `effect !== 'cannot_remove_blocks_talent'`). If all slots are locked by Parasite Swords, equipping fails.

### Equipment Effects

**Weapons:**
- Triple Axe (STR +2): Roll 3d6, keep best
- Firebane (STR +1): Exhaust 1 skill for +1 STR in combat (if 2+ ready skills and enemy STR >= 4)
- Demon Sword (STR +2): +1 STR on Dread Dungeon tiles
- Wooden Spoon (STR +2): Roll 1 = auto-win
- Doomhammer (STR +2): Pre-fight roll 1d6. 1-2: instant KO. 3-4: +1 STR. 5-6: +3 STR.
- Virtuous Sword (STR +1): +1 STR per ready skill (capped at +2)
- Siphon Blade (STR +1): +1 hero / -1 enemy in combat
- Vanga (STR +2): When landing on Wonder tile, draw additional Legendary
- Parasite Sword (STR +3): Cannot be removed, blocks talent activation
- Mystic Wand (STR +1): On combat win, recharge all skills
- Supernova Gun (STR +2): On combat win, roll 1d6. On 6, clear all board enemies.

**Armour:**
- Cursed Armour (STR -1): When all skills exhausted, recharge 1. Triggers via `checkCursedArmour()` after any skill exhaustion.
- Stivali delle Sette Leghe (STR 0): Choose stop (cosmetic in simulator, no direct mechanical effect coded beyond data)
- Warlord Armour (STR 0): Double base STR if enemy STR exceeds hero total STR
- Wizard Hat (STR 0): At turn start, roll 1d6. On 4+, recharge 1 skill.
- Darksight Helm (STR 0): Peek adjacent tiles (data-only, effect handled by UI/narrative)
- Ninja Tabi (STR 0): Roll 2 dice for movement, keep higher value
- Berserker Helmet (STR 0): On combat loss, retry the fight (full fresh rolls for both sides). One retry per fight.

### Tweak System
Each equipment item can be individually enabled/disabled and have a STR modifier applied via the tweaks panel. Disabled items are skipped when drawing from the Legendary deck.

---

## 10. Followers and Stalkers

### Followers

Followers are gained from Wonder and Mishap card draws. Each has a passive effect:

- **Page** (inventory_+1): +1 equipment slot (max 3)
- **Spectral Horse** (movement_+2): +2 to movement roll
- **Archangel** (flame_auto_win): Flame in combat = auto-win (non-boss)
- **Seasoned Adventurer** (dd_draw_2_keep_1): In Dread Dungeon, draw 2 Misfortune cards, resolve the lesser one
- **Arcane Parrot** (exhaust_skill_str+1): Exhaust 1 skill for +1 STR in combat (if 2+ ready skills and enemy STR >= 4)
- **Veteran** (roll_2_keep_best): Roll 2d6 in combat, keep best
- **Faithful Dog** (reroll_flame): Can reroll a Flame die to sacrifice the talent trigger for a potentially higher number. AI uses only when talent already triggered, roll is 1-2, and would lose. Cannot combine with Skill Burn. Dog cannot be removed by any effect.
- **Warden Angel** (discard_win_fight): On combat loss, sacrifice Warden Angel to turn loss into win
- **Monster Hunter** (skip_move_fight_enemy): Data-defined, skip move to fight enemy

Mishap-only followers:
- **Leprechaun** (swap_1_6): All die rolls swap 1 and 6 (applied in `heroRollDie()`)
- **Drunkard** (stop_on_enemy): Must stop on enemy tiles

### Stalkers

Stalkers attach to heroes and impose penalties:

- **Corrupted Squire** (exhaust_per_equip): Exhaust skills based on equipment
- **Old Hag** (discard_followers): On attachment, immediately discards all followers (via `removeFollowers()`)
- **Mutt** (roll_1_discard_equip): Roll mechanic for equipment discard
- **Fear Ghost** (-2_combat): -2 STR in all combat (applied in `totalStr()`)
- **Cursed Beggar** (no_flame_effect): Blocks all Flame-triggered effects including talents
- **Assassin** (roll_1_ko): Any die roll of 1 = instant KO (checked via `checkAssassin()` on movement rolls, combat rolls, and trap rolls)
- **Baba Yaga** (move_1_only): Movement capped at 1

### Forest Amulet Protection

`removeFollowers()` checks `heroHasRelicFromOwner(hero, 'gigi')`. If true, no followers are removed and a log message is emitted. Faithful Dog is independently protected (always kept even without the Amulet).

---

## 11. Gil System

Optional system enabled via tweaks (`gilEnabled`).

### Earning
`gilReward(hero, enemyStr)`: After winning combat, hero earns `max(1, floor(enemyStr * gilPerStr))` Gil. Default `gilPerStr` is 1.

### Spending -- gilSpendAtEntrance(hero)

Only at entrance. AI priority:
1. If no weapon AND can afford equipment cost (default 6 Gil), buy Legendary equipment via `drawLegendaryItem()`
2. While affordable and skills are exhausted, recharge skills (default 3 Gil each)

### AI Return-to-Entrance Decision -- decideMovementIntent()

When Gil is enabled and the hero is not at the entrance, the AI evaluates reasons to return:
1. No weapon and can afford equipment (highest priority)
2. No equipment at all and can afford
3. All skills exhausted and can afford recharge
4. 2+ exhausted skills and can afford 2+ recharges
5. Open equipment slot, can afford equipment + recharge
6. Only 1 ready skill left, 2+ exhausted, can afford recharge

Only returns if the trip takes at most 1 turn (based on `ceil(distance / 3.5) <= 1`) and a valid path exists via `findPathAvoidDD`.

---

## 12. The Awakening

### Trigger

`awakenEffect(hero)` fires when a Flame is rolled during movement AND `tilesPlaced >= 10`.

### First Call -- Exit Placement

`G.exitPlaced` is set to true. An Exit hex is placed adjacent to the hero's current destination:
- Prefers unexplored neighbors, sorted by distance from entrance (farthest first)
- Fallback: explored non-entrance neighbors

### Subsequent Calls -- Relic Rooms

Each call places one Relic Room hex tile adjacent to the hero's destination (same placement logic as Exit). A relic is popped from the shuffled relic pool and given to the appropriate hero.

### Hydra Spawn Trigger

When `relicRoomsPlaced >= 4` and exit not yet revealed, set `exitRevealed = true` and call `spawnHydra()`.

After the Hydra spawns, at the end of each round, all heroes not already running or at the Hydra are flagged `runningToHydra = true`. If `prepareFirst` tweak is enabled, heroes wait until they have 2+ equipment and (1+ followers or not Gigi), with a safety valve at turn 40.

---

## 13. Monster Movement

### monsterMovementPhase()

Runs at the end of each round (when `currentHero` wraps to 0), only if `tilesPlaced >= 10` (post-Awakening).

For each enemy on the board:
1. **Steps:** 1 for normal enemies. 2 for Demon (`effect === 'moves_2_per_round'`).
2. **Pathfinding:** BFS through explored tiles (`hexMap.findPath`) to find the closest non-KO hero not at Hydra.
3. **Movement:** Move 1 step along the shortest path toward that hero.
4. **Contact:** If enemy lands on a hero's tile, forced combat (Misfortune tier). Enemy is removed from the board after combat.
5. **No stacking:** Enemies move independently but do not stack -- each resolves individually.

---

## 14. Hydra Fight

### spawnHydra()

Shuffles all 6 Hydra head definitions, picks 3 to start. Each head gets:
- `str`: base STR from data (or tweaked value)
- `destroyed: false`
- `effectiveStr`: calculated by `recalcHydraStr()`

Sets `G.hydraActive = true`, `G.hydraMaxHeads = 6`.

### recalcHydraStr()

If The Nest is alive, all OTHER heads get +2 to effective STR. The Nest itself does not get the bonus.

### runToHydra(hero)

Called each turn for heroes with `runningToHydra = true`.
1. Roll die for movement (with Leprechaun, Assassin check).
2. If at entrance, spend Gil.
3. Pathfind from current position to exit hex via `hexMap.findPath`.
4. Move step-by-step along the path, up to roll value steps.
5. If reaching the exit hex: set `pos = 'hydra'`, add to `heroesInHydraArea`, set `runningToHydra = false`.
6. Fallback (no path): probability-based arrival (`0.4 + moveVal * 0.1` chance).

### hydraAttack(hero)

Called when hero is in the Hydra area during their turn.

1. **Victory check:** If all heads destroyed, game won.

2. **Floor equipment pickup:** Hero picks up highest-STR items from `hydraFloorEquipment` (dropped by KO'd heroes), up to slot limit. Skips Parasite Sword if hero already has equipment.

3. **Target selection** (`aiChooseHydraHead`): Always target The Nest first if alive. Otherwise target the lowest-effective-STR head.

4. **Spell Mirror:** For heads with on-attack effects (Fangs, Maw) or passive effects (Brood), Lulu can cancel via `trySpellMirror()`.

5. **On-attack effects** (if not Spell Mirrored):
   - **The Fangs:** All heroes in Hydra area exhaust 1 skill
   - **The Maw:** Discard 1 removable equipment, or -2 STR if none

6. **Hero roll:** Same equipment/follower bonuses as dungeon (Triple Axe, Veteran, etc.)

7. **Assassin check** on die roll.

8. **Flame:** Blocked by The Brood's passive (unless Spell Mirrored). Otherwise triggers talent.

9. **Equipment bonuses:** Doomhammer, Firebane, Siphon Blade, Maw penalty.

10. **Coordinated combat skills:**
    - Lulu Siphon: -2 to head effective STR
    - Eggo Copycat Siphon: additional -2 (even non-attacking Eggo can help)
    - Pack Leader (Gigi): +1 per follower
    - Overload (Lulu): exhaust all remaining, +2 per
    - Cheap Shot (Eggo): extra die, keep best
    - Battlecry (Juju): 2 dice keep worst, team recharge on win
    - Second Nature (Gigi): +3 if no equipment

11. **Skill Burn at Hydra:** Reroll hero die only (heads don't roll). AI checks if reroll improves total.

12. **Resolution:**
    - **Win:** Head is destroyed. `hydraMaxHeads` decreases by 1 (permanent). On-defeat effects fire:
      - **The Wail:** All heroes in area exhaust 1 skill
      - **The Spite:** Grow 1 extra head, but NEVER causes overflow. Uses dedicated logic (not `growHydraHead()`). Draws from unused head pool, or revives a destroyed head (never itself). If at max heads, no effect.
    - Recalculate head STRs. Check victory (all destroyed).
    - Post-win: Mystic Wand, Supernova Gun, Battlecry team recharge.
    - **Loss:** Check Dodge, Berserker Helmet retry, Shield Wall, Copycat Shield Wall. If none prevent KO, hero is KO'd and a new head grows via `growHydraHead()`.

13. **Post-attack skills:**
    - **Taunt (Juju):** Additional `hydraAttack()` call
    - **Shadowstep (Eggo):** Additional `hydraAttack()` call (resets talent and dodge flags)

### Hydra Head Abilities

| Head | Base STR | Type | Ability |
|------|----------|------|---------|
| The Nest | 7 | passive | While alive, all other heads gain +2 STR |
| The Brood | 8 | passive | Flame has no special effect (no talent trigger) |
| The Wail | 10 | onDefeat | On destroy: all heroes in area exhaust 1 Skill |
| The Spite | 12 | onDefeat | On destroy: grow 1 extra head (never causes overflow) |
| The Fangs | 9 | onAttack | When targeted: all heroes in area exhaust 1 Skill |
| The Maw | 8 | onAttack | When targeted: discard 1 Equipment or -2 STR |

### Head Growth -- growHydraHead(source)

Triggers on: hero KO at Hydra, Doomhammer KO, Assassin KO, Hydra area empty at round end.

1. If `aliveCount >= hydraMaxHeads`:
   - With overflow enabled (default): GAME OVER
   - With overflow disabled: no head grows
2. Pick from unused head pool (names not yet in `hydraHeads`). Apply tweaked STR.
3. If no unused heads available, revive a destroyed head.

### Max Heads Calculation

Starts at 6. Decreases by 1 each time a head is destroyed (permanent). So destroying heads reduces the overflow threshold.

---

## 15. Game End

### Victory
All Hydra heads destroyed. `G.victory = true`, `G.gameOver = true`.

### Defeat Conditions
1. **Hydra KO with 0 relics:** Hero falls at Hydra and party has no relics to spend. Immediate game over.
2. **Hydra Overflow:** Alive head count reaches `hydraMaxHeads` when a new head tries to grow (with overflow enabled).
3. **Infinite loop safety:** The simulation has a turn limit in `runSilentGame()` (200 turns).

---

## 16. AI Decision Making

### shouldUseSkill(hero, skillName, context)

Central AI function. Returns true/false for whether to use a given skill. Considers game phase (`early`, `mid`, `prehydra`, `hydra`) and context (enemy STR, at Hydra flag, etc.).

Key decisions:

- **Siphon:** Early: enemy STR >= 2. Mid: >= 3. Prehydra: >= 4. Hydra: always.
- **Shield Wall:** Hydra: always. Dungeon: only if hero has equipment or relics.
- **Second Nature:** Always when Gigi has no equipment.
- **Spell Mirror:** Hydra: always. Lethal effects: always. Dangerous effects: early/mid only. Prehydra: never for non-lethal.
- **Pack Leader:** Hydra: if any followers. Dungeon: if followers > 0 and enemy STR >= 2.
- **Overload:** Needs 2+ ready skills. Hydra: always. Dungeon: 3+ ready and enemy STR >= 5.
- **Battlecry:** Hydra: if totalStr + 1 >= headStr. Dungeon: if totalStr >= enemyStr + 2.
- **Cheap Shot:** Hydra: always. Dungeon: enemy STR >= 3.
- **Daredevil:** Hydra: always. Dungeon: enemy STR > totalStr + 2.
- **Reality Warp:** Not in prehydra/hydra. Otherwise true.
- **Herbalist:** Always true.
- **Wild Call:** Fewer than 2 followers and not prehydra.
- **Shadowstep:** Hydra: always. Dungeon: early/mid only.
- **Taunt:** Hydra: always. Dungeon: early/mid only.
- **Copycat:** Context-dependent: preventKO always, Siphon if enemy >= 3, Herbalist if Eggo has 2+ exhausted skills. At Hydra: if any useful ally skill is ready.

### shouldPreventKO(hero)

- At Hydra: always true
- Loadout value < 2: false (not worth saving)
- Loadout value >= 6: true (too much to lose)
- Otherwise: true if 3+ ready skills

### koLoadoutValue(hero)

`sum(equipment: str + 2 each) + sum(followers: str + 3 each) - sum(stalkers: 2 each)`

### getGamePhase()

- `'hydra'`: Hydra is active
- `'prehydra'`: 3+ relics collected
- `'mid'`: 10+ tiles placed
- `'early'`: otherwise

### aiChooseHydraHead(heads)

1. Always target The Nest first if alive.
2. Otherwise target the lowest effective-STR head.

---

## 17. Batch Simulation

### runSilentGame()

Not shown in the code excerpts above, but the batch system uses `runSilentGame()` to run games without DOM output. Key differences from narrative mode:

- All `log()` calls still populate `G.log` but are not rendered to the DOM during execution
- Turn limit of 200 prevents infinite loops
- Uses the same `runTurn()` / `nextHero()` loop
- Tweaks are applied via `G._tweaks = currentTweaks`
- Results are collected into `batchResults[]` for aggregate reporting
- The `freshTracker()` provides all per-game metrics that feed into the batch report

The batch runner calls `initState()`, applies tweaks, then loops `runTurn()` until `G.gameOver` or the turn limit. Results include victory/defeat, turn count, all tracker data.

### Tweaks Applied to Batch

`readTweaks()` reads all UI values into a tweaks object. `G._tweaks` is set from this before the game loop. Tweaks affect:
- Hero base STR values
- Equipment enabled/disabled and STR modifiers
- Hydra head STR values
- Mishap/Misfortune enemy STR modifiers
- Skills enabled/disabled
- Followers enabled/disabled
- Overflow game-over behavior
- Prepare-first flag
- Gil system settings

---

## 14. Debug / Trace Mode

The simulator includes a debug mode that captures structured logs of game execution, useful for verifying that mechanics work correctly and for spotting edge-case bugs.

### Enabling Debug Mode

A checkbox labeled "Debug / Trace" is available on the home screen. Toggling it on activates trace capture for both single runs and batch simulations.

### Single Run Trace

When debug mode is active and you run a single game, the simulator captures a turn-by-turn structured log. Each entry records:

- The active hero and current turn number
- Movement roll and resulting position
- Tile exploration results (type, card drawn)
- Combat details (hero STR, enemy STR, roll, outcome)
- Skill activations and their effects
- Follower/stalker triggers
- Equipment usage
- KO events and rescue attempts
- Relic pickups and Hydra phase transitions

The full trace can be downloaded as a JSON file via the **Download Trace** button that appears after the run completes.

### Batch Debug

When debug mode is active during a batch run, the simulator captures a condensed per-game summary rather than the full turn-by-turn log (which would be too large across hundreds or thousands of games). Each game summary includes:

- Game index and outcome (victory/defeat)
- Total turns played
- Key aggregate stats (damage taken, enemies defeated, skills used)
- Notable events (Hydra encounters, relic acquisitions, party wipes)

The batch debug output can be downloaded as a JSON file via the **Download Batch Debug** button that appears after the batch completes.

### Download Buttons

Both trace modes surface a download button in the results panel:

- **Download Trace** -- appears after a single debug run, exports the full turn-by-turn log
- **Download Batch Debug** -- appears after a batch debug run, exports the array of per-game summaries

Files are timestamped and saved as `.json` for easy parsing in external tools.

---

## Appendix: Unimplemented / Stub Card Effects

The following card effects are defined in `data.js` but their mechanics are not fully simulated in `engine.js`. They are treated as basic cards (enemies fight at their STR with no special effect, followers/stalkers give STR bonus only).

### Followers (effect defined but mechanic not triggered)
- **Monster Hunter** (`skip_move_fight_enemy`): Skip movement to fight an enemy on the board
- **Dungeon Guardian** (`block_next_misfortune`): Block the next Misfortune card drawn
- **Oracle** (`peek_3_tiles`): Peek at the next 3 tiles in the deck
- **Dungeon Master** (`choose_room_type`): Choose whether the next room is Wonder, Common, or Dread
- **Castle Architect** (`move_2_extra`): +2 extra movement (beyond Spectral Horse)

### Stalkers (effect defined but mechanic not triggered)
- **Corrupted Squire** (`exhaust_per_equip`): Exhaust 1 Skill per equipped item at turn start
- **Mutt** (`roll_1_discard_equip`): On movement roll of 1, discard 1 equipment
- **Drunkard** (`stop_on_enemy`): Movement stops on tiles containing enemies

### Equipment (effect defined but mechanic not triggered)
- **Darksight Helm** (`peek_adjacent`): Peek at face-down adjacent tiles before choosing direction
- **Stivali delle Sette Leghe** (`choose_stop`): Choose which tile to stop on during movement (not forced to final tile)

### Enemies (effect defined but special mechanic simplified)
- **Wind Elemental** (`move_to_revealed`): On defeat, hero may move to any revealed tile (logged but not acted on)
- **Static Fog** (`block_room`): Blocks room resolution (not implemented -- treated as normal enemy)

### Wonder Cards (effect exists but mechanic simplified)
- **Good Genii** (`remove_enemy`): Remove 1 enemy from the board (not implemented -- would need enemiesOnBoard integration)

These stubs do not significantly affect simulation accuracy for balance testing purposes, as they represent low-frequency events or minor tactical options. However, they should be implemented for full rulebook fidelity.
