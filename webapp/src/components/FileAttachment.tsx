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
                const res = await fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`);
                const {finalURL} = await res.json();

                const postRes = await fetch(pluginConfig.REQUEST_VIEWER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
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
    }, [fileInfo.id, currentUser?.id]);

    return (
        <div style={{width: '1px', height: '1px', overflow: 'hidden', backgroundColor: '#fff'}}>
            {'CollabView Viewer Override'}
        </div>
    );
}
