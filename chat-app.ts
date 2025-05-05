import sw from './sw.js';

const { defineComponent } = sw;

const App = defineComponent(async ({ listen, whisper, broadcast }) => {
    const main = document.createElement('main');

    const sidebar = await Sidebar();

    const conversations = [
        'Grace',
        'Lenore',
        'Stephen'
    ];

    for (const person of conversations) {
        const button = await SidebarButton();
        whisper(button, 'setSidebarButtonId', person);
        whisper(sidebar, 'addConversationToSidebar', button);
    }

    const chatscreen = await ChatScreen();
    const textbox = await Textbox();

    listen('setActiveConversation', (conversation: string) => {

    });

    main.append(
        sidebar,
        chatscreen,
        textbox
    );

    return main;
});

const ChatScreen = defineComponent(async ({ listen }) => {
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

const Message = defineComponent(async ({ listen, ignore }) => {
    const p = document.createElement('p');
    listen('addTextToMessage', (message: string) => {
        p.textContent = message;
    },
        1);
    return p;
});

const Textbox = defineComponent(async ({ whisper, broadcast }) => {
    const div = document.createElement('div');
    div.className = 'textbox-wrapper';

    const input = document.createElement('input');
    input.type = 'text';

    const handleSend = async () => {
        if (!input.value.trim()) return;
        const newMsg = await Message('default');
        whisper(newMsg, 'addTextToMessage', input.value.trim());
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


const Sidebar = defineComponent(async ({ listen }) => {
    const div = document.createElement('div');
    div.className = 'sidebar';
    listen('addConversationToSidebar', (button: HTMLButtonElement) => div.append(button));
    return div;
});

const SidebarButton = defineComponent(async ({ listen, broadcast }) => {
    const button = document.createElement('button');
    let buttonId = '';
    listen('setSidebarButtonId', (person: string) => {
        button.textContent = person;
        buttonId = person;
    });
    button.addEventListener('click', () => {
        broadcast('setActiveConversation', buttonId)
    });

    return button;
});


document.body.append(await App('default'));

//@ts-ignore
window.x = sw;