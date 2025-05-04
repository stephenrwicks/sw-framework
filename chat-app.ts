import sw from './sw.js';

const { defineComponent } = sw;

const App = defineComponent(async ({ room }) => {
    const element = document.createElement('main');
    element.append(
        await ChatScreen(''),
        await Textbox('default')
    );
    return element;
});

const ChatScreen = defineComponent(async ({ listen }) => {
    const div = document.createElement('div');
    // Listen to wait for message component instances
    // to get passed here, then append them
    listen('addMessageToScreen', (p) => {
        div.append(p)
    });
    return div;
});

const Message = defineComponent(async ({ listen, ignore }) => {
    const p = document.createElement('p');
    listen('addTextToMessage', (message: string) => {
        p.textContent = message;
        ignore('addTextToMessage');
    });
    return p;
});

const Textbox = defineComponent(async ({ whisper, broadcast }) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.columnGap = '10px';

    const input = document.createElement('input');
    input.type = 'text';

    const handleSend = async () => {
        if (!input.value.trim()) return;
        // Create a new message instance (element)
        const newMsg = await Message('default');
        // Instead of props, inject the message directly to the new message component instance
        whisper(newMsg, 'addTextToMessage', input.value.trim());
        // Pass the new message component instance as data back to the screen
        // No need for instance or room scope here since there's only one screen, so we can just shout or broadcast
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


document.body.append(await App('default'));

//@ts-ignore
window.x = sw;