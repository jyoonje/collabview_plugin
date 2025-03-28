// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface PluginRegistry {
    registerPostTypeComponent(typeName: string, component: React.ElementType);

    /**
     * Register a component to override file previews.
     * @param override A function that receives fileInfo and post, and returns true if the preview should be overridden.
     * @param component A React component to display instead of the original preview.
     * @returns A unique identifier.
     */
    registerFilePreviewComponent(
        override: (fileInfo: any, post: any) => boolean,
        component: React.ElementType
    ): string;

    // Add more if needed from https://developers.mattermost.com/extend/plugins/webapp/reference
}
