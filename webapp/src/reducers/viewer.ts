// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHS_SHOW_VIEWER} from '../actions/viewer';

const initialState = {
    finalURL: '',
};

export default function viewer(state = initialState, action: any) {
    switch (action.type) {
    case RHS_SHOW_VIEWER:
        // eslint-disable-next-line no-console
        console.log('[viewer reducer] RHS_SHOW_VIEWER received:', action.payload.finalURL);
        return {
            ...state,
            finalURL: action.payload.finalURL,
        };
    default:
        return state;
    }
}
