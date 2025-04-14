// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry} from 'mattermost-webapp/plugins/registry';

interface ExtendedPluginAPI {
    LogError: (message: string, data?: Record<string, unknown>) => void;
    LogInfo: (message: string, data?: Record<string, unknown>) => void;
    LogDebug?: (message: string, data?: Record<string, unknown>) => void;
    LogWarn?: (message: string, data?: Record<string, unknown>) => void;
}

declare global {
    interface Window {
        registerPlugin(pluginId: string, plugin: any): void;
        pluginAPI?: PluginRegistry & Partial<ExtendedPluginAPI>;
    }
}
