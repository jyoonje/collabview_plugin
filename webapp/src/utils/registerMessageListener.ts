// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {toggleRHS, showRHSPlugin, getRHSState} from './rhsActions';

import {getLastClickedFileId} from '@/utils/file';

/* eslint-disable no-console */
export function registerMessageListener(
    store: any,
    rhs: {
        id: string;
        hideRHSPlugin?: (dispatch: any, getState: any) => void;
    },
) {
    window.addEventListener('message', (event) => {
        try {
            if (event.data?.type === 'closeRHSPlugin') {
                if (rhs.hideRHSPlugin) {
                    console.log('[Plugin] Hide RHS, event:', event);
                    rhs.hideRHSPlugin(store.dispatch, store.getState);
                } else {
                    store.dispatch(toggleRHS(''));
                }
            } else if (event.data?.type === 'openRHSPlugin') {
                const state = store.getState();
                const rhsState = getRHSState(state);
                const currentPluggableId = rhsState?.pluggableId;

                const currentFileId = state.viewer?.fileId || '';
                const newFileId = getLastClickedFileId;

                console.log('currentPluggableId:', currentPluggableId);
                console.log('rhs.id:', rhs.id);
                console.log('currentFileId:', currentFileId);
                console.log('newFileId:', newFileId);

                if (currentPluggableId === rhs.id && currentFileId === newFileId) {
                    // 이미 열려 있고 같은 파일이면 토글(닫기)
                    store.dispatch(toggleRHS(rhs.id));
                } else {
                    // 다른 파일이거나 닫혀 있으면 강제로 열기
                    store.dispatch(showRHSPlugin(rhs.id));
                }
            }
        } catch (err) {
            console.error('[Plugin] Failed to handle message event:', err);
        }
    });
}
