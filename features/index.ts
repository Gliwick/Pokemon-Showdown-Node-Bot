export interface Feature {
    readonly id: string;
    readonly desc?: string;
    init: () => void;
    getInitCmds?: () => string[] | undefined;
    destroy: () => void;
}

import { BattleManager } from './battle/index'
import { GroupChatsManager } from './groupchats/index'
import { ModerationManager } from './moderation/index'
import { TournamentsManager } from './tournaments/index'

const features: Record<string, new () => Feature> = {
    battle: BattleManager,
    groupchats: GroupChatsManager,
    moderation: ModerationManager,
    tournament: TournamentsManager,
}

export function initFeature(id: string): Feature | undefined {
    return features[id] && new features[id]();
}

export function initFeatures(): Record<string, Feature> {
    return Object.entries(features).reduce((acc: Record<string, Feature>, [id, constructor]) => {
        acc[id] = new constructor(); return acc;
    }, {});
}