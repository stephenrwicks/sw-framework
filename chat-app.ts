import sw from './sw.js';

const { define, build } = sw;

define(async function App({ listen, whisper, broadcast }) {
    const main = document.createElement('main');

    const sidebar = await build('Sidebar');

    const conversations = [
        'Grace',
        'Lenore',
        'Stephen'
    ];

    for (const person of conversations) {
        const button = await build('SidebarButton')
        whisper(button, 'setSidebarButtonId', person);
        whisper(sidebar, 'addConversationToSidebar', button);
    }

    const chatscreen = await build('ChatScreen');
    const textbox = await build('Textbox');

    listen('setActiveConversation', (conversation: string) => {

    });

    main.append(
        sidebar,
        chatscreen,
        textbox
    );

    return main;
});

define(async function ChatScreen({ listen }) {
    const div = document.createElement('div');
    div.className = 'chat-screen';
    const messages: HTMLParagraphElement[] = [];
    listen('addMessageToScreen', (p) => {
        messages.push(p);
        div.append(p)
    });
    listen('changeScreen', () => {
        div.replaceChildren();
    });
    return div;
});


define(async function Message({ whisper }, props) {
    const p = document.createElement('p');
    p.textContent = props?.text;
    return p;
});

define(async function Textbox({ whisper, broadcast }) {
    const div = document.createElement('div');
    div.className = 'textbox-wrapper';

    const input = document.createElement('input');
    input.type = 'text';

    const handleSend = async () => {
        if (!input.value.trim()) return;
        const newMsg = await build('Message', { text: input.value.trim() });
        broadcast('addMessageToScreen', newMsg);
        input.value = '';
    };

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Send';

    button.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    div.append(input, button);
    return div;
});


define(async function Sidebar({ listen }) {
    const div = document.createElement('div');
    div.className = 'sidebar';
    listen('addConversationToSidebar', (button: HTMLButtonElement) => div.append(button));
    return div;
});

define(async function SidebarButton({ listen, broadcast }) {
    const button = document.createElement('button');
    let buttonId = '';
    listen('setSidebarButtonId', (person: string) => {
        button.textContent = person;
        buttonId = person;
    });
    button.addEventListener('click', () => {
        broadcast('setActiveConversation', buttonId)
    });

    // const x = await sw.build('Message');
    // console.log(x);
    return button;
});


document.body.append(await build('App'));

//@ts-ignore
window.sw = sw;