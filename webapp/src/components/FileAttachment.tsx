// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useCallback} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

interface MyFileAttachmentProps {
    fileInfo: {
        id: string;
        name: string;
        extension: string;
    };
}

export default function MyFileAttachmentOverride(props: MyFileAttachmentProps) {
    const currentUser = useSelector(getCurrentUser);

    const handleRedirect = useCallback(() => {
        if (props.fileInfo.extension === 'exe') {
            return;
        }

        if (!currentUser) {
            return;
        }

        const queryParams = new URLSearchParams({
            file_id: props.fileInfo.id,
            user_id: currentUser.id,
            user_name: currentUser.username,
            authority: '3',
        });

        const redirectURL = `/plugins/kr.esob.collabview-plugin/api/v1/viewer-redirect?${queryParams.toString()}`;

        window.open(redirectURL, '_blank');
    }, [props.fileInfo, currentUser]);

    useEffect(() => {
        handleRedirect();
    }, [handleRedirect]);

    return null;
}
