// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import React from 'react';
import type {Store, AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {FileInfo} from '@mattermost/types/files';
import type {GlobalState} from '@mattermost/types/store';

import MyFileAttachmentOverride from './components/FileAttachment';
import RightSidebarViewer from './components/RightSidebarViewer';
import manifest from './manifest';
import reducer from './reducers';
import {toggleRHS} from './utils/rhsActions';

import {SUPPORTED_FILE_PREVIEW_EXTENSIONS} from '@/constants/filePreview';

export default class Plugin {
    public async initialize(
        registry: PluginRegistry,
        store: Store<GlobalState, AnyAction> & {
            dispatch: ThunkDispatch<GlobalState, unknown, AnyAction>;
        },
    ) {
        // 리듀서 등록
        registry.registerReducer(reducer);

        // RHS 사이드바 컴포넌트 등록
        const rhs = registry.registerRightHandSidebarComponent(
            RightSidebarViewer,
            'CollabView Viewer',
        );
        const rhsId = rhs.id;

        // 파일 미리보기 오버라이드 등록
        registry.registerFilePreviewComponent(
            (fileInfo: FileInfo) => {
                const ext = fileInfo.extension?.toLowerCase().replace(/^\./, '');
                return SUPPORTED_FILE_PREVIEW_EXTENSIONS.has(ext ?? '');
            },
            (props: {fileInfo: FileInfo}) => (
                <MyFileAttachmentOverride
                    key={`${props.fileInfo.id}_${Date.now()}`}
                    {...props}
                />
            ),
        );

        // postMessage 기반 RHS 토글
        window.addEventListener('message', (event) => {
            if (event.data?.type === 'openRHSPlugin') {
                // eslint-disable-next-line no-console
                console.log('addEventListener detected:', event.data.type);
                try {
                    (store.dispatch as any)(toggleRHS(rhsId));
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
