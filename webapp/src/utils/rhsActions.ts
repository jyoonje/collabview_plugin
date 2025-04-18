// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

function showRHSPlugin(componentId: string) {
    return {
        type: 'UPDATE_RHS_STATE',
        state: 'plugin',
        pluggableId: componentId,
    };
}

function hideRHSPlugin(componentId: string) {
    return {
        type: 'UPDATE_RHS_STATE',
        state: null,
        pluggableId: componentId,
    };
}

