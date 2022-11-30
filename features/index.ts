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

export function init(): { [key: string]: Feature } {
    return {
        battle: new BattleManager(),
        groupchats: new GroupChatsManager(),
        moderation: new ModerationManager(),
        tournament: new TournamentsManager(),
    }
}

export const features: { [key: string]: Feature } = init();