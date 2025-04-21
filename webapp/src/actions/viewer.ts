// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Dispatch} from 'redux';

export const RHS_SHOW_VIEWER = 'RHS_SHOW_VIEWER';

export function openRHSWithViewer(finalURL: string) {
    return (dispatch: Dispatch) => {
        dispatch({
            type: RHS_SHOW_VIEWER,
            payload: {
                finalURL,
            },
        });

        window.postMessage({type: 'openRHSPlugin'}, window.origin);
    };
}
