// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const PLUGIN_ID = 'kr.esob.collabview-plugin';

export function toggleRHS() {
    return (dispatch: any, getState: any) => {
        const state = getState();
        const currentPluggableId = state.views?.rhs?.pluggableId;

        if (currentPluggableId === PLUGIN_ID) {
            dispatch(hideRHSPlugin());
        } else {
            dispatch(showRHSPlugin());
        }
    };
}

function showRHSPlugin() {
    return {
        type: 'UPDATE_RHS_STATE',
        state: 'plugin',
        pluggableId: PLUGIN_ID,
    };
}

function hideRHSPlugin() {
    return {
        type: 'UPDATE_RHS_STATE',
        state: null,
        pluggableId: PLUGIN_ID,
    };
}
