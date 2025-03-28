// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useCallback} from 'react';

interface MyFileAttachmentProps {
    fileInfo: {
        id: string;
        name: string;
        extension: string;
    };
    post: any;
}

export default function MyFileAttachmentOverride(props: MyFileAttachmentProps) {
    const handleRedirect = useCallback(() => {
        if (props.fileInfo.extension === 'exe') {
            return;
        }
        const url = 'http://192.168.0.244:3508/cv_call';
        const params: Record<string, string> = {
            authority: '1',
            userName: 'ODM 업체',
            userID: 'ODM',
            objectID: '22000',
            filePath: 'artwork/20241017/1234.jpg',
        };

        // 동적으로 form 요소 생성
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = url;

        // 숨겨진 input 필드 생성 후 추가
        for (const key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = params[key];
                form.appendChild(input);
            }
        }

        // 문서에 form 추가 후 제출
        document.body.appendChild(form);
        form.submit();
    }, [props.fileInfo]);

    useEffect(() => {
        handleRedirect();
    }, [handleRedirect]);

    return null;
}
