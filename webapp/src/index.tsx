// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginRegistry} from 'mattermost-webapp/plugins/registry';
import React from 'react';
import type {Store, AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {GlobalState} from '@mattermost/types/store';

import RHSViewerLauncher from './components/RHSViewerLauncher';
import RightSidebarViewer from './components/RightSidebarViewer';
import manifest from './manifest';
import reducer from './reducers';
import {registerFileClickHandler} from './utils/registerFileClickHandler';
import {registerMessageListener} from './utils/registerMessageListener';

import {CV_SUPPORTED_FILE_EXTENSIONS} from '@/constants/filePreview';
import type {FileInfo} from '@/types/files';
import {getFileExtension} from '@/utils/file';

/* eslint-disable no-console */
export default class Plugin {
    public async initialize(
        registry: PluginRegistry,
        store: Store<GlobalState, AnyAction> & {
            dispatch: ThunkDispatch<GlobalState, unknown, AnyAction>;
            getState: () => GlobalState;
        },
    ) {
        registry.registerReducer(reducer);

        const rhs = registry.registerRightHandSidebarComponent(
            RightSidebarViewer,
            'Collabview',
        ) as {
            id: string;
            hideRHSPlugin?: (dispatch: any, getState: any) => void;
            showRHSPlugin?: object;
            toggleRHSPlugin?: (dispatch: any, getState: any) => void;
        };

        registry.registerFilePreviewComponent(
            (fileInfo: FileInfo) => {
                const ext = getFileExtension(fileInfo);

                return CV_SUPPORTED_FILE_EXTENSIONS.has(ext);
            },
            (props) => (
                <RHSViewerLauncher
                    key={props.fileInfo.id}
                    fileInfo={props.fileInfo}
                    store={store}
                    rhsId={rhs.id}
                />
            ),
        );
        registerMessageListener(store, rhs); // Collabview 지원 파일 클릭 시 RHS 열기용 메시지 리스너
        registerFileClickHandler(store); // Collabview 지원하지 않는 파일 클릭 시 기본 미리보기를 위한 핸들러
    }

    public uninitialize() {}
}

if (window.registerPlugin) {
    window.registerPlugin(manifest.id, new Plugin());
} else {
    console.warn('[Plugin] window.registerPlugin is not defined');
}
