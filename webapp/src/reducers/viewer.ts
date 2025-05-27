// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHS_SHOW_VIEWER, SET_CONVERT_FAILED, SET_CONVERT_SUCCESS, SET_CONVERTING} from '../actions/viewer';

const initialState = {
    finalURL: '',
    fileId: '',
    converting: false,
};

export default function viewer(state = initialState, action: any) {
    switch (action.type) {
    case RHS_SHOW_VIEWER:
        return {
            ...state,
            finalURL: action.payload.finalURL,
            fileId: action.payload.fileId,
        };
    case SET_CONVERTING:
        return {
            ...state,
            converting: true,
        };
    case SET_CONVERT_SUCCESS:
    case SET_CONVERT_FAILED:
        return {
            ...state,
            converting: false,
        };
    default:
        return state;
    }
}
