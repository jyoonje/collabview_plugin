// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import pluginConfig from '../../../config/plugin_config.json';
import {openRHSWithViewer} from '../actions/viewer';
import {useAppDispatch} from '../hooks';

interface MyFileAttachmentProps {
    fileInfo: {
        id: string;
        name: string;
        extension: string;
    };
}

export default function MyFileAttachmentOverride({fileInfo}: MyFileAttachmentProps) {
    const dispatch = useAppDispatch();
    const currentUser = useSelector(getCurrentUser);

    // RHS 너비 확장
    useEffect(() => {
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

        return () => {
            const addedStyle = document.getElementById('collabview-rhs-style');
            if (addedStyle) {
                addedStyle.remove();
            }
        };
    }, []);

    // Viewer 로직 실행
    useEffect(() => {
        document.querySelector('.file-preview-modal')?.remove();
        document.querySelector('.a11y__modal')?.parentElement?.remove();

        if (!currentUser) {
            return;
        }

        const launchViewer = async () => {
            const queryParams = new URLSearchParams({
                file_id: fileInfo.id,
                user_id: currentUser.id,
                user_name: currentUser.username,
                authority: '3',
            });

            try {
                const resFinalUrl = await fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`);
                const {finalURL} = await resFinalUrl.json();

                const resMarkups = await fetch('/plugins/kr.esob.collabview-plugin/api/v1/get-markup-options', {
                    method: 'GET',
                    credentials: 'include',
                });
                const markupOptions = await resMarkups.json();

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
                        markups: markupOptions,
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
    }, [fileInfo.id, currentUser?.id]);

    return (
        <div style={{width: '1px', height: '1px', overflow: 'hidden', backgroundColor: '#fff'}}>
            {'CollabView Viewer Override'}
        </div>
    );
}
