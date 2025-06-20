// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable */
import React, {useState, useEffect} from 'react';
import '../popup.css';

type Channel = {
    id: string;
    name: string;
    enableSearchablePDF: boolean;
};

type TeamSetting = {
    id: string;
    name: string;
    expanded: boolean;
    channels: Channel[];
};

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'user' | 'team'>('user');
    const [annotationSettings, setAnnotationSettings] = useState({
        view_markup_button: true,
        view_markup_color_toolbar: true,
        view_check_button: false,
        view_speech_bubble_button: true,
        view_speech_bubble_color_toolbar: true,
        view_first_markup: false,
        view_first_speechbubble: false,
        allow_markup_creation: true,
        allow_markup_move: true,
        allow_speech_bubble_creation: true,
        allow_speech_bubble_move: true,
        allow_view_chatting: true,
        allow_use_chatting: true,
    });
    const [userSettings, setUserSettings] = useState<Record<string, boolean>>({});

    const [availableRoles, setAvailableRoles] = useState<{ name: string; display_name: string }[]>([]);

    const [teamSettings, setTeamSettings] = useState<TeamSetting[]>([]);
    const [loading, setLoading] = useState(true);

    // 페이지 로드 시 실제 팀/채널 fetch
    useEffect(() => {
        (async () => {
            const csrfToken = getCookie('MMCSRF');

            type MMRole = {
                name: string;
                display_name: string;
            };

            // ✅ Roles 가져오기
            const coreRoles = ['system_admin', 'system_user', 'system_guest'];
            const rolesResponse = await fetch(`/api/v4/roles?names=${coreRoles.join(',')}`, {
                headers: { 'X-CSRF-Token': csrfToken },
                credentials: 'include',
            });
            const roles: MMRole[] = await rolesResponse.json();
            const filteredRoles = roles.filter((role) => coreRoles.includes(role.name));

            setAvailableRoles(filteredRoles);

            // ✅ Teams & Channels
            const teamsResponse = await fetch('/api/v4/teams', {
                headers: { 'X-CSRF-Token': csrfToken },
                credentials: 'include',
            });
            const teams = await teamsResponse.json();

            const fetched = await Promise.all(
                teams.map(async (team: any) => {
                    const channelsResponse = await fetch(`/api/v4/teams/${team.id}/channels`, {
                        headers: { 'X-CSRF-Token': csrfToken },
                        credentials: 'include',
                    });
                    const channels = await channelsResponse.json();
                    return {
                        id: team.id,
                        name: team.display_name,
                        expanded: false,
                        channels: channels
                            .filter((c: any) => (c.type === 'O' || c.type === 'P') && c.delete_at === 0)
                            .map((channel: any) => ({
                                id: channel.id,
                                name: channel.display_name,
                                enableSearchablePDF: false,
                            })),
                    };
                }),
            );

            const optionsRes = await fetch('/plugins/kr.esob.collabview-plugin/api/v1/get-plugin-options', {
                headers: { 'X-CSRF-Token': csrfToken },
                credentials: 'include',
            });
            let options = await optionsRes.json();
            options = options || {};

            const newUserSettings: Record<string, boolean> = {};
            filteredRoles.forEach((role) => {
                const baseName = role.name.replace('system_', '');
                newUserSettings[role.name] = options.webapp?.file_download_roles?.includes(role.name) || false;
            });
            setUserSettings(newUserSettings);

            const updated: TeamSetting[] = fetched.map((team) => ({
                ...team,
                channels: team.channels.map((channel: Channel) => ({
                    ...channel,
                    enableSearchablePDF:
                        options.server?.team_settings?.[team.id]?.channel_settings?.[channel.id]?.searchablePDF ?? false,
                })),
            }));
            setTeamSettings(updated);

            const teamIds = Object.keys(options.server?.team_settings || {});
            if (teamIds.length > 0) {
                const firstTeam = options.server.team_settings[teamIds[0]];
                const channelIds = Object.keys(firstTeam.channel_settings || {});
                if (channelIds.length > 0) {
                    const firstChannel = firstTeam.channel_settings[channelIds[0]];
                    const useAnnotation: string[] = firstChannel.use_annotation || [];

                    const newAnnotationSettings = { ...annotationSettings };
                    (Object.keys(newAnnotationSettings) as Array<keyof typeof newAnnotationSettings>).forEach((k) => {
                        newAnnotationSettings[k] = false;
                    });
                    useAnnotation.forEach((k) => {
                        if (k in newAnnotationSettings) {
                            newAnnotationSettings[k as keyof typeof newAnnotationSettings] = true;
                        }
                    });
                    setAnnotationSettings(newAnnotationSettings);
                }
            }

            setLoading(false);
        })();
    }, []);

    const handleAnnotationChange = (setting: string) => {
        setAnnotationSettings({
            ...annotationSettings,
            [setting]:
                !annotationSettings[setting as keyof typeof annotationSettings],
        });
    };
    const handleUserRoleChange = (role: string) => {
        setUserSettings({
            ...userSettings,
            [role]: !userSettings[role as keyof typeof userSettings],
        });
    };
    const toggleTeamExpand = (teamId: string) => {
        setTeamSettings(
            teamSettings.map((team) =>
                team.id === teamId ? {...team, expanded: !team.expanded} : team,
            ),
        );
    };

    const handleChannelSettingChange = (teamId: string, channelId: string) => {
        setTeamSettings(
            teamSettings.map((team) =>
                team.id === teamId? {
                        ...team,
                        channels: team.channels.map((channel) =>
                            channel.id === channelId? {
                                    ...channel,
                                    enableSearchablePDF: !channel.enableSearchablePDF,
                                }: channel,
                        ),
                    }: team,
            ),
        );
    };
    const handleSave = async () => {
        const csrfToken = getCookie('MMCSRF');
        try {
            const response = await fetch('/plugins/kr.esob.collabview-plugin/api/v1/save-plugin-options', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({
                    webapp: {
                        file_download_roles: Object.entries(userSettings)
                            .filter(([, enabled]) => enabled)
                            .map(([role]) => role),
                    },
                    server: {
                        team_settings: transformTeamSettings(),
                    },
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save settings');
            }

            alert('Settings saved successfully!');
            window.close();
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save settings. Check console for details.');
        }
    };

    function getCookie(name: string): string {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    const transformTeamSettings = () => {
        const teamSettingsMap: Record<string, any> = {};

        const useAnnotation: string[] = [];
        for (const [key, enabled] of Object.entries(annotationSettings)) {
            if (enabled) {
                useAnnotation.push(key);
            }
        }

        for (const team of teamSettings) {
            const channelMap: Record<string, any> = {};

            for (const channel of team.channels) {
                channelMap[channel.id] = {
                    searchablePDF: channel.enableSearchablePDF,
                    use_annotation: [...useAnnotation],
                };
            }

            teamSettingsMap[team.id] = {
                channel_settings: channelMap,
            };
        }

        return teamSettingsMap;
    };


    return (
        <div className='min-h-screen bg-gray-50 flex flex-col'>
            {/* Header */}
            <header className='bg-white border-b border-gray-200 px-6 py-4'>
                <h1 className='text-2xl font-semibold text-gray-800'>
                    {'Collabview Plugin Settings'}
                </h1>
                <p className='text-sm text-gray-600 mt-1'>
                    {'Configure the Collabview plugin settings for your Mattermost instance'}
                </p>
            </header>
            {/* Main Content */}
            <main className='flex-grow px-6 py-6 overflow-auto'>
                <div className='max-w-5xl mx-auto'>
                    {/* Annotation Settings Section */}
                    <section className='bg-white rounded-lg shadow-sm mb-8 overflow-hidden'>
                        <div className='px-6 py-5 border-b border-gray-200'>
                            <h2 className='text-lg font-medium text-gray-800'>
                                {'🖊️ Annotation Settings'}
                            </h2>
                            <p className='text-sm text-gray-600 mt-1'>
                                {'Enable or disable specific annotation features'}
                            </p>
                        </div>
                        <div className='p-6'>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                {Object.entries(annotationSettings).map(([key, value]) => {
                                    const formattedLabel = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
                                    return (
                                        <div key={key}
                                             className='flex items-center'>
                                            <input
                                                id={key}
                                                type='checkbox'
                                                checked={value}
                                                onChange={() => handleAnnotationChange(key)}
                                                className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
                                            />
                                            <label
                                                htmlFor={key}
                                                className='ml-2 text-sm text-gray-700 cursor-pointer'
                                            >
                                                {formattedLabel}
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                    {/* ACL Settings Section */}
                    <section className='bg-white rounded-lg shadow-sm mb-8 overflow-hidden'>
                        <div className='px-6 py-5 border-b border-gray-200'>
                            <h2 className='text-lg font-medium text-gray-800'>
                                {'🛡️ ACL Settings'}
                            </h2>
                            <p className='text-sm text-gray-600 mt-1'>
                                {'Configure access control settings for users and teams'}
                            </p>
                        </div>
                        {/* Tabs */}
                        <div className='border-b border-gray-200'>
                            <nav className='flex -mb-px'>
                                <button
                                    onClick={() => setActiveTab('user')}
                                    className={`py-4 px-6 text-sm font-medium ${
                                        activeTab === 'user' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap cursor-pointer`}
                                >
                                    {'User'}
                                </button>
                                <button
                                    onClick={() => setActiveTab('team')}
                                    className={`py-4 px-6 text-sm font-medium ${
                                        activeTab === 'team' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap cursor-pointer`}
                                >
                                    {'Team'}
                                </button>
                            </nav>
                        </div>
                        {/* Tab Content */}
                        <div className='p-6'>
                            {activeTab === 'user' ? (
                                <div>
                                    <h3 className='text-md font-medium text-gray-800 mb-4'>
                                        {'File Download Permission'}
                                    </h3>
                                    <p className='text-sm text-gray-600 mb-4'>
                                        {'Select which user roles can download files. If a user has ' +
                                            'any of the selected roles, the file download button will be ' +
                                            'available for them.'}
                                    </p>
                                    <div className='space-y-3'>
                                        {availableRoles.map(({ name }) => {
                                            const pretty = name
                                                .replace(/^system_/, '')
                                                .replace(/_/g, ' ')
                                                .replace(/(^\w|\s\w)/g, m => m.toUpperCase());

                                            return (
                                                <div key={name} className='flex items-center'>
                                                    <input
                                                        id={`role-${name}`}
                                                        type='checkbox'
                                                        checked={userSettings[name] || false}
                                                        onChange={() => handleUserRoleChange(name)}
                                                        className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
                                                    />
                                                    <label
                                                        htmlFor={`role-${name}`}
                                                        className='ml-2 text-sm text-gray-700 cursor-pointer'
                                                    >
                                                        {pretty}
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h3 className='text-md font-medium text-gray-800 mb-4'>
                                        {'Enable Searchable PDF'}
                                    </h3>
                                    <p className='text-sm text-gray-600 mb-4'>
                                        {'Enable or disable the Searchable PDF feature for each team.'}
                                    </p>
                                    <div className='overflow-x-auto'>
                                        <table className='min-w-full divide-y divide-gray-200'>
                                            <thead className='bg-gray-50'>
                                                <tr>
                                                    <th
                                                        scope='col'
                                                        className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                                                    >
                                                        {'Team / Channel Name'}
                                                    </th>
                                                    <th
                                                        scope='col'
                                                        className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                                                    >
                                                        {'Searchable PDF'}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className='bg-white divide-y divide-gray-200'>
                                                {teamSettings.map((team) => (
                                                    <>
                                                        <tr
                                                            key={team.id}
                                                            className='bg-gray-50 hover:bg-gray-100'
                                                        >
                                                            <td className='px-6 py-4 text-sm text-gray-700'>
                                                                <button
                                                                    onClick={() => toggleTeamExpand(team.id)}
                                                                    className='flex items-center space-x-2 focus:outline-none'
                                                                >
                                                                    <i
                                                                        className={`fas fa-chevron-right transform transition-transform ${team.expanded ? 'rotate-90' : ''}`}
                                                                    />
                                                                    <span className='font-medium'>
                                                                        {team.name}
                                                                    </span>
                                                                </button>
                                                            </td>
                                                            <td className='px-6 py-4'/>
                                                        </tr>
                                                        {team.expanded &&
                                                        team.channels.map((channel) => (
                                                            <tr
                                                                key={channel.id}
                                                                className='bg-white hover:bg-gray-50'
                                                            >
                                                                <td className='px-6 py-4 pl-12 text-sm text-gray-600'>
                                                                    <div className='flex items-center space-x-2'>
                                                                        <i className='fas fa-hashtag text-gray-400'/>
                                                                        <span>{channel.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                                                                    <label className='inline-flex items-center cursor-pointer'>
                                                                        <div className='relative'>
                                                                            <input
                                                                                type='checkbox'
                                                                                className='sr-only'
                                                                                checked={channel.enableSearchablePDF}
                                                                                onChange={() =>
                                                                                    handleChannelSettingChange(
                                                                                        team.id,
                                                                                        channel.id,
                                                                                    )
                                                                                }
                                                                            />
                                                                            <div
                                                                                className={`block w-10 h-6 rounded-full ${channel.enableSearchablePDF ? 'bg-blue-600' : 'bg-gray-300'}`}
                                                                            />
                                                                            <div
                                                                                className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${channel.enableSearchablePDF ? 'transform translate-x-4' : ''}`}
                                                                            />
                                                                        </div>
                                                                    </label>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>
            {/* Footer */}
            <footer className='bg-white border-t border-gray-200 px-6 py-4'>
                <div className='max-w-5xl mx-auto flex justify-end'>
                    <button
                        onClick={handleSave}
                        className='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 !rounded-button whitespace-nowrap cursor-pointer'
                    >
                        {'Save Changes'}
                    </button>
                </div>
            </footer>
        </div>
    );
};
export default App;
