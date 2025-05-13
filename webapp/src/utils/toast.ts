// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function showToast(message: string, duration = 3000) {
    const modal = document.querySelector('.file-preview-modal');
    if (!(modal instanceof HTMLElement) || modal.style.display === 'none') {
        return; // 모달이 없거나 숨겨져 있으면 아무것도 하지 않음
    }

    const toastId = 'collabview-unsupported-toast';

    // 이미 표시 중이면 무시
    if (document.getElementById(toastId)) {
        return;
    }

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.textContent = message;

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#333',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        zIndex: '9999',
        opacity: '0',
        transition: 'opacity 0.3s ease-in-out',
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}
