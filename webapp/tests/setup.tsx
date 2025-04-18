// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TextEncoder, TextDecoder} from 'util';

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

if (typeof (globalThis as any).ReadableStream === 'undefined') {
    (globalThis as any).ReadableStream = () => {};
}

export {};
