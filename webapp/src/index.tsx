// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import type {Store, AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {FileInfo} from '@mattermost/types/files';
import type {GlobalState} from '@mattermost/types/store';

import MyFileAttachmentOverride from './components/FileAttachment';
import RightSidebarViewer from './components/RightSidebarViewer';
import manifest from './manifest';
import viewerReducer from './reducers/viewer';
import {toggleRHS} from './utils/rhsActions';

import {SUPPORTED_FILE_PREVIEW_EXTENSIONS} from '@/constants/filePreview';

export default class Plugin {
    public async initialize(
        registry: PluginRegistry,
        store: Store<GlobalState, AnyAction> & {
            dispatch: ThunkDispatch<GlobalState, unknown, AnyAction>;
        },
    ) {
        registry.registerReducer(viewerReducer);

        registry.registerRightHandSidebarComponent(
            RightSidebarViewer,
            'CollabView Viewer',
        );

        registry.registerFilePreviewComponent(
            (fileInfo: FileInfo) => {
                const ext = fileInfo.extension?.toLowerCase().replace(/^\./, '');
                return SUPPORTED_FILE_PREVIEW_EXTENSIONS.has(ext ?? '');
            },
            MyFileAttachmentOverride,
        );

        window.addEventListener('message', (event) => {
            if (event.data?.type === 'openRHSPlugin') {
                try {
                    (store.dispatch as any)(toggleRHS());
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('[Plugin] Failed to dispatch RHS open:', err);
                }
            }
        });
    }

    public uninitialize() {}
}

if (window.registerPlugin) {
    window.registerPlugin(manifest.id, new Plugin());
} else {
    // eslint-disable-next-line no-console
    console.warn('[Plugin] window.registerPlugin is not defined');
}
