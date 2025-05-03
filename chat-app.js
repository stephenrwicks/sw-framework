import sw from './sw.js';
const { defineComponent } = sw;
const App = defineComponent(async () => {
    const element = document.createElement('main');
    element.append(await ChatScreen(), await Textbox());
    return element;
});
const ChatScreen = defineComponent(async ({ listen }) => {
    const div = document.createElement('div');
    listen('newMessage', (p) => div.append(p));
    return div;
});
const Message = defineComponent(async ({ listen, ignore }) => {
    const p = document.createElement('p');
    listen('messageText', (message) => {
        p.textContent = message;
        ignore('messageText');
    });
    return p;
});
const Textbox = defineComponent(async ({ whisper, shout }) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.columnGap = '10px';
    const input = document.createElement('input');
    input.type = 'text';
    const handleSend = async () => {
        if (!input.value.trim())
            return;
        const newMsg = await Message();
        whisper(newMsg, 'messageText', input.value.trim());
        shout('newMessage', newMsg);
        input.value = '';
    };
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Send';
    button.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')
            handleSend();
    });
    div.append(input, button);
    return div;
});
document.body.append(await App());
