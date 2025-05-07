// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

// RHS 열기/닫기 토글
export function toggleRHS(componentId: string) {
    return (dispatch: any, getState: any) => {
        const state = getState();
        const currentPluggableId = state.views?.rhs?.pluggableId;

        if (currentPluggableId === componentId) {
            dispatch(hideRHSPlugin(componentId));
        } else {
            dispatch(showRHSPlugin(componentId));
        }
    };
}

// RHS 열기
function showRHSPlugin(componentId: string) {
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
