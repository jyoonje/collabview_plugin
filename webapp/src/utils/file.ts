// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getFileExtension(fileInfo: { name: string; extension?: string }): string {
    return fileInfo.extension?.toLowerCase().replace(/^\./, '') ??
        fileInfo.name.split('.').pop()?.toLowerCase() ?? '';
}

let lastClickedFileId = '';
let lastHandledFileId = '';
let lastToggledFileId = '';

export function updateLastClickedFileId(fileId: string) {
    lastClickedFileId = fileId;
}

export function getLastClickedFileId(): string {
    return lastClickedFileId;
}

export function setLastHandledFileId(fileId: string) {
    lastHandledFileId = fileId;
}

export function getLastHandledFileId(): string {
    return lastHandledFileId;
}

export function setLastToggledFileId(fileId: string) {
    lastToggledFileId = fileId;
}

export function getLastToggledFileId(): string {
    return lastToggledFileId;
}
