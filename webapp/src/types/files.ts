// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface FileInfo {
    id: string;
    name: string;
    extension?: string;
    size?: number;
    mime_type?: string;
}
