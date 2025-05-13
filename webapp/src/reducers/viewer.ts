// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHS_SHOW_VIEWER} from '../actions/viewer';

const initialState = {
    finalURL: '',
    fileId: '',
};

export default function viewer(state = initialState, action: any) {
    switch (action.type) {
    case RHS_SHOW_VIEWER:
        return {
            finalURL: action.payload.finalURL,
            fileId: action.payload.fileId,
        };
    default:
        return state;
    }
}
