// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export default function AdminPanelSection() {
    const handleClick = () => {
        window.open('/plugins/kr.esob.collabview-plugin/public/popup.html', '_blank', 'width=1280,height=900');
    };

    return (
        <div className='section'>
            <div className='form-group'>
                <label className='control-label'>
                    {'Plugin Settings'}
                </label>
                <div className='help-text'>
                    {'Configure access controls, annotation usage, and other settings'}
                </div>
                <button
                    type='button'
                    className='btn btn-link'
                    style={{
                        border: '1px solid #166de0',
                        color: '#166de0',
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: '4px',
                        marginTop: '10px',
                    }}
                    onClick={handleClick}
                >
                    {'Open Plugin Management'}
                </button>
            </div>
        </div>
    );
}

