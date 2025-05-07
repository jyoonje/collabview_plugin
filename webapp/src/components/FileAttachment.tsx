// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useSelector} from 'react-redux';
import type {Store, AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import pluginConfig from '../../../config/plugin_config.json';
import {openRHSWithViewer} from '../actions/viewer';
import {useAppDispatch} from '../hooks';

import {SUPPORTED_FILE_PREVIEW_EXTENSIONS} from '@/constants/filePreview';

interface MyFileAttachmentProps {
    fileInfo: {
        id: string;
        name: string;
        extension?: string;
    };
    store: Store<GlobalState, AnyAction> & {
        dispatch: ThunkDispatch<GlobalState, unknown, AnyAction>;
        getState: () => GlobalState;
    };
    rhsId: string;
}

export default function MyFileAttachmentOverride({fileInfo}: MyFileAttachmentProps) {
    const dispatch = useAppDispatch();
    const currentUser = useSelector(getCurrentUser);

    useEffect(() => {
        const ext = fileInfo.extension?.toLowerCase().replace(/^\./, '') ||
            fileInfo.name?.split('.').pop()?.toLowerCase() || '';

        // SUPPORTED 확장자인 경우만 기본 프리뷰 제거 + RHS 열기
        if (SUPPORTED_FILE_PREVIEW_EXTENSIONS.has(ext)) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const modal = document.querySelector('.file-preview-modal');
                    // eslint-disable-next-line no-console
                    console.log('[Collabview] file-preview-modal exists?', Boolean(modal));

                    if (modal instanceof HTMLElement) {
                        modal.style.display = 'none';
                        // eslint-disable-next-line no-console
                        console.log('[Collabview] file-preview-modal hidden.');
                    } else {
                        // eslint-disable-next-line no-console
                        console.warn('[Collabview] file-preview-modal not found.');
                    }
                }, 0);
            });

            if (!currentUser) {
                return () => {};
            }

            if (!document.getElementById('collabview-rhs-style')) {
                const style = document.createElement('style');
                style.id = 'collabview-rhs-style';
                style.innerHTML = `
                    .sidebar--right.sidebar--right--expanded {
                        width: 80vw !important;
                        max-width: 80vw !important;
                        z-index: 9999 !important;
                    }

                    .sidebar-right-container,
                    .sidebar--right__content,
                    #rhsContainer {
                        width: 100% !important;
                        height: 100% !important;
                        display: flex !important;
                        flex-direction: column !important;
                        flex-grow: 1 !important;
                    }

                    iframe.plugin-iframe {
                        flex: 1 1 auto !important;
                        width: 100% !important;
                        height: 100% !important;
                        border: none !important;
                    }

                    .sidebar--right__header {
                        flex-shrink: 0 !important;
                        padding: 8px !important;
                    }
                `;
                document.head.appendChild(style);
            }

            const launchViewer = async () => {
                try {
                    const queryParams = new URLSearchParams({
                        file_id: fileInfo.id,
                        user_id: currentUser.id,
                        user_name: currentUser.username,
                        authority: '3',
                    });

                    const res = await fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`);
                    const {finalURL} = await res.json();

                    const postRes = await fetch(pluginConfig.REQUEST_VIEWER_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            objectID: fileInfo.name,
                            finalURL,
                            user_name: currentUser.username,
                            authority: '77',
                            requestFlag: 'Mattermost',
                        }),
                    });

                    const json = await postRes.json();
                    dispatch(openRHSWithViewer(json.finalURL));
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('[MyFileAttachmentOverride] viewer setup error:', err);
                }
            };

            launchViewer();
        }

        // 비-SUPPORTED 확장자는 아무 것도 하지 않고 기본 모달 유지
        return () => {
            document.getElementById('collabview-rhs-style')?.remove();
        };
    }, [fileInfo.id, currentUser?.id]);

    return (
        <div style={{width: '1px', height: '1px', overflow: 'hidden', backgroundColor: '#fff'}}>
            {'CollabView Viewer Override'}
        </div>
    );
}
