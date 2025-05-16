// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const toastQueue: string[] = [];
let isShowing = false;

export function searchablePdfToast(message: string, duration = 3000) {
    toastQueue.push(message);
    if (!isShowing) {
        showNextToast(duration);
    }
}

function showNextToast(duration: number) {
    if (toastQueue.length === 0) {
        isShowing = false;
        return;
    }

    isShowing = true;
    const message = toastQueue.shift()!;
    const toastId = 'collabview-searchable-pdf-toast';

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
            showNextToast(duration); // 다음 메시지 표시
        });
    }, duration);
}
