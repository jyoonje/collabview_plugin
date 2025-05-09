// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getFileExtension(fileInfo: { name: string; extension?: string }): string {
    return fileInfo.extension?.toLowerCase().replace(/^\./, '') ??
        fileInfo.name.split('.').pop()?.toLowerCase() ?? '';
}
