// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import React from 'react';
import type {Store, AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {GlobalState} from '@mattermost/types/store';

import {openRHSWithViewer} from './actions/viewer';
import RHSViewerLauncher from './components/RHSViewerLauncher';
import RightSidebarViewer from './components/RightSidebarViewer';
import manifest from './manifest';
import reducer from './reducers';
import {registerFileClickHandler} from './utils/registerFileClickHandler';
import {registerMessageListener} from './utils/registerMessageListener';

import {CV_SUPPORTED_FILE_EXTENSIONS} from '@/constants/filePreview';
import type {FileInfo} from '@/types/files';
import {
    getFileExtension,
    getLastClickedFileId,
    getLastHandledFileId,
    setLastHandledFileId,
    updateLastClickedFileId,
} from '@/utils/file';
import {searchablePdfToast} from '@/utils/toast/searchablePdfToast';

/* eslint-disable no-console */
export default class Plugin {
    public async initialize(
        registry: PluginRegistry,
        store: Store<GlobalState, AnyAction> & {
            dispatch: ThunkDispatch<GlobalState, unknown, AnyAction>;
            getState: () => GlobalState;
        },
    ) {
        registry.registerReducer(reducer);

        const rhs = registry.registerRightHandSidebarComponent(
            RightSidebarViewer,
            'Collabview',
        ) as {
            id: string;
            hideRHSPlugin?: (dispatch: any, getState: any) => void;
            showRHSPlugin?: object;
            toggleRHSPlugin?: (dispatch: any, getState: any) => void;
        };

        let lastExecutionTime = 0;
        const EXECUTION_GAP_MS = 400;

        registry.registerFilePreviewComponent(
            (fileInfo: FileInfo) => {
                const ext = getFileExtension(fileInfo);
                return CV_SUPPORTED_FILE_EXTENSIONS.has(ext);
            },
            (props) => {
                const now = Date.now();
                if (now - lastExecutionTime < EXECUTION_GAP_MS) {
                    console.log('[Collabview] Throttled duplicate call ignored.');
                    return null;
                }
                lastExecutionTime = now;

                const ext = getFileExtension(props.fileInfo);
                const previousFileId = getLastClickedFileId();
                const lastHandledFileId = getLastHandledFileId();

                console.log('[Collabview] Checking RHS toggle condition:', {
                    previousFileId,
                    currentFileId: props.fileInfo.id,
                    lastHandledFileId,
                });

                if (previousFileId && previousFileId === props.fileInfo.id) {
                    console.log('[Collabview] Same file clicked again, toggling RHS off.');
                    rhs.toggleRHSPlugin?.(store.dispatch, store.getState);
                    updateLastClickedFileId('');
                    setLastHandledFileId('');
                    return null;
                }

                if (lastHandledFileId === props.fileInfo.id) {
                    console.log('[Collabview] Skipping duplicate processing for file:', props.fileInfo.id);
                    setLastHandledFileId('');
                    return null;
                }

                setLastHandledFileId(props.fileInfo.id);
                updateLastClickedFileId(props.fileInfo.id);

                if (CV_SUPPORTED_FILE_EXTENSIONS.has(ext)) {
                    const state = store.getState();
                    const currentUserId = state.entities.users.currentUserId;
                    const currentUser = currentUserId ? state.entities.users.profiles[currentUserId] : null;

                    if (currentUser) {
                        const queryParams = new URLSearchParams({
                            file_id: props.fileInfo.id,
                            user_id: currentUser.id,
                            user_name: currentUser.username,
                        });

                        fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`).then((res) => res.json()).then(({finalURL}) => {
                            store.dispatch(openRHSWithViewer(finalURL, props.fileInfo.id));
                        }).catch((error) => {
                            console.error('[Collabview] Failed to load viewer URL:', error);
                        });
                    }
                }

                return (
                    <RHSViewerLauncher
                        key={props.fileInfo.id}
                        fileInfo={props.fileInfo}
                        store={store}
                        rhsId={rhs.id}
                    />
                );
            },
        );

        registerMessageListener(store, rhs);
        registerFileClickHandler(store);

        const extendedRegistry = registry as PluginRegistry & {
            registerWebSocketEventHandler: (event: string, handler: (msg: any) => void) => void;
        };

        this.registerWebSocketEventHandlers(extendedRegistry);
    }

    public uninitialize() {}

    private registerWebSocketEventHandlers(registry: PluginRegistry & { registerWebSocketEventHandler: (event: string, handler: (msg: any) => void) => void }) {
        const handlers: Record<string, string> = {
            'custom_kr.esob.collabview-plugin_searchable_pdf_converting': 'Searchable PDF 변환을 시작합니다. 최대 1분이 소요될 수 있습니다.',
            'custom_kr.esob.collabview-plugin_searchable_pdf_failed': 'Searchable PDF 변환에 실패했습니다.',
        };

        for (const [event, message] of Object.entries(handlers)) {
            registry.registerWebSocketEventHandler(event, () => {
                console.log(`${event} 이벤트 수신`);
                searchablePdfToast(message);
            });
        }
    }
}

if (window.registerPlugin) {
    window.registerPlugin(manifest.id, new Plugin());
} else {
    console.warn('[Plugin] window.registerPlugin is not defined');
}
