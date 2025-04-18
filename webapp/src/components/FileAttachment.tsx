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
        // ✅ 기본 파일 미리보기 모달 제거
        const modal = document.querySelector('.file-preview-modal');
        if (modal) {
            modal.remove();
        }

        const backdrop = document.querySelector('.a11y__modal')?.parentElement;
        if (backdrop) {
            backdrop.remove();
        }

        // ✅ CollabView viewer 열기
        const launchViewer = async () => {
            if (!currentUser) {
                return;
            }

            const queryParams = new URLSearchParams({
                file_id: fileInfo.id,
                user_id: currentUser.id,
                user_name: currentUser.username,
                authority: '3',
            });

            const res = await fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`);
            const data = await res.json();

            dispatch(openRHSWithViewer(data.finalURL));
        };

        launchViewer();
    }, [fileInfo, currentUser, dispatch]);

    return (
        <div
            style={{
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                backgroundColor: '#fff',
            }}
        >
            {/* eslint-disable-next-line react/jsx-no-literals */}
            {'CollabView Viewer Override'}
        </div>
    );
}
