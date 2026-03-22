# Juju Simulator -- Complete Mechanics Reference

This document describes every mechanic implemented in the Juju dungeon-crawler simulator, function by function. It is written for game designers who need to compare the simulator against the physical rulebook and spot discrepancies.

Source files covered:

- `/js/engine.js` -- game state, core loop, combat, skills, talents, awakening, hydra
- `/js/hex.js` -- hex grid model, pathfinding, direction choice
- `/js/data.js` -- hero definitions, card decks, hydra heads, relics

---

## 1. Game Setup -- `initState()` (engine.js ~L355)

### Tile Deck
A 36-tile deck is generated. Each tile is randomly assigned one of three types using configurable percentages (defaults: 30% Wonder, 45% Common, 25% Dread):

```
for each of 36 tiles:
  r = random()
  if r < wonderPct          -> 'wonder'
  else if r < wonderPct + commonPct  -> 'common'   (commonPct = 1 - wonderPct - dreadPct)
  else                       -> 'dread'
```

The deck is then shuffled (Fisher-Yates).

### Card Decks
Four index-based decks are created as shuffled arrays of indices into their respective card arrays:

| Deck | Source Array | Card Count |
|------|-------------|------------|
| `wonderDeck` | `WONDER_CARDS` | 17 cards |
| `mishapDeck` | `MISHAP_CARDS` | 29 cards |
| `misfortuneDeck` | `MISFORTUNE_CARDS` | 27 cards |
| `legendaryDeck` | `LEGENDARY_EQUIPMENT` | 17 cards |

When a deck runs out, Wonder/Mishap/Misfortune decks are reshuffled from scratch. The Legendary deck is not reshuffled -- once all legendary items are drawn, no more can be obtained.

### Hex Map
`createHexMap(3)` builds an axial-coordinate hex grid with max radius 3 (37 possible positions: 1 + 6 + 12 + 18). The entrance tile is placed at (0, 0) with type `'entrance'`.

### Hero Initialization
Four heroes are created from `HEROES` data (engine.js ~L387):

| Hero | ID | Base STR | Flame Faces |
|------|----|----------|-------------|
| Juju (The Hero) | juju | 3 | 4, 5, 6 |
| Gigi (The Elf) | gigi | 2 | 2, 3, 4 |
| Lulu (The Mage) | lulu | 1 | 1, 3, 6 |
| Eggo (The Rogue) | eggo | 2 | 1, 2, 3 |

Each hero starts with:
- `hp: 1`
- `pos: {q:0, r:0}` (entrance)
- Empty arrays for: equipment, followers, stalkers, heldRelics
- All 4 skills in `'ready'` state
- `ko: false`, `dodgeActive: false`, `giftedFlame: false`
- `gil: 0` (Gil system is opt-in via tweaks)

### Other State
- `turn: 0`, `round: 1`, `currentHero: 0`
- `hydraActive: false`, `hydraHeads: []`, `hydraMaxHeads: 6`
- `relicPool`: shuffled copy of 4 relics (Hero, Ranger, Wizard, Rogue)
- `enemiesOnBoard: []`, `dungeonFloorEquipment: []`, `hydraFloorEquipment: []`

---

## 2. Turn Structure -- `runTurn()` (engine.js ~L655)

### Round Definition
A **round** is 4 turns (one per hero). Heroes always act in fixed order: Juju (index 0), Gigi (1), Lulu (2), Eggo (3). After all four act, `nextHero()` (L3149) increments `G.round` and runs end-of-round checks.

### Turn Flow (single hero)

1. **Increment turn counter**, reset per-turn flags (`talentUsedThisTurn = false`, `dodgeActive = false`, `ko = false`)
2. **Gil spending at entrance** -- if hero is at entrance and Gil system is enabled, `gilSpendAtEntrance()` runs (see Section 10)
3. **Wizard Hat** -- if equipped, roll d6: on 4+ recharge one skill (L671)
4. **Herbalist (Gigi cross-turn)** -- Gigi can use Herbalist at the start of ANY hero's turn to recharge one skill for the hero who has the most exhausted skills (L684). Uses `shouldUseSkill()` to decide.
5. **Copycat -> Herbalist (Eggo)** -- if Eggo is the current hero, has Copycat ready, and Gigi has Herbalist ready, Eggo can copy Herbalist to recharge a skill (requires Eggo to have 2+ exhausted skills) (L702)
6. **Wild Call (Gigi)** -- if Gigi is the current hero, uses Wild Call to search the Wonder deck for a follower (L718)
7. **Hound chase** -- if a Hound is following this hero from a previous loss, it attacks immediately via `combat()` (L746)
8. **Branch on game state**:
   - If `hero.runningToHydra` -> `runToHydra()` (travel to Hydra)
   - Else if in Hydra area -> `hydraAttack()` (fight a head)
   - Else -> `movePhase()` (dungeon exploration), then optional **Taunt** and **Shadowstep**
9. **Taunt (Juju post-move)** -- if Juju, not KO'd, Hydra not active, and `shouldUseSkill()` agrees: draw a random Mishap enemy and fight it (L762)
10. **Shadowstep (Eggo post-move)** -- if Eggo, not KO'd, Hydra not active: reset turn flags and run `movePhase()` again (a full extra turn) (L776)
11. **`nextHero()`** -- advance to next hero; if wrapping to hero 0, increment round

---

## 3. Movement -- `movePhase()` (engine.js ~L874)

### Step 1: Roll for Movement

1. Roll one die via `heroRollDie()` (L875). This applies the Leprechaun swap (1<->6) if the hero has that follower.
2. **Assassin check** -- if the roll is 1 and hero has the Assassin stalker, instant KO (L876).
3. Flame detection: `isFlame = roll.isFlame OR hero.giftedFlame` (L878). The `giftedFlame` flag (from Gigi's Nature's Gift talent) is then cleared.

### Step 2: Movement Modifiers (applied in order)

| Modifier | Source | Effect | Line |
|----------|--------|--------|------|
| Baba Yaga | Stalker `move_1_only` | Caps movement at 1 | L883 |
| Spectral Horse | Follower `movement_+2` | +2 to movement value | L891 |
| Ninja Tabi | Equipment `move_2_dice` | Roll a second die; keep the better of the two. The Spectral Horse and Baba Yaga modifiers are reapplied to the chosen value. | L897 |

### Step 3: Flame and Talent on Movement

If the roll is a Flame and the talent hasn't been used this turn, `triggerTalent(hero, 'movement')` fires (L912). See Section 7 for talent effects.

### Step 4: Awakening Check

If Flame AND `tilesPlaced >= 10`, call `awakenEffect()` (L917). See Section 12.

### Step 5: Decide Movement Intent -- `decideMovementIntent()` (L791)

Returns one of two intents:

**`return_entrance`** -- hero walks back toward (0,0) to spend Gil. Only chosen when:
- Gil system is enabled
- Hero is not already at entrance, not running to Hydra, not in Hydra area
- A reason to return exists (priority ordered):
  1. No weapon and can afford equipment purchase
  2. No equipment at all and can afford purchase
  3. All skills exhausted and can afford recharge
  4. 2+ skills exhausted and can afford 2+ recharges
  5. Open equip slot + can afford equip + has exhausted skill + enough Gil for both
  6. Only 1 ready skill, 2+ exhausted, can afford recharge
- Trip is feasible: `ceil(distance / 3.5) <= 1` (must be 1 turn away)
- A path exists via `findPathAvoidDD()` (BFS avoiding Dread Dungeons as intermediates)

**`explore`** -- default. Picks a direction via `chooseExploreDirection()`.

### Direction Choice -- `chooseExploreDirection()` (hex.js ~L132)

For each of 6 hex directions, calculates a score:
- +10 if the adjacent hex is unexplored
- +distance from center (biases outward)
- +count of unexplored hexes reachable from that neighbor (look-ahead)

All candidates within 2 points of the top score are collected, and one is chosen at random. This produces outward-biased exploration with some randomness.

### Step 6: Execute Movement

**Explore mode** (L928):
The hero moves in a straight line in the chosen direction for up to `moveVal` steps:

```
for each step (up to moveVal):
  next_hex = current + direction_vector
  if out of bounds -> stop
  if hex is explored:
    if type == 'dread' -> STOP immediately (Dread Dungeon blocks)
    else if this is the final step -> land here
    else -> pass through (continue)
  if hex is unexplored:
    if tile deck empty -> stop
    draw tile from deck, place it on the map
    if tile is 'dread' -> STOP immediately
    land here (update currentQ/R)
```

Key behaviors:
- Explored non-Dread tiles are passed through, not resolved again
- Dread Dungeons always halt movement, whether newly placed or already explored
- New tiles are placed as the hero walks through them
- If all steps land on explored tiles and hero hasn't moved, it falls back to the last scanned position (L1001)

**Return-to-entrance mode** (L1009):
Uses `findPathAvoidDD()` for BFS pathfinding. Walks step-by-step along the path for up to `moveVal` steps. Dread Dungeons are avoided as intermediate waypoints (but can be start/end). Stops immediately upon reaching (0,0).

### Step 7: Post-Movement

1. Update hero position (L1028)
2. If arrived at entrance, spend Gil (L1031)
3. **Dungeon floor equipment** -- 30% chance per move to find a dropped equipment pile. If a guardian enemy is present, the AI evaluates whether to fight (`heroStr >= guardianStr + 1` OR no equipment and loot value >= 2). If no guardian, free pickup (L1051).
4. **Reality Warp (Lulu)** -- if Lulu landed on a non-Wonder tile and `shouldUseSkill()` agrees (Dread room, or Common with hero STR < 4), she warps away and skips room resolution entirely (L1041)
5. **Room resolution** via `resolveRoom()` (L1096)
6. **Vanga weapon bonus** -- if hero has Vanga and landed on a Wonder room, draw an extra Legendary item (L1099)

---

## 4. Room Resolution

### `resolveRoom()` (engine.js ~L1105)

Routes to the appropriate draw function based on room type:

| Room Type | Function | What Happens |
|-----------|----------|--------------|
| Wonder | `drawWonder()` | Draw 1 Wonder card |
| Common | `drawMishap()` | Draw 1 Mishap card |
| Dread | `drawDread()` | Draw 1 Misfortune + 1 Legendary (guarded) |

### Wonder Cards -- `drawWonder()` -> `resolveWonderCard()` (L1138, L1199)

Two types: encounters and followers.

**Encounters:**
| Card | Effect Code | Simulator Behavior |
|------|------------|-------------------|
| Priestess of Light | `recharge_all_skills` | All hero skills set to ready |
| Wisp | `recharge_1_skill` | Recharge 1 exhausted skill |
| Generous Merchant | `draw_legendary` | Draw 1 Legendary equipment |
| Generous Merchant 2 | `equip_full` | Draw Legendary until all slots full |
| Blacksmith / Barter Merchant | `swap_equipment` | Discard lowest-STR removable equipment, draw 1 Legendary |
| Witchdoctor | `remove_stalker` | Remove first stalker from hero |
| Good Genii | `remove_enemy` | Logged but no mechanical effect in sim |
| Dungeon Guardian | `move_to_revealed` | Logged but no mechanical effect |
| Oracle | `peek_3_tiles` | Logged but no mechanical effect |
| Dungeon Master | `swap_rooms` | Logged but no mechanical effect |

**Followers:** Added to hero's follower list. If `followersEnabled` tweak is false, followers are skipped. See Section 9 for follower effects.

### Mishap Cards -- `drawMishap()` -> `resolveMishapCard()` (L1146, L1250)

Four types: encounters, followers, stalkers, traps, enemies.

- **Encounters**: Minor effect, just logged (Castle Architect, Barter Merchant)
- **Followers**: Leprechaun (swap 1<->6) and Drunkard (stop on enemy) -- added to hero
- **Stalkers**: Corrupted Squire, Old Hag, Mutt -- attached to hero. Old Hag immediately discards all other followers (except Faithful Dog)
- **Traps**: See trap resolution below
- **Enemies**: Routed to `combat()` with tier `'mishap'`

### Misfortune Cards -- `drawMisfortune()` -> `resolveMisfortuneCard()` (L1154, L1279)

Three types: stalkers, traps, enemies. Same routing as Mishap but enemies use tier `'misfortune'`.

### Dread Dungeon -- `drawDread()` (L1162)

1. Check for Seasoned Adventurer follower (logged as drawing 2 misfortunes, but only 1 is actually drawn in the current implementation)
2. Draw 1 Legendary equipment (the "guarded" loot) -- stored but not yet equipped
3. Draw 1 Misfortune card
4. If hero survived (not KO'd), equip the guarded Legendary item

### Trap Resolution -- `resolveTrap()` (L1294)

**Spell Mirror check first**: if Lulu has Spell Mirror ready and `shouldUseSkill()` agrees, the trap is cancelled entirely (L1297).

| Trap | Effect Code | Mechanic |
|------|------------|---------|
| Crumbling Floor | `roll_1_2_ko` | Roll d6: 1-2 = KO |
| Giant Web | `exhaust_or_ko` | If any ready skills: exhaust 1. Else: KO |
| Spike Trap | `roll_1_3_ko` | Roll d6: 1-3 = KO |
| The Tribute | `ko_or_exhaust_all` | If any ready skills: exhaust ALL. Else: KO |
| Guillotine | `fewer_2_skills_ko` | If fewer than 2 ready skills: KO |
| Hall of Mirrors | `fight_self_4dice` | Enemy rolls 4 dice, keeps the max. Hero rolls normally (die + totalStr). Lose = KO |
| Trap Alarm | `draw_dread` | Triggers a full Dread Dungeon encounter (Legendary + Misfortune) |
| Magnetic Field | `flame_or_discard_equip` | ALL heroes with equipment roll: Flame = safe, non-Flame = lose 1 equipment |
| Spectral Theft | `discard_1_equip` | Hero loses lowest-STR removable equipment |
| Stink Bomb | `lose_followers` | All followers removed (Faithful Dog is kept via `removeFollowers()`) |
| Trap Door | `go_back` | Hero teleported to entrance (0,0) |
| Static Fog | `block_room` | Logged as resolved, no mechanical effect |

---

## 5. Combat System

### `combat()` (engine.js ~L1461)

This is the main combat entry point for dungeon fights.

### Pre-Combat Flow

1. **Tweak modifiers**: enemy STR can be globally adjusted by `mishapEnemyStrMod` or `misfortuneEnemyStrMod` based on tier (L1469)
2. **Special enemy STR**: Faceless One gets random 1-6 STR; Fishguard gets +2 per relic held by party (L1475)
3. **Pre-combat avoidance decisions**:
   - **Bully** (`flee_or_str6`): If hero's `totalStr > Bully's base STR (3)`, Bully flees (fight avoided). Otherwise Bully fights at STR 6. (L1487)
   - **Rat Swarm** (`push_to_room`): If hero's `totalStr > enemy STR`, scared off (L1502)
   - **Bandit** (`discard_equip_or_fight`): If hero has removable equipment AND `totalStr < enemyStr + 3`, discard lowest-STR equipment to avoid fight. Otherwise fight. (L1512)
4. **Spell Mirror**: cancels dangerous enemy effects if Lulu agrees (L1529)
5. **Pre-combat enemy effects** (if not spell-mirrored):
   - Snakerogue: exhaust 1 hero skill (L1535)
   - Stormcaller AoE: each hero rolls d6, on 1-2 loses a skill (L1540)
   - Mana Leech: if hero has 2+ ready skills, exhaust 2. Otherwise hero gets -2 in combat (L1548)
   - Frogman: swallows 1 hero equipment (returned on win) (L1562)

### Skill Activations Before the Fight

These are evaluated via `shouldUseSkill()` for each:

| Skill | Hero | Effect | Condition |
|-------|------|--------|-----------|
| Second Nature | Gigi | +3 STR if no equipment | No equipment equipped |
| Siphon | Lulu | -2 to enemy STR (cross-hero: helps ANY hero in combat) | Based on phase and enemy STR thresholds |
| Copycat -> Siphon | Eggo | Additional -2 to enemy STR (copies Lulu's Siphon if ready) | Enemy STR >= 3 |
| Copycat -> Pack Leader | Eggo | +followers count STR | If Siphon not available, hero has 2+ followers |
| Pack Leader | Gigi | +1 per follower | Gigi has followers and enemy STR >= 2 |
| Overload | Lulu | Exhaust all remaining ready skills, +2 per skill exhausted | At Hydra or enemy STR >= 5, needs 2+ ready skills (3+ in dungeon) |
| Heist | Eggo | -1 STR penalty, but win = draw Legendary | Not at Hydra, not prehydra, enemy STR <= 3 |
| Battlecry | Juju | Roll 2 dice keep WORST, but win = all heroes recharge 2 skills | totalStr >= enemyStr + 2 (can win even with worst die) |

### Equipment Pre-Fight Effects

| Equipment | Effect | Line |
|-----------|--------|------|
| Doomhammer | Roll d6: 1-2 = instant KO, 3-4 = +1 STR, 5-6 = +3 STR | L1669 |
| Firebane | If hero has 2+ ready skills and enemy STR >= 4: exhaust 1 skill for +1 STR | L1687 |
| Demon Sword | +1 if hero is on a Dread Dungeon tile | L1695 |
| Warlord Armour | If enemy STR > hero totalStr: double hero's base STR | L1703 |

### `singleFight()` (engine.js ~L1817)

Runs one round of combat (may be called twice for Slayer's `fight_twice` effect).

#### Enemy Roll

| Enemy Type | Roll Method |
|-----------|-------------|
| Jack o' Lantern (`rolls_2_best_double_lose`) | 2 dice, keep best. If doubles: hero auto-loses |
| Ghoul (`rolls_2_best`) | 2 dice, keep best |
| All others | 1 die |

Enemy total = die result + enemy STR.

**Mummy** (`flame_minus2`): if enemy's roll is a Flame, hero gets -2 penalty (L1852).

**Mud Golem** (`must_beat_by_2`): hero must beat enemy total by 2+ to win (L1858).

#### Hero Roll

Roll method depends on equipment/skills:

| Priority | Source | Method |
|----------|--------|--------|
| 1 | Battlecry active | Roll 2 dice, keep WORST |
| 2 | Triple Axe (equipment) | Roll 3 dice, keep best |
| 3 | Veteran (follower) OR Cheap Shot (skill) | Roll 2 dice, keep best |
| 4 | Default | Roll 1 die |

The die is rolled via `heroRollDie()` which applies the Leprechaun 1<->6 swap.

**Assassin check** on the combat roll (L1899).

#### Roll Modifiers (applied to hero's roll value)

| Enemy | Effect | Modifier |
|-------|--------|----------|
| Mycoid | `flame_counts_0` | If Flame: roll value becomes 0, talent doesn't trigger |
| Djin | `only_flame_hits` | If NOT Flame: roll value becomes 0 |
| Longlegs Spider | `only_even_hits` | If roll is odd: becomes 0 |
| Stone Gargoyle | `only_3plus_hits` | If roll < 3: becomes 0 |

#### Talent Trigger in Combat

If the hero's roll is Flame, talent hasn't been used this turn, and no Cursed Beggar stalker: `triggerTalent(hero, 'combat')` fires (L1932). Juju gets +2 combat bonus from Unwavering Power.

#### Auto-Win Checks

- **Wooden Spoon**: roll exactly 1 = auto win (L1945)
- **Archangel follower**: Flame = auto win (non-Hydra only) (L1951)

#### Hero Total Calculation (L1987)

```
heroTotal = heroRoll.val + heroStrValue + combatBonus
          + doomhammerBonus + firebaneBonus + demonSwordBonus
          + warlordBonus + mummyPenalty + manaLeechPenalty
          + parrotBonus + blobPenalty + packLeaderBonus
          + fireballBonus (Overload) + heistPenalty + secondNatureBonus
```

Where:
- `heroStrValue` = `totalStr(hero)` unless Squelette (`base_only`) where it's just `hero.str`
- `combatBonus` = +2 if Juju rolled Flame and talent triggered
- `parrotBonus` = +1 from Arcane Parrot (if hero has 2+ ready skills and enemy STR >= 4)
- `blobPenalty` = negative sum of all weapon STR (Blob negates weapons)
- Siphon Blade: +1 to hero AND -1 to enemy total

### `totalStr()` Function (engine.js ~L490)

```
s = hero.str (base)
+ sum of equipment STR (skip weapons if noWeapons flag)
+ per-equipment tweak STR modifiers
+ sum of follower STR
+ stalker adjustments (Fear Ghost: -2)
+ Virtuous Sword: +min(readySkillCount, 2)
+ per relic: +2 if matched owner, +1 otherwise
```

### Skill Burn (Reroll) -- L1993

If hero is losing (`heroTotal < enemyTotal + beatMargin`) and has ready skills, the AI evaluates two options:

**Option A**: Reroll hero's die (new hero roll, recalculate total)
**Option B**: Reroll enemy's die (keep hero roll, enemy gets new roll)

The AI picks whichever option:
1. Would turn a loss into a win (preferred)
2. If both win or neither wins: pick the larger improvement
3. Only burns if the new result is actually better

This costs 1 skill exhaustion. Only happens if the fight is "worth it" -- in prehydra phase, requires enemy STR >= 4 or hero loadout value >= 4 (`koLoadoutValue()`).

### Combat Resolution -- L2067

**Win** (`heroTotal >= enemyTotal + beatMargin`):
- `monstersKilled++`
- Gil reward (if enabled)
- On-win effects:
  - Frogman: equipment returned
  - Golem: if hero rolled exactly 3, Golem becomes a follower (+3 STR)
  - Mimic: draw Legendary
  - Heist: draw Legendary
  - Battlecry: all heroes recharge 2 skills
  - Thiefling Rats: hero still loses 1 equipment even on win
  - Mystic Wand: all skills recharged
  - Supernova Gun: roll 6 = clear all dungeon enemies
  - Sacerdote Fishfolk: roll 1-2 = sent to entrance

**Loss** (`heroTotal < enemyTotal + beatMargin`):
Goes to `handleCombatLoss()`.

### Not Today! (Juju) -- L2092

Checked on loss when margin is 1-2. If Juju has "Not Today!" ready, the loss is converted to a win. All on-win effects (Frogman recovery, Mystic Wand, etc.) trigger. This is a cross-hero skill -- Juju can save ANY hero's fight.

### `handleCombatLoss()` (L2136)

KO prevention chain (checked in order):

1. **shouldPreventKO()** -- AI decides if saving is worthwhile (L2391):
   - At Hydra: always prevent
   - `koLoadoutValue < 2`: don't bother
   - `koLoadoutValue >= 6`: always prevent
   - Otherwise: prevent only if 3+ ready skills
2. **Shield Wall (Juju)** -- prevents KO on self or any ally (L2142)
3. **Copycat -> Shield Wall (Eggo)** -- copies Juju's Shield Wall if available (L2153)
4. **Warden Angel follower** -- sacrifices self to turn loss into a win (L2166)
5. **Dodge (Eggo talent)** -- if dodgeActive is true (Flame was rolled this turn), avoids KO (L2182)
6. **Berserker Helmet** -- retry fight: hero and enemy both re-roll, simplified combat. If hero wins retry, fight counts as a win. Uses `_berserkerUsed` flag to prevent recursion (L2192)

Special loss effects:
- **Dragon** (`gains_str_on_loss`): enemy gains +1 STR permanently (L2214)
- **Hound** (`follows_on_loss`): doesn't KO, instead follows hero and attacks next turn (L2220)
- **Ogre** (`no_respawn_on_loss`): KO without respawn, hero loses equipment and followers but stays on tile (L2227)

If nothing prevents it, `applyKO()` is called.

### `applyKO()` (L2399)

**At Hydra:**
- If party has relics: spend one relic (preferring unmatched relics from heroes with the most relics) to survive
- If NO relics: **GAME OVER**
- KO'd hero drops all equipment except Parasite Sword onto `hydraFloorEquipment`
- Loses all followers (Faithful Dog kept)
- Respawns at entrance with `runningToHydra = true`

**In Dungeon:**
- **Relic save decision**: spend a relic if `(loadout >= 6 AND totalRelics > 1) OR (loadout >= 10)`. This is more conservative than Hydra saves.
- If no relic spent: hero loses all equipment (except Parasite Sword), followers (except Faithful Dog), and ALL stalkers (silver lining)
- Dropped equipment goes to `dungeonFloorEquipment` with the killing enemy as guardian
- Hero respawns at entrance (0,0)

---

## 6. Skills -- Complete Implementation

### Juju

**Battlecry** (Combat, L1659):
- Roll 2 dice, keep the WORST
- If win: ALL heroes recharge 2 skills each
- AI uses when: `totalStr >= enemyStr + 2` (can likely win even with bad die)
- At Hydra: uses when `totalStr + 1 >= headStr`

**Shield Wall** (Reactive, L2142):
- Prevents KO on Juju or ANY ally
- Cross-hero: checked in `handleCombatLoss()` for whoever is losing
- AI uses when: at Hydra (always) or hero has equipment/relics to protect

**Not Today!** (Combat, L2092):
- If any hero loses by margin 1-2, Juju converts loss to win
- Cross-hero: works on any hero's fight
- The loss is fully reversed -- all on-win effects trigger

**Taunt** (Combat, L762 dungeon, L3012 Hydra):
- In dungeon: pick a random Mishap enemy and fight it (extra combat)
- At Hydra: grants an additional `hydraAttack()` call
- AI uses in early/mid phases and always at Hydra

### Gigi

**Herbalist** (Support, L684):
- Cross-turn: activates at the START of ANY hero's turn (not just Gigi's)
- Recharges 1 skill for the hero with the most exhausted skills (ties favor the active hero)
- AI always uses if a hero has exhausted skills

**Wild Call** (Support, L718):
- Draws from Wonder deck until a follower is found
- Non-follower cards are returned and deck reshuffled
- AI uses when Gigi has fewer than 2 followers, not in prehydra phase

**Second Nature** (Combat, L1576):
- +3 STR for this fight if Gigi has no equipment
- AI uses whenever Gigi has no equipment

**Pack Leader** (Combat, L1618):
- +1 STR per follower for this combat
- AI uses when Gigi has followers and enemy STR >= 2 (dungeon) or always at Hydra with followers

### Lulu

**Siphon** (Combat, L1584):
- -2 STR to enemy in combat
- Cross-hero: Lulu can use this during ANY hero's fight
- AI thresholds by phase: early >= 2, mid >= 3, prehydra >= 4, Hydra = always

**Overload** (Combat, L1627):
- Exhaust Overload, then exhaust ALL remaining ready skills
- +2 STR per skill exhausted (not counting Overload itself)
- Example: 3 ready (including Overload) -> exhaust Overload + 2 others -> +4 STR
- AI uses at Hydra (always, if 2+ ready) or vs enemies STR >= 5 with 3+ ready

**Reality Warp** (Utility, L1041):
- Move self or ally to any revealed tile
- In simulator: used defensively to skip dangerous rooms
- Triggers when landing on Dread, or Common with hero STR < 4
- AI skips in prehydra/hydra phases

**Spell Mirror** (Reactive, L1435):
- Cancels special effects of encounters, traps, or Hydra heads
- Lethal effects (always cancel): `ko_or_exhaust_all`, `roll_1_3_ko`, `fewer_2_skills_ko`, `fight_self_4dice`
- Dangerous effects (cancel in early/mid): `flame_counts_0`, `only_flame_hits`, `fight_twice`, `rolls_2_best_double_lose`, `aoe_skill_drain`, `exhaust_2_or_minus2`, `exhaust_or_ko`
- At Hydra: always used

### Eggo

**Cheap Shot** (Utility, L1868):
- Roll an additional die, keep the best result
- Not used if hero already has Triple Axe (redundant)
- AI uses when enemy STR >= 3 or at Hydra

**Copycat** (Utility, L1594 combat, L702 turn-start):
- Copies any ally's ready skill. That ally's skill stays ready. Copycat is exhausted.
- What it can copy (contextual):
  - **Siphon** (pre-combat, enemy STR >= 3): additional -2 to enemy
  - **Pack Leader** (pre-combat, hero has 2+ followers): +followers STR
  - **Shield Wall** (on KO, L2153): prevent KO
  - **Herbalist** (turn start, L702): recharge a skill if Eggo has 2+ exhausted
- AI at Hydra copies any useful skill (Siphon, Shield Wall, Spell Mirror, Not Today!, Herbalist, Overload)

**Heist** (Combat, L1651):
- -1 STR penalty for this fight
- If win: draw 1 Legendary Equipment
- AI uses only in early/mid phases vs enemies STR <= 3

**Shadowstep** (Utility, L776 dungeon, L3020 Hydra):
- Ends current turn, begins a completely new turn
- In dungeon: resets `talentUsedThisTurn` and `dodgeActive`, runs `movePhase()` again
- At Hydra: resets flags, runs `hydraAttack()` again
- AI uses in early/mid phases and at Hydra

---

## 7. Talents -- `triggerTalent()` (engine.js ~L2472)

Talents trigger on Flame rolls (movement or combat). Each hero gets one trigger per turn (`talentUsedThisTurn`).

**Blockers:**
- Cursed Beggar stalker (`no_flame_effect`): blocks talent
- Parasite Sword equipment (`cannot_remove_blocks_talent`): blocks talent

### Juju: Unwavering Power
- Context: combat only
- Effect: +2 to combat total (added as `combatBonus` at L1937)
- The +2 is tracked and included in the hero total calculation

### Gigi: Nature's Gift
- Context: both movement and combat
- Effect: gifts Flame to a random ally for their next turn (`target.giftedFlame = true`)
- The gifted Flame counts as a Flame for the recipient's next roll (movement or combat)

### Lulu: Arcane Recharge
- Context: both movement and combat
- Effect: recharge 1 exhausted skill

### Eggo: Dodge
- Context: both movement and combat
- Effect: sets `hero.dodgeActive = true`
- When dodgeActive, the hero cannot be KO'd for the remainder of the turn
- Checked in `handleCombatLoss()` at L2182 and in Hydra at L2932

---

## 8. Equipment System

### Equip Slots

- Base: 2 slots
- Page follower (`inventory_+1`): 3 slots
- `maxEquipSlots()` (L519)

### `equipItem()` (L524)

When hero's equipment count >= max slots:
1. Filter out Parasite Sword (cannot be removed)
2. If all slots are locked (only Parasite Swords): item cannot be equipped
3. Sort removable equipment by STR ascending
4. Discard the lowest-STR item to make room
5. Push new item

### `drawLegendaryItem()` (L1116)

Pops indices from `legendaryDeck`. Skips disabled items (per tweaks). Applies per-item STR modifiers from tweaks. Calls `equipItem()`.

### Complete Equipment List

**Weapons:**

| Name | Base STR | Effect Code | Simulator Behavior |
|------|----------|------------|-------------------|
| Triple Axe | +2 | `roll_3_keep_best` | Roll 3 dice in combat, keep highest |
| Firebane | +1 | `exhaust_skill_+1` | Exhaust 1 skill for +1 STR (when 2+ ready skills, enemy STR >= 4) |
| Demon Sword | +2 | `dd_+1` | Additional +1 STR when on a Dread Dungeon tile |
| Wooden Spoon | +2 | `roll_1_auto_win` | Rolling 1 = auto-win |
| Doomhammer | +2 | `roll_gamble` | Pre-fight roll: 1-2 = KO, 3-4 = +1, 5-6 = +3 |
| Virtuous Sword | +1 | `+1_per_ready_skill` | +min(readySkillCount, 2) added in `totalStr()` |
| Siphon Blade | +1 | `drain_1` | +1 to hero AND -1 to enemy total |
| Vanga | +2 | `wonder_draw_legendary` | Landing on Wonder room draws an extra Legendary |
| Parasite Sword | +3 | `cannot_remove_blocks_talent` | Cannot be removed. Blocks talent activation. Survives KO. |
| Mystic Wand | +1 | `win_recharge_all` | On combat win: all skills recharged |
| Supernova Gun | +2 | `win_roll_6_clear` | On win: roll d6, on 6 clear all dungeon enemies |

**Armour:**

| Name | Base STR | Effect Code | Simulator Behavior |
|------|----------|------------|-------------------|
| Cursed Armour | -1 | `exhaust_all_recharge_1` | When all skills exhausted: recharge 1 (`checkCursedArmour()` at L569) |
| Stivali delle Sette Leghe | 0 | `choose_stop` | Logged but no mechanical effect in sim |
| Warlord Armour | 0 | `double_base_if_weaker` | If enemy STR > hero totalStr: hero base STR doubled |
| Wizard Hat | 0 | `turn_start_recharge` | Turn start: roll d6, on 4+ recharge 1 skill |
| Darksight Helm | 0 | `peek_adjacent` | Logged but no mechanical effect |
| Ninja Tabi | 0 | `move_2_dice` | Roll 2 dice for movement, keep best |
| Berserker Helmet | 0 | `retry_on_loss` | On combat loss: retry fight (both sides re-roll). One retry per fight. |

---

## 9. Followers and Stalkers

### Followers

Followers are gained from Wonder and Mishap decks. They persist until KO (all lost except Faithful Dog) or specific effects remove them. `removeFollowers()` (L630) always preserves the Faithful Dog.

| Name | Source | Effect Code | Behavior |
|------|--------|------------|---------|
| Page | Wonder | `inventory_+1` | +1 equipment slot (3 max) |
| Spectral Horse | Wonder | `movement_+2` | +2 to movement roll |
| Archangel | Wonder | `flame_auto_win` | Flame in combat = auto-win (non-Hydra) |
| Seasoned Adventurer | Wonder | `dd_draw_2_keep_1` | Dread Dungeon: logged as drawing 2 misfortunes (actual: draws 1) |
| Arcane Parrot | Wonder | `exhaust_skill_str+1` | In combat: exhaust 1 skill for +1 STR (when 2+ ready skills, enemy STR >= 4) |
| Veteran | Wonder | `roll_2_keep_best` | Roll 2 dice in combat, keep best |
| Faithful Dog | Wonder | `reroll_flame` | Cannot be removed by any effect (kept on KO, kept by `removeFollowers()`) |
| Warden Angel | Wonder | `discard_win_fight` | On combat loss: sacrifice self, convert to win |
| Monster Hunter | Wonder | `skip_move_fight_enemy` | Logged but no mechanical effect in sim |
| Leprechaun | Mishap | `swap_1_6` | All die rolls: 1 becomes 6, 6 becomes 1 (via `heroRollDie()`) |
| Drunkard | Mishap | `stop_on_enemy` | Logged but no mechanical effect |
| Golem (from combat) | Combat | `none` | +3 STR (gained when defeating Golem enemy with exact roll of 3) |

### Stalkers

Stalkers attach to a hero and persist until removed (Witchdoctor wonder card, KO in dungeon clears all stalkers).

| Name | Source | Effect Code | Behavior |
|------|--------|------------|---------|
| Corrupted Squire | Mishap | `exhaust_per_equip` | Logged but no mechanical effect in sim |
| Old Hag | Mishap | `discard_followers` | On attachment: immediately discards all other followers |
| Mutt | Mishap | `roll_1_discard_equip` | Logged but no mechanical effect in sim |
| Fear Ghost | Misfortune | `-2_combat` | -2 to hero STR in `totalStr()` |
| Cursed Beggar | Misfortune | `no_flame_effect` | Blocks talent activation on Flame |
| Assassin | Misfortune | `roll_1_ko` | On any die roll of 1: instant KO (`checkAssassin()` at L457) |
| Baba Yaga | Misfortune | `move_1_only` | Caps movement to 1 |

---

## 10. Gil System (engine.js ~L587)

The Gil system is optional, enabled via tweaks (`gilEnabled`). Default settings: 1 Gil per enemy STR, 3 Gil to recharge 1 skill, 6 Gil to buy 1 Legendary equipment.

### Earning Gil -- `gilReward()` (L591)
After winning combat: `earned = max(1, floor(enemyStr * gilPerStr))`. Added to `hero.gil`.

### Spending Gil -- `gilSpendAtEntrance()` (L599)
Only at the entrance. AI priority:
1. Buy equipment if hero has no weapon and can afford it and Legendary deck has cards
2. Recharge skills while affordable and has exhausted skills

### Return-to-Entrance Decision
See `decideMovementIntent()` in Section 3. The AI weighs whether the Gil spending is worth the trip, factoring in distance, needs, and affordability.

---

## 11. The Awakening -- `awakenEffect()` (engine.js ~L2513)

### Trigger
Flame roll during movement when `tilesPlaced >= 10`.

### First Awakening: Exit Placement
1. Find unexplored neighbors of hero's current position
2. Sort by distance from entrance (descending -- prefer farthest)
3. Place exit tile at the chosen hex
4. If no unexplored neighbors: use an explored non-entrance neighbor (farthest from entrance)
5. Mark the hex as type `'exit'`

### Subsequent Awakenings: Relic Distribution
Each subsequent Flame (with tiles >= 10) distributes a relic:
1. Pop a relic from the shuffled `relicPool`
2. Increment `relicsCollected`
3. **Recipient selection**: prefer the matched hero (e.g., Hero Relic -> Juju) if they have <= the fewest relics. Otherwise give to the hero with the fewest relics.
4. Relics give STR: +2 if held by matched owner, +1 otherwise (computed in `totalStr()`)

### Hydra Spawn Trigger
When `relicRoomsPlaced >= 4` (all 4 relics distributed) AND exit not yet revealed:
- Set `exitRevealed = true`
- Call `spawnHydra()`

---

## 12. Hydra Fight

### `spawnHydra()` (engine.js ~L2568)

1. Shuffle all 6 Hydra heads
2. Pick the first 3
3. Apply tweaked STR values if configured
4. Set `hydraActive = true`
5. Call `recalcHydraStr()` to apply The Nest bonus
6. `hydraMaxHeads` starts at 6

### Hydra Head Definitions

| Head | Base STR | Type | Ability |
|------|----------|------|---------|
| The Nest | 7 | passive | While alive: all OTHER heads get +2 STR |
| The Brood | 8 | passive | Flame has no special effect (blocks talent + Flame-based auto-wins) |
| The Wail | 10 | onDefeat | When destroyed: all heroes in Hydra area exhaust 1 skill |
| The Spite | 12 | onDefeat | When destroyed: grow 1 new head (special: never causes overflow, never revives itself) |
| The Fangs | 9 | onAttack | When targeted: all heroes in Hydra area exhaust 1 skill |
| The Maw | 8 | onAttack | When targeted: hero discards 1 equipment, or -2 if no equipment |

### `recalcHydraStr()` (L2586)

```
for each head:
  effectiveStr = max(1, baseStr + (nestBonus if not The Nest and Nest is alive))
```

The Nest gives +2 to all other living heads.

### `runToHydra()` (engine.js ~L3067)

When `runningToHydra = true`, hero moves toward the exit hex each turn:
1. Roll die for movement (with Leprechaun, Assassin check)
2. If at entrance, spend Gil first
3. If exit hex is known and pathfinding succeeds:
   - BFS path from hero to exit
   - Walk up to `moveVal` steps along path
   - If hero reaches exit: arrive at Hydra
4. Fallback (no path): probability-based (`0.4 + moveVal * 0.1`)

**Arrival** (`arriveAtHydra()` inner function):
- `runningToHydra = false`
- `pos = 'hydra'`
- Add hero to `heroesInHydraArea`

### `hydraAttack()` (engine.js ~L2595)

Full attack sequence for one hero against one head:

1. **Victory check**: if all heads destroyed, game won (L2597)
2. **Floor equipment pickup**: hero picks up dropped equipment from `hydraFloorEquipment` (sorted by STR descending). Skips Parasite Sword if hero already has equipment (L2604)
3. **Target selection** via `aiChooseHydraHead()`:
   - Priority 1: The Nest (if alive) -- always target first
   - Priority 2: lowest `effectiveStr` among living heads
4. **Spell Mirror**: check for Hydra head ability cancellation. Maps heads to effect codes: Fangs -> `exhaust_2_or_minus2`, Maw -> `exhaust_2_or_minus2`, Brood -> `flame_counts_0`
5. **On-Attack effects** (if not spell-mirrored):
   - The Fangs: all heroes in Hydra area exhaust 1 skill
   - The Maw: hero discards 1 removable equipment, or gets -2 if none
6. **Hero roll**: Triple Axe (3d keep best) > Veteran (2d keep best) > standard (1d). Assassin check.
7. **Flame suppression**: Flame is suppressed if The Brood is alive (unless spell-mirrored)
8. **Talent and combat bonus**: same as dungeon combat
9. **Doomhammer at Hydra**: same gamble roll; KO triggers `growHydraHead('doomhammer_ko')`
10. **Support skills** (coordinated across all heroes):
    - Lulu Siphon: -2 to head
    - Eggo Copycat -> Siphon: additional -2 (even non-attacking Eggo can contribute)
    - Pack Leader, Overload, Cheap Shot, Battlecry, Second Nature: same as dungeon
11. **Hero total** = roll + totalStr + all bonuses - drains
12. **Effective head STR** = head.effectiveStr - siphonDrain (equipment) - siphonSkillDrain (skills)

### Skill Burn at Hydra (L2828)

Simpler than dungeon: only rerolls the hero's die (heads don't roll dice). Reroll if new total > old total.

### Head Destruction

On `heroTotal >= effectiveHeadStr`:
- Mark head as destroyed
- **`hydraMaxHeads--`** (permanent reduction -- the Hydra loses a slot)
- On-defeat effects:
  - **The Wail**: all heroes in area exhaust 1 skill
  - **The Spite**: grow 1 head, but with special constraints:
    - Never causes overflow (checks `aliveCount < hydraMaxHeads`)
    - Never revives itself
    - Prefers unused head from pool, then revives a destroyed head
- Recalculate all head STR (Nest removal changes others)
- Equipment effects: Mystic Wand, Supernova Gun
- If all heads destroyed: **VICTORY**

### Attack Failure

On `heroTotal < effectiveHeadStr`:
1. Dodge check (Eggo)
2. Berserker Helmet retry (same as dungeon but vs head STR)
3. KO prevention skills: Shield Wall (Juju), Copycat -> Shield Wall (Eggo)
4. If skill saves hero: head still grows (`growHydraHead('failed_attack')`)
5. If no save: hero KO'd, `applyKO()`, then `growHydraHead('hero_ko')`

Post-attack skills:
- **Battlecry**: if Juju won, all heroes recharge 2 skills
- **Taunt (Juju)**: extra `hydraAttack()` call
- **Shadowstep (Eggo)**: extra `hydraAttack()` call (resets turn flags)

### `growHydraHead()` (engine.js ~L3031)

Called when:
- Hero fails an attack (even if skill-saved)
- Hero KO'd at Hydra
- Hydra area empty at end of round
- Assassin KO, Doomhammer KO
- Spite on-defeat

Logic:
1. Count alive heads. If `aliveCount >= hydraMaxHeads`:
   - If overflow enabled: **GAME OVER**
   - If overflow disabled: no growth, just logged
2. Check for unused heads (not yet in `hydraHeads` array). Pick randomly from pool.
3. If all 6 head types already used: revive a destroyed head instead.
4. Recalculate STR.

### Max Heads Mechanic

`hydraMaxHeads` starts at 6 and decreases by 1 each time a head is destroyed. This means:
- Destroy head -> max goes from 6 to 5
- New head grows -> alive could be 3 again, but max is now 5
- This creates a ratchet: the more heads you kill, the fewer can exist simultaneously
- Overflow happens when alive heads would exceed the current max

---

## 13. Game End Conditions

### Victory
All Hydra heads destroyed (`G.hydraHeads.every(h => h.destroyed)`). Checked in `hydraAttack()` at L2924 and L2955.

### Defeat Conditions

1. **Hydra KO with no relics** (L2410): A hero is KO'd at the Hydra and the party has 0 relics remaining.
2. **Hydra overflow** (L3036): Alive head count >= `hydraMaxHeads` when a new head needs to grow (if overflow is enabled).
3. **Safety limit**: `runSilentGame()` (in ui.js) caps at 2000 turns. If reached, game ends as a loss.

---

## 14. AI Decision Making

### `shouldUseSkill()` (engine.js ~L2280)

Central skill-use decision function. Takes hero, skill name, and context (enemyStr, atHydra, etc.). Returns boolean.

**Phase-based logic** via `getGamePhase()` (L2273):
- `'early'`: tilesPlaced < 10
- `'mid'`: tilesPlaced >= 10, relicsCollected < 3
- `'prehydra'`: relicsCollected >= 3, Hydra not yet active
- `'hydra'`: Hydra active

Key decision thresholds:

| Skill | Early | Mid | Prehydra | Hydra |
|-------|-------|-----|----------|-------|
| Siphon | enemyStr >= 2 | >= 3 | >= 4 | always |
| Shield Wall | has equip/relics | same | same | always |
| Spell Mirror | lethal/dangerous | lethal/dangerous | lethal only | always |
| Cheap Shot | >= 3 | >= 3 | >= 3 | always |
| Heist | <= 3 | <= 3 | never | never |
| Shadowstep | yes | yes | no | yes |
| Taunt | yes | yes | no | yes |
| Wild Call | followers < 2 | followers < 2 | never | N/A |
| Reality Warp | yes | yes | never | never |
| Overload | >= 5 & 3+ ready | same | same | always (2+ ready) |
| Battlecry | totalStr >= eStr+2 | same | same | totalStr+1 >= headStr |

### `shouldPreventKO()` (L2391)

```
if at Hydra: always prevent
if koLoadoutValue < 2: don't prevent
if koLoadoutValue >= 6: prevent
else: prevent if readySkillCount >= 3
```

`koLoadoutValue()` (L2264): `sum(equip.str + 2) + sum(follower.str + 3) - sum(stalker * 2)`

### Movement Intent
See Section 3 -- `decideMovementIntent()` evaluates whether to return to entrance for Gil spending.

### Combat Choices
- **Bully**: flee if hero STR > Bully base (3). Fight at STR 6 otherwise.
- **Bandit**: pay (discard lowest equipment) if hero has removable equipment AND totalStr < enemyStr + 3. Fight otherwise.
- **Dungeon floor guardian**: fight if hero STR >= guardian STR + 1, OR hero has no equipment and loot value >= 2.

### Hydra Target Selection -- `aiChooseHydraHead()` (L641)
1. The Nest if alive (always priority -- removes +2 buff from all others)
2. Otherwise: lowest effectiveStr head

### Relic Spending -- `spendPartyRelic()` (L2243)
When spending a relic (Hydra KO save or dungeon save):
- Score each relic: unmatched relics score higher (+10), heroes with more relics score higher
- Spend the highest-scored relic first (preserves matched relics for STR bonus)

---

## 15. Monster Movement -- `monsterMovementPhase()` (engine.js ~L3144)

This function is called at the end of each round (after all 4 heroes act) but is essentially a **stub**:

```javascript
function monsterMovementPhase() {
  if (G.tilesPlaced < 10) return;
}
```

No enemies actually move on the board. The `enemiesOnBoard` array exists in state but is only used by the Supernova Gun effect (which clears it). The Demon enemy (`moves_2_per_round`) is defined in data but its movement is not implemented.

### End-of-Round Hydra Checks (in `nextHero()`, L3149)

When `currentHero` wraps to 0:
1. `monsterMovementPhase()` called (no-op)
2. If Hydra is active:
   - If NO hero is in the Hydra area and exit is revealed: `growHydraHead('hydra_area_empty')` -- the Hydra grows a head for being uncontested
   - For each hero NOT in Hydra area and NOT running:
     - If all 4 relics collected: start running to Hydra
     - If `prepareFirst` tweak: wait until hero has 2 equipment + 1 follower (or 40+ turns passed)

---

## 16. Batch Simulation -- `runSilentGame()` (ui.js ~L1338)

### Differences from Narrative Mode (`runTurn()`)

`runSilentGame()` is a self-contained loop that runs a complete game without UI updates or log rendering. Key differences:

1. **No log output**: `log()` calls still push to `G.log` but are never rendered during batch
2. **Simplified Herbalist**: In batch mode, Herbalist only activates on Gigi's own turn (not cross-turn for other heroes). Sorting prefers most exhausted, with slight bias toward self.
3. **Safety cap**: 2000-turn hard limit prevents infinite games
4. **Turn structure**: identical to `runTurn()` -- same skill logic, combat, movement, awakening, hydra
5. **Tweak application**: hero base STR is overridden at game start from tweaks
6. **No UI choices**: all decisions are AI-driven (same `shouldUseSkill()` logic)

The batch runner (`runBatchInternal()`) runs 1000 games in chunks of 50, yielding to the browser between chunks for responsiveness. Results are accumulated in `batchResults[]` and analyzed for win rate, average turns, KO frequency, and other statistics.

---

## Appendix A: Die Rolling

### `rollDie(hero)` (L434)
Returns `{val: 1-6, isFlame: boolean}`. Flame is true if `val` is in `hero.flameFaces`.

### `heroRollDie(hero)` (L441)
Calls `rollDie()`, then applies Leprechaun follower transform: if Leprechaun present, 1 becomes 6 and 6 becomes 1. Flame is recalculated for the new value.

### Flame Faces per Hero
- Juju: 4, 5, 6 (50% flame chance)
- Gigi: 2, 3, 4 (50% flame chance)
- Lulu: 1, 3, 6 (50% flame chance)
- Eggo: 1, 2, 3 (50% flame chance)

All heroes have exactly 3 flame faces out of 6, giving a uniform 50% flame probability.

---

## Appendix B: Full Card Lists

### Wonder Deck (17 cards)
10 encounters + 9 followers (see data.js L37-57)

### Mishap Deck (29 cards)
2 encounters + 2 followers + 3 stalkers + 7 traps + 15 enemies (see data.js L59-89)

### Misfortune Deck (27 cards)
3 stalkers + 5 traps + 19 enemies (see data.js L91-119)

### Legendary Equipment (17 cards)
11 weapons + 6 armour (see data.js L121-140)

---

## Appendix C: Unimplemented / Stub Mechanics

The following mechanics exist in the data or code but have no functional implementation in the simulator:

| Feature | Status |
|---------|--------|
| Monster movement on board | Stub function, no actual movement |
| Demon `moves_2_per_round` | Defined in data, not implemented |
| Drunkard `stop_on_enemy` | Follower added but effect not checked |
| Monster Hunter `skip_move_fight_enemy` | Follower added but effect not checked |
| Darksight Helm `peek_adjacent` | Equipment added but effect not checked |
| Stivali delle Sette Leghe `choose_stop` | Equipment added but effect not checked |
| Corrupted Squire `exhaust_per_equip` | Stalker attached but effect not checked |
| Mutt `roll_1_discard_equip` | Stalker attached but effect not checked |
| Static Fog `block_room` | Trap triggered but falls to default case |
| Good Genii `remove_enemy` | Wonder logged, no board enemy removal |
| Dungeon Guardian `move_to_revealed` | Wonder logged, no actual movement |
| Oracle `peek_3_tiles` | Wonder logged, no actual peeking |
| Dungeon Master `swap_rooms` | Wonder logged, no actual swap |
| Seasoned Adventurer `dd_draw_2_keep_1` | Logged as drawing 2, but only 1 Misfortune is actually drawn |
| Castle Architect `move_2_extra` | Logged as minor encounter, no extra movement |
| Faithful Dog `reroll_flame` | Cannot be removed, but the actual reroll-flame mechanic is not implemented |
| The Sphinx `guess_or_fight` | Treated as a normal STR 6 fight (no guessing mechanic) |
| Mad Berserker `fight_or_redirect` | Treated as a normal STR 4 fight |
| Mindflayer `top_of_deck` | Treated as a normal STR 5 fight |
| Stone Golem `adjacent_dread` | Treated as a normal STR 5 fight |
| Wind Elemental `move_to_revealed` (on-win) | Logged but hero doesn't actually move |
