// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDispatch} from 'react-redux';
import type {AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';

import type {GlobalState} from 'mattermost-redux/types/store';

export type AppDispatch = ThunkDispatch<GlobalState, any, AnyAction>;
export const useAppDispatch = () => useDispatch<AppDispatch>();
