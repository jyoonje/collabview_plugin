// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

/* eslint-disable no-console */
export default function RightSidebarViewer() {
    const viewerState = useSelector((state: GlobalState) =>
        (state as any)['plugins-kr.esob.collabview-plugin']?.viewer,
    );

    const finalURL = viewerState?.finalURL || '';
    const converting = viewerState?.converting || false;
    const fileId = viewerState?.fileId || '';

    const modal = document.querySelector('div.file-preview-modal.modal');
    if (modal instanceof HTMLElement) {
        modal.style.display = 'none';
    } else {
        console.warn('file-preview-modal not found.');
    }

    useEffect(() => {
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

    if (converting) {
        return (
            <div style={{height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <i className='fa fa-spinner fa-pulse fa-2x'/>
            </div>
        );
    }

    return (
        <iframe
            key={fileId}
            src={finalURL}
            width='100%'
            height='100%'
            className='plugin-iframe'
            style={{border: 'none'}}
            title='Collabview'
            sandbox='allow-scripts allow-same-origin'
        />
    );
}
