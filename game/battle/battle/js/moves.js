 /**
  * @type {Array<Move>}
  */
export const moves = [
    {
        "name": "Pound",
        "type": "Normal",
        "category": "Physical",
        "pp": 35,
        "power": 40,
        "accuracy": 1
    },
    {
        "name": "Karate Chop",
        "type": "Fight",
        "category": "Physical",
        "pp": 25,
        "power": 50,
        "accuracy": 1,
        "increasedCritical": true
    },
    {
        "name": "Double Slap",
        "type": "Normal",
        "category": "Physical",
        "pp": 10,
        "power": 15,
        "accuracy": 0.85,
        "repeats": [1, 1, 5/8, 3/5, 1/2]
    },
    {
        "name": "Comet Punch",
        "type": "Normal",
        "category": "Physical",
        "pp": 15,
        "power": 18,
        "accuracy": 0.85,
        "repeats": [1, 1, 5/8, 3/5, 1/2]
    },
    {
        "name": "Mega Punch",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 80,
        "accuracy": 0.85
    },
    {
        "name": "Pay Day", // TODO money
        "incomplete": true,
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 40,
        "accuracy": 1
    },
    {
        "name": "Fire Punch",
        "type": "Fire",
        "category": "Physical",
        "pp": 15,
        "power": 75,
        "accuracy": 1,
        "enemy": {
            "burn": 0.1
        }
    },
    {
        "name": "Ice Punch",
        "type": "Ice",
        "category": "Physical",
        "pp": 15,
        "power": 75,
        "accuracy": 1,
        "enemy": {
            "freeze": 0.1
        }
    },
    {
        "name": "Thunder Punch",
        "type": "Electr",
        "category": "Physical",
        "pp": 15,
        "power": 75,
        "accuracy": 1,
        "enemy": {
            "paralyze": 0.1
        }
    },
    {
        "name": "Scratch",
        "type": "Normal",
        "category": "Physical",
        "pp": 35,
        "power": 40,
        "accuracy": 1
    },
    {
        "name": "Vice Grip",
        "type": "Normal",
        "category": "Physical",
        "pp": 30,
        "power": 55,
        "accuracy": 1
    },
    {
        "name": "Guillotine",
        "type": "Normal",
        "category": "Physical",
        "pp": 5,
        "power": null,
        "accuracy": 0.3, // todo OHKO
        "incomplete": true,
        "enemy": {
            "heal": -Infinity,
        }
    },
    {
        "name": "Razor Wind",
        "type": "Normal",
        "category": "Special",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "line": "\nmade a whirlwind!",
        "next": {
            "name": "Razor Wind",
            "type": "Normal",
            "category": "Special",
            "pp": 10,
            "power": 80,
            "accuracy": 1,
        }
    },
    {
        "name": "Swords Dance",
        "type": "Normal",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null,
        "self": {
            "attack": 2
        }
    },
    {
        "name": "Cut",
        "type": "Normal",
        "category": "Physical",
        "pp": 30,
        "power": 50,
        "accuracy": 0.95
    },
    {
        "name": "Gust",
        "type": "Flying",
        "category": "Special",
        "pp": 35,
        "power": 40,
        "accuracy": 1,
        "hitsUpHigh": true
    },
    {
        "name": "Wing Attack",
        "type": "Flying",
        "category": "Physical",
        "pp": 35,
        "power": 60,
        "accuracy": 1
    },
    {
        "name": "Whirlwind",
        "type": "Normal",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null, // todo escape from wild battle
        "incomplete": true,
        "hitsUpHigh": true
    },
    {
        "name": "Fly",
        "type": "Flying",
        "category": "Physical",
        "pp": 15,
        "power": null,
        "accuracy": null,
        "line": " flew\nup high.",
        "next": {
            "name": "Fly",
            "type": "Flying",
            "category": "Physical",
            "pp": 15,
            "power": 90,
            "accuracy": 0.95,
        },
        "self": {
            "upHigh": true
        }
    },
    {
        "name": "Bind",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 15,
        "accuracy": 0.85
    },
    {
        "name": "Slam",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 80,
        "accuracy": 0.75
    },
    {
        "name": "Vine Whip",
        "type": "Grass",
        "category": "Physical",
        "pp": 25,
        "power": 45,
        "accuracy": 1
    },
    {
        "name": "Stomp",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 65,
        "accuracy": 1,
        "flinch": 0.3
    },
    {
        "name": "Double Kick",
        "type": "Fight",
        "category": "Physical",
        "pp": 30,
        "power": 30,
        "accuracy": 1,
        "repeats": [1, 1]
    },
    {
        "name": "Mega Kick",
        "type": "Normal",
        "category": "Physical",
        "pp": 5,
        "power": 120,
        "accuracy": 0.75
    },
    {
        "name": "Jump Kick",
        "type": "Fight",
        "category": "Physical",
        "pp": 10,
        "power": 100,
        "accuracy": 0.95,
        "crashes": true
    },
    {
        "name": "Rolling Kick",
        "type": "Fight",
        "category": "Physical",
        "pp": 15,
        "power": 60,
        "accuracy": 0.85,
        "flinch": 0.3
    },
    {
        "name": "Sand Attack",
        "type": "Ground",
        "category": "Status",
        "pp": 15,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "accuracy": -1
        }
    },
    {
        "name": "Headbutt",
        "type": "Normal",
        "category": "Physical",
        "pp": 15,
        "power": 70,
        "accuracy": 1,
        "flinch": 0.3
    },
    {
        "name": "Horn Attack",
        "type": "Normal",
        "category": "Physical",
        "pp": 25,
        "power": 65,
        "accuracy": 1
    },
    {
        "name": "Fury Attack",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 15,
        "accuracy": 0.85,
        "repeats": [1, 1, 5/8, 3/5, 1/2]
    },
    {
        "name": "Horn Drill",
        "type": "Normal",
        "category": "Physical",
        "pp": 5,
        "power": null,
        "accuracy": 0.3, // todo OHKO
        "incomplete": true,
        "enemy": {
            "heal": -Infinity,
        }
    },
    {
        "name": "Tackle",
        "type": "Normal",
        "category": "Physical",
        "pp": 35,
        "power": 50,
        "accuracy": 1
    },
    {
        "name": "Body Slam",
        "type": "Normal",
        "category": "Physical",
        "pp": 15,
        "power": 85,
        "accuracy": 1,
        "enemy": {
            "paralyze": 0.3
        }
    },
    {
        "name": "Wrap",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 15,
        "accuracy": 0.9
    },
    {
        "name": "Take Down",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 90,
        "accuracy": 0.85,
        "self": {
            "leech": -.25
        }
    },
    {
        "name": "Thrash",
        "type": "Normal",
        "category": "Physical",
        "pp": 10,
        "power": 120,
        "accuracy": 1
    },
    {
        "name": "Double-Edge",
        "type": "Normal",
        "category": "Physical",
        "pp": 15,
        "power": 120,
        "accuracy": 1,
        "self": {
            "leech": - 1 /3
        }
    },
    {
        "name": "Tail Whip",
        "type": "Normal",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "defense": -1
        }
    },
    {
        "name": "Poison Sting",
        "type": "Poison",
        "category": "Physical",
        "pp": 35,
        "power": 15,
        "accuracy": 1,
        "enemy": {
            "poison": 0.3
        }
    },
    {
        "name": "Twineedle",
        "type": "Bug",
        "category": "Physical",
        "pp": 20,
        "power": 25,
        "accuracy": 1,
        "repeats": [1, 1],
        "enemy": {
            "poison": 0.2
        }
    },
    {
        "name": "Pin Missile",
        "type": "Bug",
        "category": "Physical",
        "pp": 20,
        "power": 25,
        "accuracy": 0.95,
        "repeats": [1, 1, 5/8, 3/5, 1/2]
    },
    {
        "name": "Leer",
        "type": "Normal",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "defense": -1
        }
    },
    {
        "name": "Bite",
        "type": "Dark",
        "category": "Physical",
        "pp": 25,
        "power": 60,
        "accuracy": 1,
        "flinch": 0.3
    },
    {
        "name": "Growl",
        "type": "Normal",
        "category": "Status",
        "pp": 40,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "attack": -1
        }
    },
    {
        "name": "Roar",
        "type": "Normal",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null, // todo escape from wild battle
        "incomplete": true,
    },
    {
        "name": "Sing",
        "type": "Normal",
        "category": "Status",
        "pp": 15,
        "power": null,
        "accuracy": 0.55,
        "enemy": {
            "sleep": 1
        }
    },
    {
        "name": "Supersonic",
        "type": "Normal",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": 0.55,
        "enemy": {
            "confuse": 1
        }
    },
    {
        "name": "Sonic Boom",
        "type": "Normal",
        "category": "Special",
        "pp": 20,
        "power": null,
        "accuracy": 0.9,
        "enemy": {
            "heal": -20
        }
    },
    {
        "name": "Disable", // todo this is op
        "incomplete": true,
        "type": "Normal",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "disableLastMove": true
        }
    },
    {
        "name": "Acid",
        "type": "Poison",
        "category": "Special",
        "pp": 30,
        "power": 40,
        "accuracy": 1
    },
    {
        "name": "Ember",
        "type": "Fire",
        "category": "Special",
        "pp": 25,
        "power": 40,
        "accuracy": 1,
        "enemy": {
            "burn": 0.1
        }
    },
    {
        "name": "Flamethrower",
        "type": "Fire",
        "category": "Special",
        "pp": 15,
        "power": 90,
        "accuracy": 1,
        "enemy": {
            "burn": 0.1
        }
    },
    {
        "name": "Mist",
        "type": "Ice",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": null, // todo, stops stat changes
        "incomplete": true,
    },
    {
        "name": "Water Gun",
        "type": "Water",
        "category": "Special",
        "pp": 25,
        "power": 40,
        "accuracy": 1
    },
    {
        "name": "Hydro Pump",
        "type": "Water",
        "category": "Special",
        "pp": 5,
        "power": 110,
        "accuracy": 0.8
    },
    {
        "name": "Surf",
        "type": "Water",
        "category": "Special",
        "pp": 15,
        "power": 90,
        "accuracy": 1
    },
    {
        "name": "Ice Beam",
        "type": "Ice",
        "category": "Special",
        "pp": 10,
        "power": 90,
        "accuracy": 1,
        "enemy": {
            "freeze": 0.1
        }
    },
    {
        "name": "Blizzard",
        "type": "Ice",
        "category": "Special",
        "pp": 5,
        "power": 110,
        "accuracy": 0.7,
        "enemy": {
            "freeze": 0.1
        }
    },
    {
        "name": "Psybeam",
        "type": "Psychic",
        "category": "Special",
        "pp": 20,
        "power": 65,
        "accuracy": 1,
        "enemy": {
            "confuse": 0.1
        }
    },
    {
        "name": "Bubble Beam",
        "type": "Water",
        "category": "Special",
        "pp": 20,
        "power": 65,
        "accuracy": 1
    },
    {
        "name": "Aurora Beam",
        "type": "Ice",
        "category": "Special",
        "pp": 20,
        "power": 65,
        "accuracy": 1
    },
    {
        "name": "Hyper Beam",
        "type": "Normal",
        "category": "Special",
        "pp": 5,
        "power": 150,
        "accuracy": 0.9,
        "next": {
            "name": "Recharge Hyper Beam",
            "type": "Normal",
            "category": "Special",
            "pp": 5,
            "power": null,
            "accuracy": null,
            "line": "\nmust recharge!"
        }
    },
    {
        "name": "Peck",
        "type": "Flying",
        "category": "Physical",
        "pp": 35,
        "power": 35,
        "accuracy": 1
    },
    {
        "name": "Drill Peck",
        "type": "Flying",
        "category": "Physical",
        "pp": 20,
        "power": 80,
        "accuracy": 1
    },
    {
        "name": "Submission",
        "type": "Fight",
        "category": "Physical",
        "pp": 25,
        "power": 80,
        "accuracy": 0.8,
        "self": {
            "leech": -.25
        }
    },
    {
        "name": "Low Kick",
        "type": "Fight",
        "category": "Physical",
        "pp": 20,
        "power": 50,
        "accuracy": 0.9,
        "flinch": 0.3
    },
    {
        "name": "Counter",
        "type": "Fight",
        "category": "Physical",
        "pp": 20,
        "power": null,
        "accuracy": 1, // todo deals 2x last physical move used. Otherwise misses
        "incomplete": true,
        "priority": -1
    },
    {
        "name": "Seismic Toss",
        "type": "Fight",
        "category": "Physical",
        "pp": 20,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "levelDamage": 1
        }
    },
    {
        "name": "Strength",
        "type": "Normal",
        "category": "Physical",
        "pp": 15,
        "power": 80,
        "accuracy": 1
    },
    {
        "name": "Absorb",
        "type": "Grass",
        "category": "Special",
        "pp": 25,
        "power": 20,
        "accuracy": 1,
        "self": {
            "leech": .5
        }
    },
    {
        "name": "Mega Drain",
        "type": "Grass",
        "category": "Special",
        "pp": 15,
        "power": 40,
        "accuracy": 1,
        "self": {
            "leech": .5
        }
    },
    {
        "name": "Leech Seed",
        "type": "Grass",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": 0.9,
        "enemy": {
            "seed": 1
        }
    },
    {
        "name": "Growth",
        "type": "Normal",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null,
        "self": {
            "spAttack": 1
        }
    },
    {
        "name": "Razor Leaf",
        "type": "Grass",
        "category": "Physical",
        "pp": 25,
        "power": 55,
        "accuracy": 0.95,
        "increasedCritical": true
    },
    {
        "name": "Solar Beam",
        "type": "Grass",
        "category": "Special",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "line": " took\nin sunlight.",
        "next": {
            "name": "Solar Beam",
            "type": "Grass",
            "category": "Special",
            "pp": 10,
            "power": 120,
            "accuracy": 1
        }
    },
    {
        "name": "Poison Powder",
        "type": "Poison",
        "category": "Status",
        "pp": 35,
        "power": null,
        "accuracy": 0.75,
        "enemy": {
            "poison": 1
        }
    },
    {
        "name": "Stun Spore",
        "type": "Grass",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": 0.75,
        "enemy": {
            "paralyze": 0.3
        }
    },
    {
        "name": "Sleep Powder",
        "type": "Grass",
        "category": "Status",
        "pp": 15,
        "power": null,
        "accuracy": 0.75,
        "enemy": {
            "sleep": 1
        }
    },
    {
        "name": "Petal Dance",
        "type": "Grass",
        "category": "Special",
        "pp": 10,
        "power": 120,
        "accuracy": 1
    },
    {
        "name": "String Shot",
        "type": "Bug",
        "category": "Status",
        "pp": 40,
        "power": null,
        "accuracy": 0.95,
        "enemy": {
            "speed": -1
        }
    },
    {
        "name": "Dragon Rage",
        "type": "Dragon",
        "category": "Special",
        "pp": 10,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "heal": -40
        }
    },
    {
        "name": "Fire Spin",
        "type": "Fire",
        "category": "Special",
        "pp": 15,
        "power": 35,
        "accuracy": 0.85
    },
    {
        "name": "Thunder Shock",
        "type": "Electr",
        "category": "Special",
        "pp": 30,
        "power": 40,
        "accuracy": 1,
        "enemy": {
            "paralyze": 0.1
        }
    },
    {
        "name": "Thunderbolt",
        "type": "Electr",
        "category": "Special",
        "pp": 15,
        "power": 90,
        "accuracy": 1,
        "enemy": {
            "paralyze": 0.1
        }
    },
    {
        "name": "Thunder Wave",
        "type": "Electr",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "paralyze": 1
        }
    },
    {
        "name": "Thunder",
        "type": "Electr",
        "category": "Special",
        "pp": 10,
        "power": 110,
        "accuracy": 0.7,
        "hitsUpHigh": true,
        "enemy": {
            "paralyze": 0.3
        }
    },
    {
        "name": "Rock Throw",
        "type": "Rock",
        "category": "Physical",
        "pp": 15,
        "power": 50,
        "accuracy": 0.9
    },
    {
        "name": "Earthquake",
        "type": "Ground",
        "category": "Physical",
        "pp": 10,
        "power": 100,
        "accuracy": 1,
        "hitsUnderground": true
    },
    {
        "name": "Fissure",
        "type": "Ground",
        "category": "Physical",
        "pp": 5,
        "power": null,
        "accuracy": 0.3, // todo OHKO
        "incomplete": true,
        "hitsUnderground": true,
        "enemy": {
            "heal": -Infinity,
        }
    },
    {
        "name": "Dig",
        "type": "Ground",
        "category": "Physical",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "line": " went\nunderground!",
        "next": {
            "name": "Dig",
            "type": "Ground",
            "category": "Physical",
            "pp": 10,
            "power": 80,
            "accuracy": 1,
        },
        "self": {
            "underground": true
        }
    },
    {
        "name": "Toxic", // TODO bad poison
        "incomplete": true,
        "type": "Poison",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": 0.9,
        "enemy": {
            "poison": 1
        }
    },
    {
        "name": "Confusion",
        "type": "Psychic",
        "category": "Special",
        "pp": 25,
        "power": 50,
        "accuracy": 1,
        "enemy": {
            "confuse": 0.1
        }
    },
    {
        "name": "Psychic",
        "type": "Psychic",
        "category": "Special",
        "pp": 10,
        "power": 90,
        "accuracy": 1
    },
    {
        "name": "Hypnosis",
        "type": "Psychic",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": 0.6,
        "enemy": {
            "sleep": 1
        }
    },
    {
        "name": "Meditate",
        "type": "Psychic",
        "category": "Status",
        "pp": 40,
        "power": null,
        "accuracy": null,
        "self": {
            "attack": 1
        }
    },
    {
        "name": "Agility",
        "type": "Psychic",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": null,
        "self": {
            "speed": 2
        }
    },
    {
        "name": "Quick Attack",
        "type": "Normal",
        "category": "Physical",
        "pp": 30,
        "power": 40,
        "accuracy": 1,
        "priority": 1
    },
    {
        "name": "Rage",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 20,
        "accuracy": 1
    },
    {
        "name": "Teleport",
        "type": "Psychic",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null, // todo leave battle
        "incomplete": true,
    },
    {
        "name": "Night Shade",
        "type": "Ghost",
        "category": "Special",
        "pp": 15,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "levelDamage": 1
        }
    },
    {
        "name": "Mimic",
        "type": "Normal",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": 1, // todo move replacement
        "incomplete": true,
    },
    {
        "name": "Screech",
        "type": "Normal",
        "category": "Status",
        "pp": 40,
        "power": null,
        "accuracy": 0.85,
        "enemy": {
            "defense": -2
        }
    },
    {
        "name": "Double Team",
        "type": "Normal",
        "category": "Status",
        "pp": 15,
        "power": null,
        "accuracy": null,
        "self": {
            "evasion": 1
        }
    },
    {
        "name": "Recover",
        "type": "Normal",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "self": {
            "heal": 0.5
        }
    },
    {
        "name": "Harden",
        "type": "Normal",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": null,
        "self": {
            "defense": 1
        }
    },
    {
        "name": "Minimize",
        "type": "Normal",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "self": {
            "evasion": 1
        }
    },
    {
        "name": "Smokescreen",
        "type": "Normal",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "accuracy": -1
        }
    },
    {
        "name": "Confuse Ray",
        "type": "Ghost",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "confuse": 1
        }
    },
    {
        "name": "Withdraw",
        "type": "Water",
        "category": "Status",
        "pp": 40,
        "power": null,
        "accuracy": null,
        "self": {
            "defense": 1
        }
    },
    {
        "name": "Defense Curl",
        "type": "Normal",
        "category": "Status",
        "pp": 40,
        "power": null,
        "accuracy": null,
        "self": {
            "defense": 1
        }
    },
    {
        "name": "Barrier",
        "type": "Psychic",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null,
        "self": {
            "defense": 2
        }
    },
    {
        "name": "Light Screen",
        "type": "Psychic",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": null, // todo halve damage by special attacks
        "incomplete": true,
    },
    {
        "name": "Haze",
        "type": "Ice",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": null,
        "self": {
            "resetStats": true
        },
        "enemy": {
            "resetStats": true
        }
    },
    {
        "name": "Reflect",
        "type": "Psychic",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null, //todo halve damage by physical attacks
        "incomplete": true,
    },
    {
        "name": "Focus Energy",
        "type": "Normal",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": null,
        "self": {
            "critical": 1
        }
    },
    {
        "name": "Bide",
        "type": "Normal",
        "category": "Physical",
        "pp": 10,
        "power": null,
        "accuracy": 1, // todo bide
        "incomplete": true,
    },
    {
        "name": "Metronome",
        "type": "Normal",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "randomMove": true
    },
    {
        "name": "Mirror Move",
        "type": "Flying",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null, // todo use last move by opponent
        "incomplete": true,
    },
    {
        "name": "Self-Destruct",
        "type": "Normal",
        "category": "Physical",
        "pp": 5,
        "power": 400,
        "accuracy": 1,
        "self": {
            "heal": -1
        }
    },
    {
        "name": "Egg Bomb",
        "type": "Normal",
        "category": "Physical",
        "pp": 10,
        "power": 100,
        "accuracy": 0.75
    },
    {
        "name": "Lick",
        "type": "Ghost",
        "category": "Physical",
        "pp": 30,
        "power": 30,
        "accuracy": 1,
        "enemy": {
            "paralyze": 0.3
        }
    },
    {
        "name": "Smog",
        "type": "Poison",
        "category": "Special",
        "pp": 20,
        "power": 30,
        "accuracy": 0.7,
        "enemy": {
            "poison": 0.4
        }
    },
    {
        "name": "Sludge",
        "type": "Poison",
        "category": "Special",
        "pp": 20,
        "power": 65,
        "accuracy": 1,
        "enemy": {
            "poison": 0.3
        }
    },
    {
        "name": "Bone Club",
        "type": "Ground",
        "category": "Physical",
        "pp": 20,
        "power": 65,
        "accuracy": 0.85,
        "flinch": 0.1
    },
    {
        "name": "Fire Blast",
        "type": "Fire",
        "category": "Special",
        "pp": 5,
        "power": 110,
        "accuracy": 0.85,
        "enemy": {
            "burn": 0.1
        }
    },
    {
        "name": "Waterfall",
        "type": "Water",
        "category": "Physical",
        "pp": 15,
        "power": 80,
        "accuracy": 1,
        "flinch": 0.2
    },
    {
        "name": "Clamp",
        "type": "Water",
        "category": "Physical",
        "pp": 15,
        "power": 35,
        "accuracy": 0.85
    },
    {
        "name": "Swift",
        "type": "Normal",
        "category": "Special",
        "pp": 20,
        "power": 60,
        "accuracy": null
    },
    {
        "name": "Skull Bash",
        "type": "Normal",
        "category": "Physical",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "line": "\nlowered its head.",
        "next": {
            "name": "Skull Bash",
            "type": "Normal",
            "category": "Physical",
            "pp": 10,
            "power": 130,
            "accuracy": 1,
        }
    },
    {
        "name": "Spike Cannon",
        "type": "Normal",
        "category": "Physical",
        "pp": 15,
        "power": 20,
        "accuracy": 1,
        "repeats": [1, 1, 5/8, 3/5, 1/2]
    },
    {
        "name": "Constrict",
        "type": "Normal",
        "category": "Physical",
        "pp": 35,
        "power": 10,
        "accuracy": 1
    },
    {
        "name": "Amnesia",
        "type": "Psychic",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null,
        "self": {
            "spDefense": 2
        }
    },
    {
        "name": "Kinesis",
        "type": "Psychic",
        "category": "Status",
        "pp": 15,
        "power": null,
        "accuracy": 0.8,
        "enemy": {
            "accuracy": -1
        }
    },
    {
        "name": "Soft-Boiled",
        "type": "Normal",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "self": {
            "heal": 0.5
        }
    },
    {
        "name": "High Jump Kick",
        "type": "Fight",
        "category": "Physical",
        "pp": 10,
        "power": 130,
        "accuracy": 0.9,
        "crashes": true
    },
    {
        "name": "Glare",
        "type": "Normal",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": 0.75,
        "enemy": {
            "paralyze": 1
        }
    },
    {
        "name": "Dream Eater",
        "type": "Psychic",
        "category": "Special",
        "pp": 15,
        "power": 100,
        "accuracy": 1,
        "enemyStatus": "sleep",
        "self": {
            "leech": 0.5
        }
    },
    {
        "name": "Poison Gas",
        "type": "Poison",
        "category": "Status",
        "pp": 40,
        "power": null,
        "accuracy": 0.9,
        "enemy": {
            "poison": 1
        }
    },
    {
        "name": "Barrage",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 15,
        "accuracy": 0.85,
        "repeats": [1, 1, 5/8, 3/5, 1/2]
    },
    {
        "name": "Leech Life",
        "type": "Bug",
        "category": "Physical",
        "pp": 15,
        "power": 20,
        "accuracy": 1
    },
    {
        "name": "Lovely Kiss",
        "type": "Normal",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": 0.75,
        "enemy": {
            "sleep": 1
        }
    },
    {
        "name": "Sky Attack",
        "type": "Flying",
        "category": "Physical",
        "pp": 5,
        "power": null,
        "accuracy": null,
        "line": "\nis glowing!",
        "next": {
            "name": "Sky Attack",
            "type": "Flying",
            "category": "Physical",
            "pp": 5,
            "power": 140,
            "accuracy": 0.9,
            "flinch": 0.3,
        }
    },
    {
        "name": "Transform",
        "type": "Normal",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": null, // todo transform
        "incomplete": true,
    },
    {
        "name": "Bubble",
        "type": "Water",
        "category": "Special",
        "pp": 30,
        "power": 40,
        "accuracy": 1
    },
    {
        "name": "Dizzy Punch",
        "type": "Normal",
        "category": "Physical",
        "pp": 10,
        "power": 70,
        "accuracy": 1,
        "enemy": {
            "confuse": 0.2
        }
    },
    {
        "name": "Spore",
        "type": "Grass",
        "category": "Status",
        "pp": 15,
        "power": null,
        "accuracy": 1,
        "enemy": {
            "sleep": 1
        }
    },
    {
        "name": "Flash",
        "type": "Normal",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": 0.7,
        "enemy": {
            "accuracy": -1
        }
    },
    {
        "name": "Psywave",
        "type": "Psychic",
        "category": "Special",
        "pp": 15,
        "power": null,
        "accuracy": .8,
        "randomDamage": true
    },
    {
        "name": "Splash",
        "type": "Normal",
        "category": "Status",
        "pp": 40,
        "power": null,
        "accuracy": null
    },
    {
        "name": "Acid Armor",
        "type": "Poison",
        "category": "Status",
        "pp": 20,
        "power": null,
        "accuracy": null,
        "self": {
            "defense": 2
        }
    },
    {
        "name": "Crabhammer",
        "type": "Water",
        "category": "Physical",
        "pp": 10,
        "power": 100,
        "accuracy": 0.9,
        "increasedCritical": true
    },
    {
        "name": "Explosion",
        "type": "Normal",
        "category": "Physical",
        "pp": 5,
        "power": 500,
        "accuracy": 1,
        "self": {
            "heal": -1
        }
    },
    {
        "name": "Fury Swipes",
        "type": "Normal",
        "category": "Physical",
        "pp": 15,
        "power": 18,
        "accuracy": 0.8,
        "repeats": [1, 1, 5/8, 3/5, 1/2]
    },
    {
        "name": "Bonemerang",
        "type": "Ground",
        "category": "Physical",
        "pp": 10,
        "power": 50,
        "accuracy": 0.9,
        "repeats": [1, 1]
    },
    {
        "name": "Rest",
        "type": "Psychic",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": null,
        "self": {
            "clearStatus": true,
            "sleep": 1,
            "heal": 1
        }
    },
    {
        "name": "Rock Slide",
        "type": "Rock",
        "category": "Physical",
        "pp": 10,
        "power": 75,
        "accuracy": 0.9,
        "flinch": 0.3
    },
    {
        "name": "Hyper Fang",
        "type": "Normal",
        "category": "Physical",
        "pp": 15,
        "power": 80,
        "accuracy": 0.9,
        "flinch": 0.1
    },
    {
        "name": "Sharpen",
        "type": "Normal",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": null,
        "self": {
            "attack": 1
        }
    },
    {
        "name": "Conversion",
        "type": "Normal",
        "category": "Status",
        "pp": 30,
        "power": null,
        "accuracy": null, // todo change type to target type
        "incomplete": true,
    },
    {
        "name": "Tri Attack",
        "type": "Normal",
        "category": "Special",
        "pp": 10,
        "power": 80,
        "accuracy": 1,
        "enemy": {
            "burn": 2/30,
            "freeze": 2/30,
            "paralyze": 2/30
        }
    },
    {
        "name": "Super Fang",
        "type": "Normal",
        "category": "Physical",
        "pp": 10,
        "power": null,
        "accuracy": 0.9, // todo damage = 50% of current target HP. Round up
        "incomplete": true,
    },
    {
        "name": "Slash",
        "type": "Normal",
        "category": "Physical",
        "pp": 20,
        "power": 70,
        "accuracy": 1,
        "increasedCritical": true
    },
    {
        "name": "Substitute",
        "type": "Normal",
        "category": "Status",
        "pp": 10,
        "power": null,
        "accuracy": null, // todo substitute
        "incomplete": true,
    },
    {
        "name": "Struggle",
        "type": "StruggleType",
        "category": "Physical",
        "pp": 1,
        "power": 50,
        "accuracy": 1,
        "self": {
            "leech": -0.25
        }
    }
];
