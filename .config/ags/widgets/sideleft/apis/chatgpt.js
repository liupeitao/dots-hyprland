const { Gdk, GLib, Gtk, Pango } = imports.gi;
import { App, Utils, Widget } from '../../../imports.js';
const { Box, Button, Entry, EventBox, Icon, Label, Revealer, Scrollable, Stack } = Widget;
const { execAsync, exec } = Utils;
import ChatGPT from '../../../services/chatgpt.js';
import { MaterialIcon } from "../../../lib/materialicon.js";
import { setupCursorHover, setupCursorHoverInfo } from "../../../lib/cursorhover.js";
import { SystemMessage, ChatMessage } from "./chatgpt_chatmessage.js";
import { ConfigToggle, ConfigSegmentedSelection, ConfigGap } from '../../../lib/configwidgets.js';
import { markdownTest } from '../../../lib/md2pango.js';
import { MarginRevealer } from '../../../lib/advancedrevealers.js';

export const chatGPTTabIcon = Box({
    hpack: 'center',
    className: 'sidebar-chat-apiswitcher-icon',
    homogeneous: true,
    children: [
        MaterialIcon('forum', 'norm'),
    ],
});

const chatGPTInfo = Box({
    vertical: true,
    className: 'spacing-v-15',
    children: [
        Icon({
            hpack: 'center',
            className: 'sidebar-chat-welcome-logo',
            icon: `${App.configDir}/assets/openai-logomark.svg`,
            setup: (self) => Utils.timeout(1, () => {
                const styleContext = self.get_style_context();
                const width = styleContext.get_property('min-width', Gtk.StateFlags.NORMAL);
                const height = styleContext.get_property('min-height', Gtk.StateFlags.NORMAL);
                self.size = Math.max(width, height, 1) * 116 / 180; // Why such a specific proportion? See https://openai.com/brand#logos
            })
        }),
        Label({
            className: 'txt txt-title-small sidebar-chat-welcome-txt',
            wrap: true,
            justify: Gtk.Justification.CENTER,
            label: 'ChatGPT',
        }),
        Box({
            className: 'spacing-h-5',
            hpack: 'center',
            children: [
                Label({
                    className: 'txt-smallie txt-subtext',
                    wrap: true,
                    justify: Gtk.Justification.CENTER,
                    label: 'Powered by OpenAI',
                }),
                Button({
                    className: 'txt-subtext txt-norm icon-material',
                    label: 'info',
                    tooltipText: 'Uses gpt-3.5-turbo.\nNot affiliated, endorsed, or sponsored by OpenAI.',
                    setup: setupCursorHoverInfo,
                }),
            ]
        }),
    ]
})

export const chatGPTSettings = MarginRevealer({
    transition: 'slide_down',
    revealChild: true,
    connections: [
        [ChatGPT, (self) => Utils.timeout(200, () => {
            self._hide(self);
        }), 'newMsg'],
        [ChatGPT, (self) => Utils.timeout(200, () => {
            self._show(self);
        }), 'clear'],
    ],
    child: Box({
        vertical: true,
        className: 'sidebar-chat-settings',
        children: [
            ConfigSegmentedSelection({
                hpack: 'center',
                icon: 'casino',
                name: 'Randomness',
                desc: 'ChatGPT\'s temperature value.\n  Precise = 0\n  Balanced = 0.5\n  Creative = 1',
                options: [
                    { value: 0.00, name: 'Precise', },
                    { value: 0.50, name: 'Balanced', },
                    { value: 1.00, name: 'Creative', },
                ],
                initIndex: 1,
                onChange: (value, name) => {
                    ChatGPT.temperature = value;
                },
            }),
            ConfigGap({ vertical: true, size: 10 }), // Note: size can only be 5, 10, or 15 
            Box({
                vertical: true,
                hpack: 'fill',
                className: 'sidebar-chat-settings-toggles',
                children: [
                    ConfigToggle({
                        icon: 'cycle',
                        name: 'Cycle models',
                        desc: 'Helps avoid exceeding the API rate of 3 messages per minute.\nTurn this on if you message rapidly.',
                        initValue: ChatGPT.cycleModels,
                        onChange: (self, newValue) => {
                            ChatGPT.cycleModels = newValue;
                        },
                    }),
                    ConfigToggle({
                        icon: 'description',
                        name: 'Assistant prompt',
                        desc: 'Tells ChatGPT\n  1. It\'s a sidebar assistant on Linux\n  2. Be short and concise\n  3. Use markdown features extensively\nLeave this off for a vanilla ChatGPT experience.',
                        initValue: ChatGPT.assistantPrompt,
                        onChange: (self, newValue) => {
                            ChatGPT.assistantPrompt = newValue;
                        },
                    }),
                ]
            })
        ]
    })
});

export const openaiApiKeyInstructions = Box({
    homogeneous: true,
    children: [Revealer({
        transition: 'slide_down',
        transitionDuration: 150,
        connections: [[ChatGPT, (self, hasKey) => {
            self.revealChild = (ChatGPT.key.length == 0);
        }, 'hasKey']],
        child: Button({
            child: Label({
                useMarkup: true,
                wrap: true,
                className: 'txt sidebar-chat-welcome-txt',
                justify: Gtk.Justification.CENTER,
                label: 'An OpenAI API key is required\nYou can grab one <u>here</u>, then enter it below'
            }),
            setup: setupCursorHover,
            onClicked: () => {
                Utils.execAsync(['bash', '-c', `xdg-open https://platform.openai.com/api-keys &`]);
            }
        })
    })]
});

export const chatGPTWelcome = Box({
    vexpand: true,
    homogeneous: true,
    child: Box({
        className: 'spacing-v-15',
        vpack: 'center',
        vertical: true,
        children: [
            chatGPTInfo,
            openaiApiKeyInstructions,
            chatGPTSettings, ``
        ]
    })
});

export const chatContent = Box({
    className: 'spacing-v-15',
    vertical: true,
    connections: [
        [ChatGPT, (box, id) => {
            const message = ChatGPT.messages[id];
            if (!message) return;
            box.add(ChatMessage(message, chatGPTView))
        }, 'newMsg'],
    ]
});

const clearChat = () => {
    ChatGPT.clear();
    const children = chatContent.get_children();
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        child.destroy();
    }
}

export const chatGPTView = Scrollable({
    className: 'sidebar-chat-viewport',
    vexpand: true,
    child: Box({
        vertical: true,
        children: [
            chatGPTWelcome,
            chatContent,
        ]
    }),
    setup: (scrolledWindow) => {
        // Show scrollbar
        scrolledWindow.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        const vScrollbar = scrolledWindow.get_vscrollbar();
        vScrollbar.get_style_context().add_class('sidebar-scrollbar');
        // Avoid click-to-scroll-widget-to-view behavior
        Utils.timeout(1, () => { 
            const viewport = scrolledWindow.child;
            viewport.set_focus_vadjustment(new Gtk.Adjustment(undefined));
        })
    }
});

export const chatGPTCommands = Box({
    className: 'spacing-h-5',
    children: [
        Box({ hexpand: true }),
        Button({
            className: 'sidebar-chat-chip sidebar-chat-chip-action txt txt-small',
            onClicked: () => chatContent.add(SystemMessage(
                `Key stored in:\n\`${ChatGPT.keyPath}\`\nTo update this key, type \`/key YOUR_API_KEY\``,
                '/key',
                chatGPTView)),
            setup: setupCursorHover,
            label: '/key',
        }),
        Button({
            className: 'sidebar-chat-chip sidebar-chat-chip-action txt txt-small',
            onClicked: () => chatContent.add(SystemMessage(
                `Currently using \`${ChatGPT.modelName}\``,
                '/model',
                chatGPTView
            )),
            setup: setupCursorHover,
            label: '/model',
        }),
        Button({
            className: 'sidebar-chat-chip sidebar-chat-chip-action txt txt-small',
            onClicked: () => clearChat(),
            setup: setupCursorHover,
            label: '/clear',
        }),
    ]
});

export const chatGPTSendMessage = (text) => {
    // Check if text or API key is empty
    if (text.length == 0) return;
    if (ChatGPT.key.length == 0) {
        ChatGPT.key = text;
        chatContent.add(SystemMessage(`Key saved to\n\`${ChatGPT.keyPath}\``, 'API Key', chatGPTView));
        text = '';
        return;
    }
    // Commands
    if (text.startsWith('/')) {
        if (text.startsWith('/clear')) clearChat();
        else if (text.startsWith('/model')) chatContent.add(SystemMessage(`Currently using \`${ChatGPT.modelName}\``, '/model', chatGPTView))
        else if (text.startsWith('/prompt')) {
            const firstSpaceIndex = text.indexOf(' ');
            const prompt = text.slice(firstSpaceIndex + 1);
            if (firstSpaceIndex == -1 || prompt.length < 1) {
                chatContent.add(SystemMessage(`Usage: \`/prompt MESSAGE\``, '/prompt', chatGPTView))
            }
            else {
                ChatGPT.addMessage('user', prompt)
            }
        }
        else if (text.startsWith('/key')) {
            const parts = text.split(' ');
            if (parts.length == 1) chatContent.add(SystemMessage(
                `Key stored in:\n\`${ChatGPT.keyPath}\`\nTo update this key, type \`/key YOUR_API_KEY\``,
                '/key',
                chatGPTView));
            else {
                ChatGPT.key = parts[1];
                chatContent.add(SystemMessage(`Updated API Key at\n\`${ChatGPT.keyPath}\``, '/key', chatGPTView));
            }
        }
        else if (text.startsWith('/test'))
            chatContent.add(SystemMessage(markdownTest, `Markdown test`, chatGPTView));
        else
            chatContent.add(SystemMessage(`Invalid command.`, 'Error', chatGPTView))
    }
    else {
        ChatGPT.send(text);
    }
}