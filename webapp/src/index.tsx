// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Store, Action} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import MyFileAttachmentOverride from './components/FileAttachment';

import manifest from '@/manifest';
import type {PluginRegistry} from '@/types/mattermost-webapp';

export default class Plugin {
    public async initialize(registry: PluginRegistry, _store: Store<GlobalState, Action<Record<string, unknown>>>) {
        // override 함수: 파일의 확장자가 exe가 아니면 오버라이드
        const override = (fileInfo: any, _post: any): boolean => {
            return fileInfo.extension !== 'exe';
        };

        // 등록: override 조건과 커스텀 컴포넌트를 등록
        registry.registerFilePreviewComponent(override, MyFileAttachmentOverride);
    }
}

declare global {
    interface Window {
        registerPlugin(pluginId: string, plugin: Plugin): void;
    }
}

window.registerPlugin(manifest.id, new Plugin());

