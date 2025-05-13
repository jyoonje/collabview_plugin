// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function injectRHSStyle(styleId: string, css: string) {
    if (document.getElementById(styleId)) {
        return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = css;
    document.head.appendChild(style);
}

export const COLLAVIEW_RHS_STYLE_ID = 'collabview-rhs-style';

export const COLLAVIEW_RHS_CSS = `
    .sidebar--right.sidebar--right--expanded {
        width: 80vw !important;
        max-width: 80vw !important;
        z-index: 9999 !important;
    }

    .sidebar-right-container,
    .sidebar--right__content,
    #rhsContainer {
        width: 100% !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        flex-grow: 1 !important;
    }

    iframe.plugin-iframe {
        flex: 1 1 auto !important;
        width: 100% !important;
        height: 100% !important;
        border: none !important;
    }

    .sidebar--right__header {
        flex-shrink: 0 !important;
        padding: 8px !important;
    }
`;
