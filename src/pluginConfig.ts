import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-mff',
    version: '0.0.1',
    icon: '⚔',
    title: 'MFF tools',
    description: 'Show upper winds, temperature and humidity at a given position',
    author: 'Wetterheidi',
    repository: 'https://github.com/wetterheidi/windy-plugin-mff.git',
    desktopUI: 'rhpane',
    mobileUI: 'fullscreen',
    routerPath: '/mff-tools',
    desktopWidth: 500,
    listenToSingleclick: true,
    addToContextmenu: false,
    private: true
};

export default config;
