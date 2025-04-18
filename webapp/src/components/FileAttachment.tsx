// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

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
        // 기본 파일 미리보기 제거
        document.querySelector('.file-preview-modal')?.remove();
        document.querySelector('.a11y__modal')?.parentElement?.remove();

        if (!currentUser) {
            return;
        }

        const queryParams = new URLSearchParams({
            file_id: fileInfo.id,
            user_id: currentUser.id,
            user_name: currentUser.username,
            authority: '3',
        });

        fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`).then((res) => res.json()).then((data) => {
            dispatch(openRHSWithViewer(data.finalURL));
        }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('[MyFileAttachmentOverride] fetch error:', err);
        });
    }, [fileInfo.id, currentUser?.id]);

    return (
        <div
            style={{
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                backgroundColor: '#fff',
            }}
        >
            {'CollabView Viewer Override'}
        </div>
    );
}
