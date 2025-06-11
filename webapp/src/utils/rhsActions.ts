// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {PluginGlobalState} from '@/types/globalState';
import type {RhsState} from '@/types/rhs';

/* eslint-disable no-console */
// RHS 열기/닫기 토글
export function toggleRHS(componentId: string) {
    return (dispatch: any, getState: () => PluginGlobalState) => {
        const state = getState();
        const currentPluggableId = state.views.rhs?.pluggableId;

        if (currentPluggableId === componentId) {
            dispatch(hideRHSPlugin(componentId));
        } else {
            dispatch(showRHSPlugin(componentId));
        }
    };
}

// RHS 열기
export function showRHSPlugin(componentId: string) {
    return {
        type: 'UPDATE_RHS_STATE',
        state: 'plugin',
        pluggableId: componentId,
    };
}

// RHS 닫기 (해당 plugin만 닫음)
function hideRHSPlugin(componentId: string) {
    return {
        type: 'UPDATE_RHS_STATE',
        state: null,
        pluggableId: componentId,
    };
}

// RHS 완전히 닫기 (plugin 여부와 관계없이 무조건 닫음)
export function closeRightHandSide() {
    return (dispatch: any) => {
        dispatch(batchActions([
            {
                type: 'UPDATE_RHS_STATE',
                state: null,
            },
            {
                type: 'SELECT_POST',
                postId: '',
                channelId: '',
                timestamp: 0,
            },
        ]));

        return {data: true};
    };
}

// 현재 RHS 상태 반환
export function getRHSState(state: PluginGlobalState): RhsState {
    return state.views.rhs;
}

export function hideFilePreviewModal() {
    requestAnimationFrame(() => {
        setTimeout(() => {
            const modal = document.querySelector('.file-preview-modal');

            if (modal instanceof HTMLElement) {
                modal.style.display = 'none';
                console.log('file-preview-modal hidden.');
            } else {
                console.warn('file-preview-modal not found.');
            }
        }, 0);
    });
}
