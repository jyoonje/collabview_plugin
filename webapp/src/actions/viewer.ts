// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Dispatch} from 'redux';

export const RHS_SHOW_VIEWER = 'RHS_SHOW_VIEWER';
export const SET_CONVERTING = 'SET_CONVERTING';
export const SET_CONVERT_SUCCESS = 'SET_CONVERT_SUCCESS';
export const SET_CONVERT_FAILED = 'SET_CONVERT_FAILED';

export function setViewerFields(finalURL: string, fileId: string, fileName: string) {
    return {
        type: RHS_SHOW_VIEWER,
        payload: {finalURL, fileId, fileName},
    };
}

export function openRHSWithViewer(finalURL: string, fileId: string, fileName: string, shouldOpen: boolean) {
    return (dispatch: Dispatch) => {
        dispatch(setViewerFields(finalURL, fileId, fileName));
        if (shouldOpen) {
            window.postMessage({type: 'openRHSPlugin'}, window.origin);
        }
    };
}

export function setConverting() {
    return {type: SET_CONVERTING};
}

export function setConvertSuccess() {
    return {type: SET_CONVERT_SUCCESS};
}

export function setConvertFailed() {
    return {type: SET_CONVERT_FAILED};
}
