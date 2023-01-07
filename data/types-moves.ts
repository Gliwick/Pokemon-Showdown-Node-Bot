import { Ability } from './types-abilities';
import { ConditionData } from './types-conditions';
import { EffectData, SparseBoostsTable, StatIDExceptHP } from './types-dex';

type MoveTarget =
	| 'adjacentAlly'
	| 'adjacentAllyOrSelf'
	| 'adjacentFoe'
	| 'all'
	| 'allAdjacent'
	| 'allAdjacentFoes'
	| 'allies'
	| 'allySide'
	| 'allyTeam'
	| 'any'
	| 'foeSide'
	| 'normal'
	| 'randomNormal'
	| 'scripted'
	| 'self';

/** Possible move flags. */
interface MoveFlags {
	bypasssub?: 1; // Ignores a target's substitute.
	bite?: 1; // Power is multiplied by 1.5 when used by a Pokemon with the Ability Strong Jaw.
	bullet?: 1; // Has no effect on Pokemon with the Ability Bulletproof.
	charge?: 1; // The user is unable to make a move between turns.
	contact?: 1; // Makes contact.
	dance?: 1; // When used by a Pokemon, other Pokemon with the Ability Dancer can attempt to execute the same move.
	defrost?: 1; // Thaws the user if executed successfully while the user is frozen.
	distance?: 1; // Can target a Pokemon positioned anywhere in a Triple Battle.
	gravity?: 1; // Prevented from being executed or selected during Gravity's effect.
	heal?: 1; // Prevented from being executed or selected during Heal Block's effect.
	mirror?: 1; // Can be copied by Mirror Move.
	allyanim?: 1; // The move has an animation when used on an ally.
	nonsky?: 1; // Prevented from being executed or selected in a Sky Battle.
	powder?: 1; // Has no effect on Pokemon which are Grass-type, have the Ability Overcoat, or hold Safety Goggles.
	protect?: 1; // Blocked by Detect, Protect, Spiky Shield, and if not a Status move, King's Shield.
	pulse?: 1; // Power is multiplied by 1.5 when used by a Pokemon with the Ability Mega Launcher.
	punch?: 1; // Power is multiplied by 1.2 when used by a Pokemon with the Ability Iron Fist.
	recharge?: 1; // If this move is successful, the user must recharge on the following turn and cannot make a move.
	reflectable?: 1; // Bounced back to the original user by Magic Coat or the Ability Magic Bounce.
	slicing?: 1; // Power is multiplied by 1.5 when used by a Pokemon with the Ability Sharpness.
	snatch?: 1; // Can be stolen from the original user and instead used by another Pokemon using Snatch.
	sound?: 1; // Has no effect on Pokemon with the Ability Soundproof.
	wind?: 1; // Activates the Wind Power and Wind Rider Abilities.
}

interface HitEffect {
	// set pokemon conditions
	boosts?: SparseBoostsTable | null;
	status?: string;
	volatileStatus?: string;

	// set side/slot conditions
	sideCondition?: string;
	slotCondition?: string;

	// set field conditions
	pseudoWeather?: string;
	terrain?: string;
	weather?: string;
}

interface SecondaryEffect extends HitEffect {
	chance?: number;
	/** Used to flag a secondary effect as added by Poison Touch */
	ability?: Ability;
	/**
	 * Applies to Sparkling Aria's secondary effect: Affected by
	 * Sheer Force but not Shield Dust.
	 */
	dustproof?: boolean;
	/**
	 * Gen 2 specific mechanics: Bypasses Substitute only on Twineedle,
	 * and allows it to flinch sleeping/frozen targets
	 */
	kingsrock?: boolean;
	self?: HitEffect;
}

export interface MoveData extends EffectData, HitEffect {
	name: string;
	/** move index number, used for Metronome rolls */
	num?: number;
	condition?: ConditionData;
	basePower: number;
	accuracy: true | number;
	pp: number;
	category: 'Physical' | 'Special' | 'Status';
	type: string;
	priority: number;
	target: MoveTarget;
	flags: MoveFlags;
	/** Hidden Power */
	realMove?: string;

	damage?: number | 'level' | false | null;
	contestType?: string;
	noPPBoosts?: boolean;

	// Z-move data
	// -----------
	/**
	 * ID of the Z-Crystal that calls the move.
	 * `true` for Z-Powered status moves like Z-Encore.
	 */
	isZ?: boolean | string;
	zMove?: {
		basePower?: number;
		effect?: string;
		boost?: SparseBoostsTable;
	};

	// Max move data
	// -------------
	/**
	 * `true` for Max moves like Max Airstream. If its a G-Max moves, this is
	 * the species ID of the Gigantamax Pokemon that can use this G-Max move.
	 */
	isMax?: boolean | string;
	maxMove?: {
		basePower: number;
	};

	// Hit effects
	// -----------
	ohko?: boolean | string;
	thawsTarget?: boolean;
	heal?: number[] | null;
	forceSwitch?: boolean;
	selfSwitch?: 'copyvolatile' | 'shedtail' | boolean;
	selfBoost?: { boosts?: SparseBoostsTable };
	selfdestruct?: 'always' | 'ifHit' | boolean;
	breaksProtect?: boolean;
	/**
	 * Note that this is only "true" recoil. Other self-damage, like Struggle,
	 * crash (High Jump Kick), Mind Blown, Life Orb, and even Substitute and
	 * Healing Wish, are sometimes called "recoil" by the community, but don't
	 * count as "real" recoil.
	 */
	recoil?: [number, number];
	drain?: [number, number];
	mindBlownRecoil?: boolean;
	stealsBoosts?: boolean;
	struggleRecoil?: boolean;
	secondary?: SecondaryEffect | null;
	secondaries?: SecondaryEffect[] | null;
	self?: SecondaryEffect | null;
	hasSheerForce?: boolean;

	// Hit effect modifiers
	// --------------------
	alwaysHit?: boolean; // currently unused
	baseMoveType?: string;
	basePowerModifier?: number;
	critModifier?: number;
	critRatio?: number;
	/**
	 * Pokemon for the attack stat. Ability and Item damage modifiers still come from the real attacker.
	 */
	overrideOffensivePokemon?: 'target' | 'source';
	/**
	 * Physical moves use attack stat modifiers, special moves use special attack stat modifiers.
	 */
	overrideOffensiveStat?: StatIDExceptHP;
	/**
	 * Pokemon for the defense stat. Ability and Item damage modifiers still come from the real defender.
	 */
	overrideDefensivePokemon?: 'target' | 'source';
	/**
	 * uses modifiers that match the new stat
	 */
	overrideDefensiveStat?: StatIDExceptHP;
	forceSTAB?: boolean;
	ignoreAbility?: boolean;
	ignoreAccuracy?: boolean;
	ignoreDefensive?: boolean;
	ignoreEvasion?: boolean;
	ignoreImmunity?: boolean | { [k: string]: boolean };
	ignoreNegativeOffensive?: boolean;
	ignoreOffensive?: boolean;
	ignorePositiveDefensive?: boolean;
	ignorePositiveEvasion?: boolean;
	multiaccuracy?: boolean;
	multihit?: number | number[];
	multihitType?: string;
	noDamageVariance?: boolean;
	nonGhostTarget?: string;
	pressureTarget?: string;
	spreadModifier?: number;
	sleepUsable?: boolean;
	/**
	 * Will change target if current target is unavailable. (Dragon Darts)
	 */
	smartTarget?: boolean;
	/**
	 * Tracks the original target through Ally Switch and other switch-out-and-back-in
	 * situations, rather than just targeting a slot. (Stalwart, Snipe Shot)
	 */
	tracksTarget?: boolean;
	willCrit?: boolean;

	// Mechanics flags
	// ---------------
	hasCrashDamage?: boolean;
	isConfusionSelfHit?: boolean;
	isFutureMove?: boolean;
	noMetronome?: string[];
	noSketch?: boolean;
	stallingMove?: boolean;
	baseMove?: string;
}
