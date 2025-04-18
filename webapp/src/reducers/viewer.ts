// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHS_SHOW_VIEWER} from '../actions/viewer';

const initialState = {
    finalURL: '',
    reloadKey: 0,
};

export default function viewer(state = initialState, action: any) {
    switch (action.type) {
    case RHS_SHOW_VIEWER:
        return {
            finalURL: action.payload.finalURL,
            reloadKey: action.payload.reloadKey,
        };
    default:
        return state;
    }
}
