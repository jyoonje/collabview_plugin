// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState as BaseGlobalState} from '@mattermost/types/store';

import type {RhsState} from './rhs';

export type PluginGlobalState = BaseGlobalState & {
    views: {
        rhs: RhsState;
    };
};
