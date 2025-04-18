// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

export default function RightSidebarViewer() {
    // eslint-disable-next-line no-console
    console.log('Component RightSidebarViewer mounted');

    const {finalURL, reloadKey} = useSelector((state: GlobalState) =>
        (state as any)['plugins-kr.esob.collabview-plugin']?.viewer ?? {},
    );
    // eslint-disable-next-line no-console
    console.log('finalURL', finalURL);
    // eslint-disable-next-line no-console
    console.log('reloadKey', reloadKey);

    if (!finalURL) {
        return <div>{'로드할 뷰어 URL이 없습니다.'}</div>;
    }

    return (
        <div style={{height: '100%', width: '100%'}}>
            <iframe
                key={reloadKey}
                src={finalURL}
                width='100%'
                height='100%'
                style={{
                    border: 'none',
                    display: 'block',
                    height: '100%',
                    width: '100%',
                }}
                title='CollabView Viewer'
            />
        </div>
    );
}
