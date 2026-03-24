// ========== GAME DATA ==========
const HEROES = [
  { id:'juju', name:'Juju', title:'The Hero', str:3, flameFaces:[4,5,6], color:'var(--juju)',
    talent:'Unwavering Power', talentDesc:'+2 to combat total',
    skills:[
      {name:'Battlecry',kind:'Combat',effect:'Roll 2 dice keep worst. If you win, all heroes recharge 2 Skills.'},
      {name:'Shield Wall',kind:'Reactive',effect:'Prevent a KO on you or an ally.'},
      {name:'Not Today!',kind:'Combat',effect:'If you or ally lose by 1-2, turn into a win.'},
      {name:'Taunt',kind:'Combat',effect:'Fight any enemy on the board. At Hydra: extra attack this turn.'}
    ]},
  { id:'gigi', name:'Gigi', title:'The Elf', str:2, flameFaces:[2,3,4], color:'var(--gigi)',
    talent:"Nature's Gift", talentDesc:'Gift Flame to another player next turn',
    skills:[
      {name:'Herbalist',kind:'Support',effect:'Choose any hero: they recharge 1 Skill.'},
      {name:'Wild Call',kind:'Support',effect:'Draw Wonder cards until you find a Follower. Take it.'},
      {name:'Second Nature',kind:'Combat',effect:'If you have no equipped items, gain +3 STR for this fight.'},
      {name:'Pack Leader',kind:'Combat',effect:'+1 STR per Follower for this combat.'}
    ]},
  { id:'lulu', name:'Lulu', title:'The Mage', str:1, flameFaces:[1,3,6], color:'var(--lulu)',
    talent:'Arcane Recharge', talentDesc:'Recharge 1 exhausted Skill',
    skills:[
      {name:'Siphon',kind:'Combat',effect:'Give -2 STR to an enemy.'},
      {name:'Reality Warp',kind:'Utility',effect:'Move yourself or any ally to any revealed tile.'},
      {name:'Overload',kind:'Combat',effect:'Exhaust all remaining Ready Skills. Gain +2 STR for each.'},
      {name:'Astral Echo',kind:'Reactive',effect:'When KO\'d in combat, make a free attack before KO consequences apply.'}
    ]},
  { id:'eggo', name:'Eggo', title:'The Rogue', str:2, flameFaces:[1,2,3], color:'var(--eggo)',
    talent:'Dodge', talentDesc:'Cannot be KO this turn',
    skills:[
      {name:'Cheap Shot',kind:'Utility',effect:'Roll an additional die. Keep the result you prefer.'},
      {name:'Copycat',kind:'Utility',effect:'Use any other Ready Skill in play. That Skill stays Ready. Exhaust Copycat.'},
      {name:'Daredevil',kind:'Combat',effect:'Roll 2 Fate Dice. Both Flame = auto-win. Otherwise keep worst, resolve normally.'},
      {name:'Shadowstep',kind:'Utility',effect:'End turn immediately. Begin a new turn from scratch.'}
    ]}
];

const WONDER_CARDS = [
  {name:'Priestess of Light',type:'encounter',effect:'recharge_all_skills'},
  {name:'Good Genii',type:'encounter',effect:'remove_enemy'},
  {name:'Dungeon Guardian',type:'encounter',effect:'move_to_revealed'},
  {name:'Generous Merchant',type:'encounter',effect:'draw_legendary'},
  {name:'Witchdoctor',type:'encounter',effect:'remove_stalker'},
  {name:'Oracle',type:'encounter',effect:'peek_3_tiles'},
  {name:'Echo of Victory',type:'encounter',effect:'recharge_all_1'},
  {name:'Wandering Armorer',type:'encounter',effect:'persistent_armorer'},
  {name:'Council Hall',type:'encounter',effect:'persistent_council'},
  {name:'Blacksmith',type:'encounter',effect:'swap_equipment'},
  {name:'Page',type:'follower',str:0,effect:'inventory_+1'},
  {name:'Spectral Horse',type:'follower',str:0,effect:'movement_+2'},
  {name:'Archangel',type:'follower',str:0,effect:'flame_auto_win'},
  {name:'Seasoned Adventurer',type:'follower',str:0,effect:'dd_draw_2_keep_1'},
  {name:'Arcane Parrot',type:'follower',str:0,effect:'exhaust_skill_str+2'},
  {name:'Veteran',type:'follower',str:0,effect:'roll_2_keep_best'},
  {name:'Faithful Dog',type:'follower',str:0,effect:'faithful_dog_v2'},
  {name:'Warden Angel',type:'follower',str:0,effect:'discard_win_fight'},
  {name:'Monster Hunter',type:'follower',str:0,effect:'skip_move_fight_enemy'},
  {name:'Arcane Familiar',type:'follower',str:0,effect:'cancel_effect_discard',description:'Discard: Cancel the special effect of any Encounter, Trap, or Hydra Head. One use.'}
];

const MISHAP_CARDS = [
  {name:'Cursed Crossroads',type:'encounter',effect:'persistent_crossroads'},
  {name:'Wandering Merchant',type:'encounter',effect:'temporary_merchant'},
  {name:'Leprechaun',type:'follower',str:0,effect:'swap_1_6'},
  {name:'Drunkard',type:'follower',str:0,effect:'stop_on_common'},
  {name:'Corrupted Squire',type:'stalker',effect:'exhaust_per_equip'},
  {name:'Old Hag',type:'stalker',effect:'discard_followers'},
  {name:'Mutt',type:'stalker',effect:'roll_1_discard_equip'},
  {name:'Stink Bomb',type:'trap',effect:'lose_followers'},
  {name:"Hydra's Roar",type:'global',effect:'global_skill_exhaust'},
  {name:'Giant Web',type:'trap',effect:'exhaust_or_ko'},
  {name:'Crumbling Floor',type:'trap',effect:'roll_1_2_ko'},
  {name:'Trap Alarm',type:'trap',effect:'draw_dread'},
  {name:'Magnetic Field',type:'trap',effect:'flame_or_discard_equip'},
  {name:'Thick Fog',type:'global',effect:'fog_next_movement'},
  {name:'Sacerdote Fishfolk',type:'enemy',str:1,effect:'pre_roll_skill'},
  {name:'Wind Elemental',type:'enemy',str:1,effect:'move_to_revealed'},
  {name:'Mud Golem',type:'enemy',str:2,effect:'must_beat_by_2'},
  {name:"Jack o' Lantern",type:'enemy',str:2,effect:'deal_or_stalker'},
  {name:'Rat Swarm',type:'enemy',str:3,effect:'scare_check'},
  {name:'Mimic',type:'enemy',str:3,effect:'draw_legendary'},
  {name:'Thiefling Rats',type:'enemy',str:1,effect:'steal_equipment'},
  {name:'Djin',type:'enemy',str:1,effect:'only_flame_hits'},
  {name:'Ghoul',type:'enemy',str:1,effect:'rolls_2_best'},
  {name:'Blob',type:'enemy',str:2,effect:'absorb_equipment'},
  {name:'Squelette',type:'enemy',str:2,effect:'mirror_equipment'},
  {name:'Snakerogue',type:'enemy',str:2,effect:'exhaust_1_skill'},
  {name:'Longlegs Spider',type:'enemy',str:2,effect:'bounce_on_loss'},
  {name:'FROGman',type:'enemy',str:2,effect:'global_shuffle_equipment'},
  {name:'Stone Gargoyle',type:'enemy',str:5,effect:'dormant_sneak'}
];

const MISFORTUNE_CARDS = [
  {name:'Wandering Shadow',type:'enemy',str:3,effect:'shelter_blocker'},
  {name:'Fear Ghost',type:'stalker',effect:'-2_combat'},
  {name:'Cursed Beggar',type:'stalker',effect:'no_flame_effect'},
  {name:'Assassin',type:'stalker',effect:'roll_1_ko'},
  {name:'Guillotine',type:'trap',effect:'fewer_2_skills_ko'},
  {name:'Spectral Theft',type:'trap',effect:'discard_1_equip'},
  {name:'The Tribute',type:'trap',effect:'ko_or_exhaust_all'},
  {name:'Spike Trap',type:'trap',effect:'roll_1_3_ko'},
  {name:'Hall of Mirrors',type:'trap',effect:'fight_self_4dice'},
  {name:'Baba Yaga',type:'stalker',effect:'move_1_only'},
  {name:'The Faceless One',type:'enemy',str:0,effect:'mirror_party_str'},
  {name:'Mana Leech',type:'enemy',str:3,effect:'exhaust_2_or_minus2'},
  {name:'Bully',type:'enemy',str:3,effect:'bp_extortion'},
  {name:'Mad Berserker',type:'enemy',str:4,effect:'dodge_chain'},
  {name:'Stormcaller',type:'enemy',str:4,effect:'aoe_skill_drain'},
  {name:'Bandit',type:'enemy',str:4,effect:'discard_equip_or_fight'},
  {name:'Mindflayer',type:'enemy',str:5,effect:'mindflayer_seed'},
  {name:'Stone Golem',type:'enemy',str:5,effect:'adjacent_dread'},
  {name:'The Sphinx',type:'enemy',str:6,effect:'guess_or_fight'},
  {name:'Fishguard',type:'enemy',str:0,effect:'plus2_per_relic'},
  {name:'Slayer',type:'enemy',str:4,effect:'fight_twice'},
  {name:'Mummy',type:'enemy',str:4,effect:'flame_minus2'},
  {name:'Hound',type:'enemy',str:4,effect:'follows_on_loss'},
  // {name:'Ogre',type:'enemy',str:5,effect:'no_respawn_on_loss'},  // DISABLED: causes infinite loop in sim, needs rework
  {name:'Dragon',type:'enemy',str:5,effect:'dragon_arrival'},
  {name:'Mycoid',type:'enemy',str:5,effect:'flame_counts_0'},
  {name:'Golem',type:'enemy',str:6,effect:'exact_3_follower'},
  {name:'Demon',type:'enemy',str:7,effect:'moves_2_per_round'}
];

const LEGENDARY_EQUIPMENT = [
  {name:'Triple Axe',type:'weapon',str:2,effect:'roll_3_keep_best'},
  {name:'Firebane',type:'weapon',str:1,effect:'exhaust_skill_+1'},
  {name:'Demon Sword',type:'weapon',str:2,effect:'dd_+1'},
  {name:'Wooden Spoon',type:'weapon',str:2,effect:'roll_1_auto_win'},
  {name:'Doomhammer',type:'weapon',str:2,effect:'roll_gamble'},
  {name:'Virtuous Sword',type:'weapon',str:1,effect:'+1_per_ready_skill'},
  {name:'Siphon Blade',type:'weapon',str:1,effect:'drain_1'},
  {name:'Vanga',type:'weapon',str:2,effect:'wonder_draw_legendary'},
  {name:'Parasite Sword',type:'weapon',str:3,effect:'cannot_remove_blocks_talent'},
  {name:'Mystic Wand',type:'weapon',str:1,effect:'win_recharge_all'},
  {name:'Supernova Gun',type:'weapon',str:2,effect:'win_roll_6_clear'},
  {name:'Cursed Armour',type:'armour',str:-1,effect:'exhaust_all_recharge_1'},
  {name:'Stivali delle Sette Leghe',type:'armour',str:0,effect:'choose_stop'},
  {name:'Warlord Armour',type:'armour',str:0,effect:'double_base_if_weaker'},
  {name:'Wizard Hat',type:'armour',str:0,effect:'turn_start_recharge'},
  {name:'Darksight Helm',type:'armour',str:0,effect:'peek_adjacent'},
  {name:'Ninja Tabi',type:'armour',str:0,effect:'move_2_dice'},
  {name:'Berserker Helmet',type:'armour',str:0,effect:'retry_on_loss'}
];

const HYDRA_HEADS = [
  {name:'The Nest',str:8,skillType:'passive',skill:'While alive, all heads gain +2 STR',strBonus:2},
  {name:'The Brood',str:8,skillType:'passive',skill:'Flame has no special effect',noFlame:true},
  {name:'The Wail',str:10,skillType:'onDefeat',skill:'On destroy: all heroes exhaust 1 Skill'},
  {name:'The Spite',str:12,skillType:'onDefeat',skill:'On destroy: grow 1 extra head',growOnDefeat:true},
  {name:'The Fangs',str:9,skillType:'onAttack',skill:'When targeted: all heroes exhaust 1 Skill'},
  {name:'The Maw',str:8,skillType:'onAttack',skill:'When targeted: drop 1 Equipment (guarded by head, recovered on defeat)'}
];

const RELICS = [
  {id:'hero_relic', name:'Hero Relic', owner:'juju'},
  {id:'ranger_relic', name:'Ranger Relic', owner:'gigi'},
  {id:'wizard_relic', name:'Wizard Relic', owner:'lulu'},
  {id:'rogue_relic', name:'Rogue Relic', owner:'eggo'}
];
