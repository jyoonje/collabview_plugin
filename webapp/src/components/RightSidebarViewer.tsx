// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {storeSessionDataOnCollabview} from './RHSViewerLauncher';

/* eslint-disable no-console */
/* eslint-disable no-alert */
export default function RightSidebarViewer() {
    const viewerState = useSelector((state: GlobalState) =>
        (state as any)['plugins-kr.esob.collabview-plugin']?.viewer,
    );

    const finalURL = viewerState?.finalURL || '';
    const converting = viewerState?.converting || false;

    useEffect(() => {
        if (!finalURL) {
            return;
        }
        const headerEl = document.querySelector('.sidebar--right__header .pull-right');
        let button = document.querySelector('#my-collabview-popup-button') as HTMLButtonElement | null;

        if (!button && headerEl) {
            button = document.createElement('button');
            button.id = 'my-collabview-popup-button';
            button.textContent = 'Popup';
            button.className = 'btn btn-secondary btn-sm';
            button.style.marginRight = '8px';
            headerEl.prepend(button);
        }

        if (button) {
            button.onclick = () => {
                window.open(finalURL, '_blank', 'width=1200,height=800');
            };
        }
    }, [finalURL]);

    if (!finalURL) {
        return null;
    }

    if (converting) {
        return (
            <div style={{height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <i className='fa fa-spinner fa-pulse fa-2x'/>
            </div>
        );
    }

    return (
        <iframe
            key={finalURL}
            src={finalURL}
            width='100%'
            height='100%'
            className='plugin-iframe'
            style={{border: 'none'}}
            title='CollabView'
            sandbox='allow-scripts allow-same-origin'
        />
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchFinalViewerURLAndStoreSession(
    fileInfo: { id: string; name: string },
    currentUser: { id: string; username: string },
    requestViewerURL: string,
): Promise<string | null> {
    try {
        const queryParams = new URLSearchParams({
            file_id: fileInfo.id,
            user_id: currentUser.id,
            user_name: currentUser.username,
        });

        const resFinalUrl = await fetch(`/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams}`);
        const {finalURL} = await resFinalUrl.json();

        const resMarkups = await fetch('/plugins/kr.esob.collabview-plugin/api/v1/get-markup-options', {
            method: 'GET',
            credentials: 'include',
        });
        const markupOptions = await resMarkups.json();

        const json = await storeSessionDataOnCollabview(
            requestViewerURL,
            fileInfo.name,
            finalURL,
            currentUser.username,
            markupOptions,
        );

        return json.finalURL;
    } catch {
        return null;
    }
}
