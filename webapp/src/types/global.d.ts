// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry, RHSHandle} from 'mattermost-webapp/plugins/registry';

declare global {
    interface Window {
        registerPlugin?: (id: string, pluginClass: any) => void;
        pluginAPI?: PluginRegistry;
        rhsHandle?: RHSHandle;
    }
}
