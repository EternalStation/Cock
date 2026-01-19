import { Sword, Zap, Clock, Heart, Activity, Plus, Shield, Skull } from 'lucide-react';
// import { Upgrade } from '../logic/types';

export const getIcon = (iconId: string, color: string) => {
    const props = { size: 24, color };
    switch (iconId) {
        case 'dmg': return <Sword {...props} />;
        case 'zap': return <Zap {...props} />;
        case 'atk': return <Clock {...props} />;
        case 'hp': return <Heart {...props} />;
        case 'reg': return <Activity {...props} />;
        case 'xp': return <Plus {...props} />;
        case 'arm': return <Shield {...props} />;
        case 'special': return <Skull {...props} />;
        default: return <Zap {...props} />;
    }
};
