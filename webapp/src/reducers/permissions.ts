// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SET_CAN_DOWNLOAD} from '../actions/permissions';
import type {PermissionsActions} from '../actions/permissions';

type PermissionsState = {
    canDownload: boolean | null;
};

const initialState: PermissionsState = {
    canDownload: null,
};

export default function permissionsReducer(
    state = initialState,
    action: PermissionsActions,
): PermissionsState {
    switch (action.type) {
    case SET_CAN_DOWNLOAD:
        return {...state, canDownload: action.payload};
    default:
        return state;
    }
}
