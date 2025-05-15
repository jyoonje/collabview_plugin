// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useSelector} from 'react-redux';
import type {Store, AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import pluginConfig from '../../../config/plugin_config.json';
import {openRHSWithViewer} from '../actions/viewer';
import {useAppDispatch} from '../hooks';

import {CV_SUPPORTED_FILE_EXTENSIONS} from '@/constants/filePreview';
import {getFileExtension, updateLastClickedFileId} from '@/utils/file';
import {injectRHSStyle, COLLAVIEW_RHS_STYLE_ID, COLLAVIEW_RHS_CSS} from '@/utils/style';

/* eslint-disable no-console */
interface RHSViewerLauncher {
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

// Collabview 서버에 세션 데이터를 저장하는 함수
async function storeSessionDataOnCollabview(
    requestUrl: string,
    fileName: string,
    finalURL: string,
    username: string,
    markupOptions: any,
) {
    const postRes = await fetch(requestUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            objectID: fileName,
            finalURL,
            user_name: username,
            authority: '100',
            requestFlag: 'Mattermost',
            markups: markupOptions,
        }),
    });

    return postRes.json();
}

export default function RHSViewerLauncher({fileInfo}: RHSViewerLauncher) {
    const dispatch = useAppDispatch();
    const currentUser = useSelector(getCurrentUser);

    console.log('currentUsercurrentUser:', currentUser);

    useEffect(() => {
        console.log('useEffectuseEffect:', useEffect);
        const ext = getFileExtension(fileInfo);

        // SUPPORTED 확장자인 경우만 기본 프리뷰 제거 + RHS 열기
        if (CV_SUPPORTED_FILE_EXTENSIONS.has(ext)) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const modal = document.querySelector('.file-preview-modal');
                    console.log('[Collabview] file-preview-modal exists?', Boolean(modal));

                    if (modal instanceof HTMLElement) {
                        modal.style.display = 'none';
                        console.log('[Collabview] file-preview-modal hidden.');
                    } else {
                        console.warn('[Collabview] file-preview-modal not found.');
                    }
                }, 0);
            });

            if (!currentUser) {
                return () => {};
            }

            injectRHSStyle(COLLAVIEW_RHS_STYLE_ID, COLLAVIEW_RHS_CSS);

            const launchViewer = async () => {
                const queryParams = new URLSearchParams({
                    file_id: fileInfo.id,
                    user_id: currentUser.id,
                    user_name: currentUser.username,
                });

                try {
                    updateLastClickedFileId(fileInfo.id);

                    const resFinalUrl = await fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`);
                    const {finalURL} = await resFinalUrl.json();

                    const resMarkups = await fetch('/plugins/kr.esob.collabview-plugin/api/v1/get-markup-options', {
                        method: 'GET',
                        credentials: 'include',
                    });
                    const markupOptions = await resMarkups.json();

                    const json = await storeSessionDataOnCollabview(
                        pluginConfig.REQUEST_VIEWER_URL,
                        fileInfo.name,
                        finalURL,
                        currentUser.username,
                        markupOptions,
                    );

                    dispatch(openRHSWithViewer(json.finalURL, fileInfo.id));
                } catch (err) {
                    console.error('[MyFileAttachmentOverride] viewer setup error:', err);
                }
            };

            launchViewer();
        }

        // SUPPORTED 확장자의 파일이 아니면 RHS 스타일 제거 후 기본 모달 유지
        return () => {
            document.getElementById('collabview-rhs-style')?.remove();
        };
    }, [fileInfo.id, currentUser?.id]);

    return null;
}
