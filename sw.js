// Registers instances, instances must return elements
const COMPONENTMAP = new Map();
// component instance ID to the instance
const IDMAP = new Map();
// Registers to each event a map of instances where each instance has a set of callbacks
const EVENTMAP = new Map();
// Each instance gets a unique id by increment
let INSTANCEIDCOUNT = -1;
// Listen for a message and fire a callback
const LISTEN = (eventName, callback, self) => {
    const listenerCallbackMap = EVENTMAP.get(eventName);
    if (listenerCallbackMap) {
        const callbacks = listenerCallbackMap.get(self);
        if (callbacks) {
            callbacks.add(callback);
        }
        else {
            const callbacks = new Set();
            callbacks.add(callback);
            listenerCallbackMap.set(self, callbacks);
        }
    }
    else {
        const listenerCallbackMap = new Map();
        const callbacks = new Set();
        callbacks.add(callback);
        listenerCallbackMap.set(self, callbacks);
        EVENTMAP.set(eventName, listenerCallbackMap);
    }
};
// Listen for a message one time
const LISTENONCE = (eventName, callback, self) => {
};
// Stop listening to a message
const IGNORE = (eventName, self) => {
    EVENTMAP.get(eventName)?.delete(self);
};
// Message every instance and ignore scope
const BROADCAST = (eventName, data, notifier) => {
    const listenerCallbackMap = EVENTMAP.get(eventName);
    if (!listenerCallbackMap)
        return;
    listenerCallbackMap.forEach(callbackSet => {
        for (const callback of callbackSet) {
            callback(data, notifier);
        }
    });
};
// Message every instance in scope
const SHOUT = (eventName, data, speaker) => {
    const listenerCallbackMap = EVENTMAP.get(eventName);
    if (!listenerCallbackMap)
        return;
    listenerCallbackMap.forEach(callbackSet => {
        for (const callback of callbackSet) {
            callback(data, speaker);
        }
    });
};
// Message one instance
const WHISPER = (target, eventName, data, speaker) => {
    const callbackSet = EVENTMAP.get(eventName)?.get(target);
    if (!callbackSet)
        return;
    for (const callback of callbackSet) {
        callback(data, speaker);
    }
};
// Set a persistent message that can be picked up at any time.
// Can be heard after it is fired.
// Can be modified later, which will refire callbacks
// Unscoped? Could also have scope for this and an unscoped version (Billboard)
const ECHO = (eventName, data, notifier) => {
};
const defineComponent = (componentFn) => {
    const instanceSet = new Set();
    const createInstance = async (room = null) => {
        let isMounting = true;
        //let element: HTMLElement;
        INSTANCEIDCOUNT++;
        const instanceId = INSTANCEIDCOUNT;
        // We are using a Promise to resolve a circular dependency.
        // In order for the methods like listen() to work, they need the component instance to finish firing and return its value, element.
        // But the methods are available inside the component instance and can be fired immediately, and need to pass in element for them to work.
        // So the promise is there to force the methods to wait for the instance to finish returning before they can fire.
        // Otherwise, "element" here is undefined and this breaks.
        // The method might not be fired immediately though, so we add a boolean check to see if the component instance has returned already.
        // This is pretty new - Baseline 2024. Allows access to the resolver from outside. 
        // Not needed but better than the old way to do this
        const { promise: getElement, resolve: resolveElement, reject: rejectElement } = Promise.withResolvers();
        const fireAbility = (fn, ...args) => {
            if (isMounting) {
                getElement.then(element => fn(...args, element, room));
            }
            else {
                fn(...args, element, room);
            }
        };
        const abilities = {
            get id() {
                return instanceId;
            },
            get room() {
                return room;
            },
            changeRoom(newRoom) {
                room = newRoom || null;
            },
            whisper(target, eventName, data) {
                fireAbility(WHISPER, target, eventName, data);
            },
            shout(eventName, data) {
                fireAbility(SHOUT, eventName, data);
            },
            broadcast(eventName, data) {
                fireAbility(BROADCAST, eventName, data);
            },
            listen(eventName, callback) {
                fireAbility(LISTEN, eventName, callback);
            },
            ignore(eventName) {
                fireAbility(IGNORE, eventName, element);
            },
            destroy() {
                // Delete from maps and null stuff out
            }
        };
        Object.freeze(abilities);
        const element = await componentFn(abilities);
        if (!(element instanceof HTMLElement)) {
            rejectElement();
            throw new Error(`Component definition must be async and must return an HTMLElement.`);
        }
        IDMAP.set(instanceId, element);
        instanceSet.add(element);
        element.dataset.swId = String(instanceId);
        if (room) {
            element.dataset.swRoom = String(room ?? '');
        }
        else {
            delete element.dataset.swRoom;
        }
        resolveElement(element);
        isMounting = false;
        return element;
    };
    COMPONENTMAP.set(createInstance, instanceSet);
    return createInstance;
};
const getInstances = (componentFn) => {
    return COMPONENTMAP.get(componentFn);
};
const clearEvent = (eventName) => {
    EVENTMAP.delete(eventName);
};
const hasEvent = (eventName) => {
    return EVENTMAP.has(eventName);
};
const sw = {
    defineComponent: defineComponent,
    get components() {
        // Doesn't really make sense right now because we aren't storing the name
        // anonymous function makes this basically impossible
        return [...COMPONENTMAP.keys()];
    },
    getInstances,
    getInstanceById(id) {
        return IDMAP.get(id);
    },
    get events() {
        return [...EVENTMAP.keys()];
    },
    clearEvent,
    hasEvent,
};
Object.freeze(sw);
export default sw;
