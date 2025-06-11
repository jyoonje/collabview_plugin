// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import React from 'react';
import type {Store, AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {GlobalState} from '@mattermost/types/store';

import {openRHSWithViewer, setConvertFailed, setConverting, setConvertSuccess} from './actions/viewer';
import RHSViewerLauncher from './components/RHSViewerLauncher';
import RightSidebarViewer from './components/RightSidebarViewer';
import manifest from './manifest';
import reducer from './reducers';
import {registerFileClickHandler} from './utils/registerFileClickHandler';
import {registerMessageListener} from './utils/registerMessageListener';
import {hideFilePreviewModal} from './utils/rhsActions';

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
    private lastExecutionTime = 0;
    private EXECUTION_GAP_MS = 400;
    private lastUserClickedFileName = '';

    public async initialize(
        registry: PluginRegistry,
        store: Store<GlobalState, AnyAction> & {
            dispatch: ThunkDispatch<GlobalState, unknown, AnyAction>;
            getState: () => GlobalState;
        },
    ) {
        registry.registerReducer(reducer);

        const rhs = this.registerRHSComponent(registry, store);
        const extendedRegistry = registry as PluginRegistry & {
            registerWebSocketEventHandler: (event: string, handler: (msg: any) => void) => void;
        };

        this.registerClickTracker();
        this.registerFilePreviewComponent(registry, store, rhs);
        registerMessageListener(store, rhs);
        registerFileClickHandler();
        this.registerWebSocketEventHandlers(store, extendedRegistry);
    }

    public uninitialize() {}

    private registerFilePreviewComponent(
        registry: PluginRegistry,
        store: Store<GlobalState, AnyAction> & {
            dispatch: ThunkDispatch<GlobalState, unknown, AnyAction>;
            getState: () => GlobalState;
        },
        rhs: {
            id: string;
            hideRHSPlugin?: (dispatch: any, getState: any) => void;
            showRHSPlugin?: object;
            toggleRHSPlugin?: (dispatch: any, getState: any) => void;
        },
    ) {
        registry.registerFilePreviewComponent(
            (fileInfo: FileInfo) => CV_SUPPORTED_FILE_EXTENSIONS.has(getFileExtension(fileInfo)),
            (props) => this.handleRHSComponent(props, store, rhs),
        );
    }

    private registerRHSComponent(
        registry: PluginRegistry,
        _store: Store<GlobalState, AnyAction>,
    ) {
        return registry.registerRightHandSidebarComponent(
            RightSidebarViewer,
            'CollabView',
        ) as {
            id: string;
            hideRHSPlugin?: (dispatch: any, getState: any) => void;
            showRHSPlugin?: object;
            toggleRHSPlugin?: (dispatch: any, getState: any) => void;
        };
    }

    private shouldSkipRenderRHS(fileInfo: FileInfo): boolean {
        if (fileInfo.name.toLowerCase() !== this.lastUserClickedFileName.toLowerCase()) {
            hideFilePreviewModal();
            return true;
        }
        return false;
    }

    private handleRHSComponent(
        props: { fileInfo: FileInfo },
        store: Store<GlobalState, AnyAction> & { dispatch: any; getState: any },
        rhs: { id: string; toggleRHSPlugin?: (dispatch: any, getState: any) => void },
    ): JSX.Element | null {
        const now = Date.now();
        if (now - this.lastExecutionTime < this.EXECUTION_GAP_MS) {
            console.log('Throttled duplicate call ignored.');
            return null;
        }
        this.lastExecutionTime = now;

        if (this.shouldSkipRenderRHS(props.fileInfo)) {
            return null;
        }

        this.lastUserClickedFileName = '';

        const previousFileId = getLastClickedFileId();
        const lastHandledFileId = getLastHandledFileId();

        if (previousFileId && previousFileId === props.fileInfo.id) {
            console.log('Same file clicked again, toggling RHS off.');
            rhs.toggleRHSPlugin?.(store.dispatch, store.getState);
            updateLastClickedFileId('');
            setLastHandledFileId('');
            hideFilePreviewModal();
            return null;
        }

        if (lastHandledFileId === props.fileInfo.id) {
            console.log('Skipping duplicate processing for file:', props.fileInfo.id);
            setLastHandledFileId('');
        }

        console.log('previousFileId: ', previousFileId);
        console.log('lastHandledFileId: ', lastHandledFileId);
        setLastHandledFileId(props.fileInfo.id);
        updateLastClickedFileId(props.fileInfo.id);
        this.fetchViewerURLAndOpenRHS(store, props.fileInfo);
        return (
            <RHSViewerLauncher
                key={props.fileInfo.id}
                fileInfo={props.fileInfo}
                store={store}
                rhsId={rhs.id}
            />
        );
    }

    private fetchViewerURLAndOpenRHS(
        store: Store<GlobalState, AnyAction> & { dispatch: any; getState: any },
        fileInfo: FileInfo,
    ) {
        const ext = getFileExtension(fileInfo);
        if (!CV_SUPPORTED_FILE_EXTENSIONS.has(ext)) {
            return;
        }

        const state = store.getState();
        const currentUserId = state.entities.users.currentUserId;
        const currentUser = currentUserId ? state.entities.users.profiles[currentUserId] : null;

        if (!currentUser) {
            return;
        }

        const queryParams = new URLSearchParams({
            file_id: fileInfo.id,
            user_id: currentUser.id,
            user_name: currentUser.username,
        });

        fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`).then((res) => res.json()).then(({finalURL}) => {
            store.dispatch(openRHSWithViewer(finalURL, fileInfo.id, fileInfo.name, false));
        }).catch((error) => {
            console.error('Failed to load viewer URL:', error);
        });
    }

    private registerWebSocketEventHandlers(
        store: Store<GlobalState, AnyAction> & { dispatch: any; getState: any },
        registry: PluginRegistry & {
            registerWebSocketEventHandler: (event: string, handler: (msg: any) => void) => void;
        },
    ) {
        registry.registerWebSocketEventHandler('custom_kr.esob.collabview-plugin_searchable_pdf_converting', () => {
            store.dispatch(setConverting());
            searchablePdfToast('이미지에서 텍스트를 인식 중입니다. 몇 분 정도 소요될 수 있습니다.');
        });
        registry.registerWebSocketEventHandler('custom_kr.esob.collabview-plugin_searchable_pdf_success', () => {
            store.dispatch(setConvertSuccess());
        });
        registry.registerWebSocketEventHandler('custom_kr.esob.collabview-plugin_searchable_pdf_failed', () => {
            store.dispatch(setConvertFailed());
        });
    }

    private registerClickTracker(): void {
        document.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            const postRoot = target.closest('.post-image__column');
            const nameSpan = postRoot?.querySelector('.post-image__name') as HTMLElement;
            if (nameSpan) {
                this.lastUserClickedFileName = nameSpan.textContent?.trim() || '';
            }

            if (target.tagName === 'IMG') {
                const fallbackName =
                    target.getAttribute('aria-label') ||
                    target.getAttribute('title') ||
                    target.getAttribute('alt');

                if (fallbackName) {
                    const match = fallbackName.match(/file thumbnail (.+)$/i);
                    const extractedName = match ? match[1] : fallbackName;

                    this.lastUserClickedFileName = extractedName.trim();
                }
            }
        });
    }
}

if (window.registerPlugin) {
    window.registerPlugin(manifest.id, new Plugin());
} else {
    console.warn('[Plugin] window.registerPlugin is not defined');
}
