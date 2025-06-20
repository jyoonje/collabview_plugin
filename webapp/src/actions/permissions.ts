// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const SET_CAN_DOWNLOAD = 'collabview/SET_CAN_DOWNLOAD' as const;

export const setCanDownload = (canDownload: boolean) => ({
    type: SET_CAN_DOWNLOAD,
    payload: canDownload,
});

export type PermissionsActions =
    | ReturnType<typeof setCanDownload>;
