// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare module 'mattermost-webapp/plugins/registry' {
    import type {ComponentType} from 'react';
    import type {Store, Action} from 'redux';

    export interface PluginRegistry {
        registerReducer(reducer: any): void;
        registerRightHandSidebarComponent(component: ComponentType<any>, title: string): RHSHandle;
        showRightHandSidebar(componentId?: string): void;
        hideRightHandSidebar(componentId?: string): void;
        unregisterComponent(componentId: string): void;
        registerRootComponent(component: ComponentType<any>): void;
        getStore(): Store;
        registerFilePreviewComponent(
            predicate: (fileInfo: any, post: any) => boolean,
            component: ComponentType<{fileInfo: any}>
        ): void;
        registerMainMenuAction?(
            text: string,
            action: () => Action<any>,
            mobileIcon?: () => JSX.Element
        ): void;
    }

    export interface RHSHandle {
        id: string;
        showRHSPlugin: () => Action<any>;
        hideRHSPlugin: () => Action<any>;
        toggleRHSPlugin: () => Action<any>;
    }
}
