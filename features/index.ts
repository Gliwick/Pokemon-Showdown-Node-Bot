export interface Feature {
    id: string;
    desc?: string;
    init: () => void;
    destroy: () => void;
}

import { BattleManager } from './battle/index'
import { GroupChatsManager } from './groupchats/index'
import { ModerationManager } from './moderation/index'
import { TournamentsManager } from './tournaments/index'

const featureInitializers: { [key: string]: () => Feature } = {
    battle: () => new BattleManager(),
    groupchats: () => new GroupChatsManager(),
    moderation: () => new ModerationManager(),
    tournament: () => new TournamentsManager(),
}

export function initFeature(id: string): Feature | null {
    return featureInitializers[id]?.();
}

export function initFeatures(): { [key: string]: Feature } {
    return Object.entries(featureInitializers).reduce((acc: { [key: string]: Feature }, [id, initializer]) => {
        acc[id] = initializer(); return acc;
    }, {});
}

export const features: { [key: string]: Feature } = initFeatures();