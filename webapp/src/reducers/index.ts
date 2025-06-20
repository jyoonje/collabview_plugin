// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import permissions from './permissions';
import viewer from './viewer';

export default combineReducers({
    viewer,
    permissions,
});
