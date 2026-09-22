export interface GameCharacterPreset {
  id: string;
  nameZh: string;
  nameEn: string;
  avatar: string;
  categoryZh: string;
  categoryEn: string;
  dialogueZh: string;
  dialogueEn: string;
  directionEn: string;
  voiceDescriptionEn: string;
  characterEn: string;
  sceneEn: string;
  directionDetailedEn: string;
}

export const GAME_CHARACTER_PRESETS: GameCharacterPreset[] = [
  {
    id: "abyssal_shark",
    nameZh: "深海狂鲨",
    nameEn: "Abyssal Berserker Shark",
    avatar: "🦈",
    categoryZh: "先锋突击语音",
    categoryEn: "Vanguard Assault Lines",
    dialogueZh: "将他们碾碎成渣！",
    dialogueEn: "Crush them into dust!",
    directionEn: "Fierce, ravenous, and explosive. Use a deep, guttural predator growl with heavy breath. Deliver the shout with sudden bursts of fury, emphasizing crush and dust.",
    voiceDescriptionEn: "A terrifying oceanic predator warrior with a deep, raspy, and menacing voice. Low-pitched register filled with throat friction, watery resonance, and feral hunger. His delivery is swift, unrelenting, and charged with deadly authority, echoing the savage might of an apex abyssal hunter.",
    characterEn: "A blood-frenzied shark gladiator leading the vanguard of the deep trench fleet. Aggressive, territorial, and ruthless, he revels in shattering enemy battlements with sheer bodily force.",
    sceneEn: "Charging into a breached fortress gate amidst boiling undersea currents, rallying shock troops while hunting the fleeing garrison commander.",
    directionDetailedEn: "Keep the pitch low and gritty with a sharp aquatic rasp. Project high vocal energy with explosive consonantal punches on attack shouts. Maintain an aura of ruthless dominance without descending into incoherent shrieking."
  },
  {
    id: "flame_drake",
    nameZh: "烈焰龙蜥",
    nameEn: "Infernal Fire Drake",
    avatar: "🦎",
    categoryZh: "狂暴施法语音",
    categoryEn: "Frenzied Cast Lines",
    dialogueZh: "化为灰烬吧！",
    dialogueEn: "Turn to ashes!",
    directionEn: "Scorching, arrogant, and vicious. Use a smoky, menacing lizard-like hiss with fiery projection. Emphasize ashes with prolonged venomous intensity.",
    voiceDescriptionEn: "A volcanic draconian warlord possessing a rasping, scorched vocal timbre with deep chest resonance. His tone carries smoky gravel and reptilian sibilance, radiating ancient pride and devastating destructive force.",
    characterEn: "An ancient volcanic vanguard commander bound in obsidian plate. Arrogant, calculating, and pyromaniacal, he views mortal soldiers as fuel for his eternal flame.",
    sceneEn: "Unleashing a torrential breath of magma across the siege ramparts, watching enemy shields melt into liquid slag.",
    directionDetailedEn: "Gritty, medium-low raspy register with hot breath friction on consonants. Deliver words with cruel majesty and fiery confidence, emphasizing burning keywords."
  },
  {
    id: "titan_golem",
    nameZh: "机械魔像",
    nameEn: "Titan Siege Golem",
    avatar: "🤖",
    categoryZh: "重装机甲语音",
    categoryEn: "Heavy Armor Unit Lines",
    dialogueZh: "协议启动，全域肃清！",
    dialogueEn: "Protocols active. Total eradication!",
    directionEn: "Heavy, monotone, and inexorable. Use an echoing, synthetic resonant voice with seismic impact. Deliver with robotic precision, emphasizing eradication.",
    voiceDescriptionEn: "A massive ancient runic war machine speaking with a deep, metallic reverberation. Mechanical weight combined with low-frequency tectonic hum, devoid of organic hesitation, delivering catastrophic finality.",
    characterEn: "A centuries-old automated siege colossus awakened to defend the forgotten vault. Cold, unflinching, and programmed for unconditional perimeter purge.",
    sceneEn: "Stepping through crumbling marble arches, calibrating heavy kinetic beam cannons against invading mercenary squads.",
    directionDetailedEn: "Monotone and heavy with deep chest drone and crisp, robotic cadence. Ensure every syllable hits like an iron pillar with deliberate spacing."
  },
  {
    id: "shadow_stalker",
    nameZh: "暗影潜行者",
    nameEn: "Shadow Stalker",
    avatar: "🗡️",
    categoryZh: "潜伏暗杀语音",
    categoryEn: "Stealth Assassination Lines",
    dialogueZh: "你的影子……背叛了你！",
    dialogueEn: "Your shadow... has betrayed you!",
    directionEn: "Chilling, stealthy, and venomous. Use a hushed, raspy whisper that tightens into a sudden razor-sharp strike. Emphasize shadow and betrayed.",
    voiceDescriptionEn: "A nocturnal specter rogue with a cold, breathy, and razor-sharp voice. Slender mid-to-high register with raspy sinister overtones and shadowy whisper acoustics.",
    characterEn: "An elusive shadow operative who travels through candlelight flickers. Cold-blooded and sadistic, taking pleasure in sowing paranoia before delivering the lethal throat slash.",
    sceneEn: "Appearing behind a high-value sentry on the castle battlements, whispering doom into their ear just before the dagger strikes.",
    directionDetailedEn: "Breathy, low-volume intensity with venomous clarity. Modulate from eerie whispering into a sharp, decisive delivery, keeping vowels tight and sinister."
  },
  {
    id: "warbear_berserker",
    nameZh: "野性战熊",
    nameEn: "Ursine Berserker",
    avatar: "🐻",
    categoryZh: "近战狂战语音",
    categoryEn: "Melee Berserker Lines",
    dialogueZh: "撕碎他们的防线！",
    dialogueEn: "Rip through their ranks!",
    directionEn: "Massive, thundering, and primal. Use a deep chest roar vibrating with raw adrenaline. Deliver with bellowing battle power, emphasizing rip and ranks.",
    voiceDescriptionEn: "A colossal northern ursine warrior possessing a thunderous, cavernous baritone. Full of raw primal grit and earthy guttural power, roaring with the fury of a blizzard.",
    characterEn: "A revered tribal frontline chieftain clad in mammoth hide. Fearless, boisterous, and indomitable, smashing enemy shield walls with towering war-axes.",
    sceneEn: "Smashing through the front wooden palisade during a frozen blizzard siege, howling a ferocious rallying cry to the northern horde.",
    directionDetailedEn: "Deep, resonant diaphragmatic roar with thick vocal rasp. Maximum acoustic projection on battle verbs, exuding unyielding barbarian momentum."
  },
  {
    id: "clockwork_bombardier",
    nameZh: "发条掷弹兵",
    nameEn: "Clockwork Bombardier",
    avatar: "💣",
    categoryZh: "战术攻城语音",
    categoryEn: "Tactical Demolition Lines",
    dialogueZh: "点火！送他们上天！",
    dialogueEn: "Light the fuse! Blast them to bits!",
    directionEn: "Frantic, maniacal, and high-energy. Use a sharp, cackling goblin engineer voice with fast rapid delivery. Emphasize fuse and blast.",
    voiceDescriptionEn: "An eccentric, hyperactive demolition expert with a fast-paced, crackling, high-energy voice. Raspy, erratic, and punctuated by eccentric squeaks and maniacal cackles.",
    characterEn: "A chaotic goblin siege engineer obsessed with black powder and volatile clockwork explosives. Reckless, witty, and always one second away from self-detonation.",
    sceneEn: "Balancing atop a speeding gunpowder wagon, lighting three cluster grenades simultaneously while laughing hysterically at oncoming cavalry.",
    directionDetailedEn: "High tempo, dynamic pitch shifts, and erratic excitement. Infuse lines with manic energy and sharp explosive punctuation."
  },
  {
    id: "tempest_siren",
    nameZh: "风暴塞壬",
    nameEn: "Tempest Siren",
    avatar: "🌊",
    categoryZh: "战地颂歌语音",
    categoryEn: "Battle Chant Lines",
    dialogueZh: "聆听风暴的怒号吧！",
    dialogueEn: "Hear the fury of the storm!",
    directionEn: "Ethereal yet tempestuous. Use a soaring, melodious female voice that surges into an electrifying storm shriek. Emphasize fury and storm.",
    voiceDescriptionEn: "A tempest-weaving oceanic siren with a shimmering, hypnotic yet commanding vocal texture. Ranges from haunting, resonant melodiousness to ferocious squall-like intensity.",
    characterEn: "A high sea tempest sorceress commanding cyclone squalls. Regal, untamed, and wrathful against those who violate sacred reef waters.",
    sceneEn: "Hovering above whirlpool waves on wings of lightning, calling down hurricane thunder onto the opposing naval armada.",
    directionDetailedEn: "Smooth, resonant projection with luminous high harmonics that abruptly transitions into a commanding gale-force battle cry. Crystal clear diction with operatic power."
  },
  {
    id: "void_inquisitor",
    nameZh: "虚空审判官",
    nameEn: "Void Inquisitor",
    avatar: "👁️",
    categoryZh: "终极裁决语音",
    categoryEn: "Ultimate Judgment Lines",
    dialogueZh: "在虚空中彻底消亡！",
    dialogueEn: "Perish in the endless void!",
    directionEn: "Ominous, cold, and inescapable. Use a hollow, low-frequency voice with dread gravity. Speak with slow, deliberate doom, emphasizing perish and void.",
    voiceDescriptionEn: "A cosmic void herald speaking with an otherworldly, abyssal hollow resonance. Detached, chilling, and absolute, carrying the weight of decaying stars.",
    characterEn: "An astral inquisitor enforcing cosmic entropy. Unemotional, omnipotent in demeanor, treating planetary conquests as trivial corrections.",
    sceneEn: "Floating above a collapsing reality rift, pointing an ethereal scepter at the last resisting bastion of defenders.",
    directionDetailedEn: "Controlled, glacial pacing with a haunting chest-resonance drone. No frantic shouting—deliver absolute judgment with solemn, terrifying stillness."
  }
];

export function getFormattedNaturalControl(preset: GameCharacterPreset): string {
  return `Character: ${preset.characterEn}\nScene: ${preset.sceneEn}\nDirection: ${preset.directionDetailedEn}`;
}
