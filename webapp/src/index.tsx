// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import React from 'react';
import type {Store, AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {GlobalState} from '@mattermost/types/store';

import MyFileAttachmentOverride from './components/FileAttachment';
import RightSidebarViewer from './components/RightSidebarViewer';
import manifest from './manifest';
import reducer from './reducers';
import {toggleRHS, closeRightHandSide} from './utils/rhsActions';

import {SUPPORTED_FILE_PREVIEW_EXTENSIONS} from '@/constants/filePreview';
import type {FileInfo} from '@/types/files';

function showUnsupportedFileToast(message: string, duration = 3000) {
    const toastId = 'collabview-unsupported-toast';

    // 이미 표시 중이면 무시
    if (document.getElementById(toastId)) {
        return;
    }

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.textContent = message;

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#333',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        zIndex: '9999',
        opacity: '0',
        transition: 'opacity 0.3s ease-in-out',
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}

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

        registry.registerFilePreviewComponent(
            (fileInfo: FileInfo) => {
                const ext = fileInfo.extension?.toLowerCase().replace(/^\./, '') ||
                    fileInfo.name?.split('.').pop()?.toLowerCase() || '';

                return SUPPORTED_FILE_PREVIEW_EXTENSIONS.has(ext);
            },
            (props) => (
                <MyFileAttachmentOverride
                    key={`${props.fileInfo.id}_${Date.now()}`}
                    fileInfo={props.fileInfo}
                    store={store}
                    rhsId={rhs.id}
                />
            ),
        );

        window.addEventListener('message', (event) => {
            if (event.data?.type === 'closeRHSPlugin') {
                try {
                    if (rhs?.hideRHSPlugin) {
                        rhs.hideRHSPlugin(store.dispatch, store.getState);
                    } else {
                        store.dispatch(toggleRHS(''));
                    }
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('[Plugin] Failed to dispatch RHS close:', err);
                }
            } else if (event.data?.type === 'openRHSPlugin') {
                try {
                    store.dispatch(toggleRHS(rhs.id));
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('[Plugin] Failed to dispatch RHS open:', err);
                }
            }
        });

        document.addEventListener('click', (e) => {
            const clickedEl = e.target as HTMLElement;

            // 모달 내부 클릭은 무시
            if (clickedEl.closest('.file-preview-modal')) {
                // eslint-disable-next-line no-console
                console.log('[Collabview] Ignored click inside modal');
                return;
            }

            setTimeout(() => {
                const fileNameEl = document.querySelector('.file-preview-modal__file-name');
                const filename = fileNameEl?.textContent?.trim() ?? '';
                const ext = filename.split('.').pop()?.toLowerCase() ?? '';

                // eslint-disable-next-line no-console
                console.log('[Collabview] Detected file in modal:', filename, '| ext:', ext);

                if (SUPPORTED_FILE_PREVIEW_EXTENSIONS.has(ext)) {
                    // eslint-disable-next-line no-console
                    console.log('[Collabview] Supported file. Modal stays hidden.');
                    return;
                }

                // RHS 닫기
                store.dispatch(closeRightHandSide());

                // 모달 복원
                const modal = document.querySelector('.file-preview-modal');
                if (modal instanceof HTMLElement) {
                    modal.style.display = 'block';
                    modal.classList.add('in');
                    modal.classList.remove('fade');
                    modal.removeAttribute('aria-hidden');
                    // eslint-disable-next-line no-console
                    console.log('[Collabview] Modal restored for non-supported file:', filename);
                } else {
                    // eslint-disable-next-line no-console
                    console.warn('[Collabview] .file-preview-modal not found');
                }

                showUnsupportedFileToast('Collabview 변환이 지원되지 않는 확장자의 파일입니다');
            }, 50);
        }, true);
    }

    public uninitialize() {}
}

if (window.registerPlugin) {
    window.registerPlugin(manifest.id, new Plugin());
} else {
    // eslint-disable-next-line no-console
    console.warn('[Plugin] window.registerPlugin is not defined');
}
