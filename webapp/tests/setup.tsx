// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

if (typeof (globalThis as any).ReadableStream === 'undefined') {
    (globalThis as any).ReadableStream = () => {};
}

export {};
