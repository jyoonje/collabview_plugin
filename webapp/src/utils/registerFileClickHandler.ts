// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CV_SUPPORTED_FILE_EXTENSIONS} from '@/constants/filePreview';
import {showUnsupportedFileToast} from '@/utils/toast/unsupportedFileToast';

export function registerFileClickHandler() {
    document.addEventListener('click', (e) => {
        const clickedEl = e.target as HTMLElement;

        if (clickedEl.closest('.file-preview-modal')) {
            return;
        }

        setTimeout(() => {
            const fileNameEl = document.querySelector('.file-preview-modal__file-name');
            const filename = fileNameEl?.textContent?.trim() ?? '';
            const ext = filename.split('.').pop()?.toLowerCase() ?? '';

            if (CV_SUPPORTED_FILE_EXTENSIONS.has(ext)) {
                return;
            }

            const modal = document.querySelector('.file-preview-modal');
            if (modal instanceof HTMLElement) {
                modal.style.display = 'block';
                modal.classList.add('in');
                modal.classList.remove('fade');
                modal.removeAttribute('aria-hidden');
            }

            showUnsupportedFileToast('뷰어가 지원되지 않는 파일 형식입니다.');
        }, 50);
    }, true);
}
