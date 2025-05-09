// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {toggleRHS} from './rhsActions';

/* eslint-disable no-console */
export function registerMessageListener(
    store: any,
    rhs: {
        id: string;
        hideRHSPlugin?: (dispatch: any, getState: any) => void;
    },
) {
    window.addEventListener('message', (event) => {
        try {
            if (event.data?.type === 'closeRHSPlugin') {
                if (rhs.hideRHSPlugin) {
                    console.log('[Plugin] Hide RHS, event:', event);
                    rhs.hideRHSPlugin(store.dispatch, store.getState);
                } else {
                    store.dispatch(toggleRHS(''));
                }
            } else if (event.data?.type === 'openRHSPlugin') {
                store.dispatch(toggleRHS(rhs.id));
            }
        } catch (err) {
            console.error('[Plugin] Failed to handle message event:', err);
        }
    });
}
